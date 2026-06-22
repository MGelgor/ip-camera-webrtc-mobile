/**
 * Signaling server başlangıç iskeleti
 *
 * Bu dosya gerçek video taşımaz.
 * Görevi, WebRTC bağlantısı kurulmadan önce gerekli mesajları taşımaktır.
 *
 * WebRTC'de taraflar birbirine şunları söyler:
 * - Ben hangi video/ses özelliklerini destekliyorum?
 * - Hangi IP ve port üzerinden ulaşılabilirim?
 * - Bağlantıyı kurmak için hangi adımları izlemeliyiz?
 *
 * Bu mesajları taşıyan katman signaling katmanıdır.
 */

const http = require("node:http");
const https = require("node:https");
const crypto = require("node:crypto");
const fs = require("node:fs");
const { URL } = require("node:url");
const WebSocket = require("ws");

const PORT = Number(process.env.SIGNALING_PORT ?? process.env.PORT ?? 3000);
const GATEWAY_HOST = process.env.GATEWAY_HOST ?? "10.1.1.3";
const GATEWAY_API_PORT = Number(process.env.GO2RTC_API_PORT ?? 1984);
const GO2RTC_API_USERNAME = process.env.GO2RTC_API_USERNAME ?? "";
const GO2RTC_API_PASSWORD = process.env.GO2RTC_API_PASSWORD ?? "";
const CAMERA_STREAM_NAME = process.env.CAMERA_NAME ?? "ofis_kamera";
const CAMERA_LABEL = process.env.CAMERA_LABEL ?? "Ofis Kamera";
const CAMERA_LOCATION = process.env.CAMERA_LOCATION ?? "Multitek test alani";
const SIGNALING_AUTH_TOKEN = (process.env.SIGNALING_AUTH_TOKEN ?? "").trim();
const SIGNALING_AUTH_USERNAME = (process.env.SIGNALING_AUTH_USERNAME ?? "").trim();
const SIGNALING_AUTH_PASSWORD = process.env.SIGNALING_AUTH_PASSWORD ?? "";
const SIGNALING_TLS_CERT_PATH = process.env.SIGNALING_TLS_CERT_PATH ?? "";
const SIGNALING_TLS_KEY_PATH = process.env.SIGNALING_TLS_KEY_PATH ?? "";
const SIGNALING_RATE_LIMIT_WINDOW_MS = Number(process.env.SIGNALING_RATE_LIMIT_WINDOW_MS ?? 60_000);
const SIGNALING_RATE_LIMIT_MAX_REQUESTS = Number(process.env.SIGNALING_RATE_LIMIT_MAX_REQUESTS ?? 120);
const STUN_URL = process.env.STUN_URL ?? "";
const TURN_URL = process.env.TURN_URL ?? "";
const TURN_USER = process.env.TURN_USER ?? "";
const TURN_PASSWORD = process.env.TURN_PASSWORD ?? "";
const ALLOWED_SIGNAL_TYPES = new Set(["offer", "answer", "ice-candidate", "webrtc/offer", "webrtc/answer", "webrtc/candidate"]);
const PLAYER_SESSION_COOKIE = "signaling_player_session";
const PLAYER_SESSION_TTL_MS = 10 * 60 * 1000;
const ACCESS_SESSION_TTL_MS = 60 * 60 * 1000;

// Oda mantigini hafif bir bellek yapisinda tutuyoruz.
// Bu server video tasimaz; sadece baglanti mesajlarini relaye eder.
const rooms = new Map();
const clients = new Map();
const rateLimits = new Map();
const playerSessions = new Map();
const accessSessions = new Map();

function assertConfiguration() {
  if (SIGNALING_AUTH_TOKEN.length < 32) {
    console.error(
      "SIGNALING_AUTH_TOKEN zorunludur ve en az 32 karakter olmalidir. " +
        "Yeni token icin: openssl rand -hex 32",
    );
    process.exit(1);
  }
  if (!SIGNALING_AUTH_USERNAME || SIGNALING_AUTH_PASSWORD.length < 12) {
    console.error(
      "SIGNALING_AUTH_USERNAME ve en az 12 karakterlik SIGNALING_AUTH_PASSWORD zorunludur.",
    );
    process.exit(1);
  }
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded ?? req.socket.remoteAddress ?? "unknown";
  return String(raw).split(",")[0].trim();
}

function maskValue(value) {
  if (!value || value === "unknown") {
    return "unknown";
  }

  if (value.includes(":")) {
    const parts = value.split(":");
    return `${parts.slice(0, 2).join(":")}:***`;
  }

  const parts = value.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }

  return "***";
}

function logEvent(kind, details) {
  const line = Object.entries(details)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  console.log(`[signaling] ${kind}${line ? ` ${line}` : ""}`);
}

function takeRateLimit(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const entry = rateLimits.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, {
      count: 1,
      resetAt: now + SIGNALING_RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (entry.count >= SIGNALING_RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count += 1;
  return true;
}

function cameraCatalog() {
  return [
    {
      id: "ofis-kamera",
      name: CAMERA_LABEL,
      location: CAMERA_LOCATION,
      streamName: CAMERA_STREAM_NAME,
      playerPath: `/player?src=${encodeURIComponent(CAMERA_STREAM_NAME)}`,
      streamStatusPath: `/gateway/status?src=${encodeURIComponent(CAMERA_STREAM_NAME)}`,
      room: CAMERA_STREAM_NAME,
      iceServers: [
        ...(STUN_URL ? [{ urls: [STUN_URL] }] : []),
        ...(TURN_URL && TURN_USER && TURN_PASSWORD
          ? [{ urls: [TURN_URL], username: TURN_USER, credential: TURN_PASSWORD }]
          : []),
      ],
    },
  ];
}

function extractBearerToken(req, url) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  return url.searchParams.get("token") ?? "";
}

function tokensEqual(receivedToken, expectedToken) {
  const expected = Buffer.from(expectedToken, "utf8");
  const received = Buffer.from(receivedToken, "utf8");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function hasValidAccessSession(token) {
  if (!token) return false;

  const expiresAt = accessSessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    accessSessions.delete(token);
    return false;
  }

  return true;
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};

  return Object.fromEntries(
    header.split(";").map((item) => {
      const separator = item.indexOf("=");
      if (separator < 0) return [item.trim(), ""];
      return [
        item.slice(0, separator).trim(),
        decodeURIComponent(item.slice(separator + 1).trim()),
      ];
    }),
  );
}

function hasValidPlayerSession(req) {
  const sessionId = parseCookies(req)[PLAYER_SESSION_COOKIE];
  if (!sessionId) return false;

  const expiresAt = playerSessions.get(sessionId);
  if (!expiresAt || expiresAt <= Date.now()) {
    playerSessions.delete(sessionId);
    return false;
  }

  return true;
}

function isAuthorized(req, url) {
  const receivedToken = extractBearerToken(req, url);
  return (
    tokensEqual(receivedToken, SIGNALING_AUTH_TOKEN) ||
    hasValidAccessSession(receivedToken) ||
    hasValidPlayerSession(req)
  );
}

function readJsonBody(req, limit = 8 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function issueAccessSession() {
  const token = crypto.randomBytes(32).toString("base64url");
  accessSessions.set(token, Date.now() + ACCESS_SESSION_TTL_MS);
  return token;
}

function validLogin(username, password) {
  return (
    tokensEqual(String(username ?? ""), SIGNALING_AUTH_USERNAME) &&
    tokensEqual(String(password ?? ""), SIGNALING_AUTH_PASSWORD)
  );
}

function createPlayerSession(req, res) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  playerSessions.set(sessionId, Date.now() + PLAYER_SESSION_TTL_MS);

  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "")
    .split(",")[0]
    .trim();
  const secure = Boolean(req.socket.encrypted) || forwardedProto === "https";
  const attributes = [
    `${PLAYER_SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${Math.floor(PLAYER_SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) attributes.push("Secure");
  res.setHeader("Set-Cookie", attributes.join("; "));
}

function playerHtml(streamName) {
  const nonce = crypto.randomBytes(18).toString("base64");
  const playerConfig = JSON.stringify({
    streamName,
    iceServers: cameraCatalog()[0].iceServers,
  }).replace(/</g, "\\u003c");

  return {
    nonce,
    html: `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>Canli Kamera</title>
  <style nonce="${nonce}">
    html,body{width:100%;height:100%;margin:0;background:#05070d;overflow:hidden}
    body{font-family:sans-serif;color:#fff}
    video{width:100%;height:100%;object-fit:contain;background:#05070d}
    #state{position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;background:#05070d}
    #state[hidden]{display:none}
  </style>
</head>
<body>
  <video id="video" autoplay playsinline muted></video>
  <div id="state">Yayin baglantisi kuruluyor...</div>
  <script nonce="${nonce}">
    (() => {
      const config = ${playerConfig};
      const video = document.getElementById("video");
      const state = document.getElementById("state");
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(protocol + "//" + location.host + "/ws");
      let peer = null;
      const pendingCandidates = [];
      let remoteDescriptionReady = false;

      function fail(message) {
        state.hidden = false;
        state.textContent = message;
        if (peer) peer.close();
      }

      async function startPeer() {
        peer = new RTCPeerConnection({ bundlePolicy: "max-bundle", iceServers: config.iceServers });
        peer.addTransceiver("video", { direction: "recvonly" });
        peer.addTransceiver("audio", { direction: "recvonly" });
        peer.ontrack = (event) => {
          video.srcObject = event.streams[0] || new MediaStream([event.track]);
          state.hidden = true;
          video.play().catch(() => {});
        };
        peer.onicecandidate = (event) => {
          socket.send(JSON.stringify({
            type: "webrtc/candidate",
            value: event.candidate ? event.candidate.candidate : "",
          }));
        };
        peer.onconnectionstatechange = () => {
          if (peer.connectionState === "failed") fail("WebRTC baglantisi kurulamadi.");
        };

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.send(JSON.stringify({ type: "webrtc/offer", value: offer.sdp }));
      }

      socket.onopen = () => {
        socket.send(JSON.stringify({
          type: "join",
          room: config.streamName,
          role: "viewer",
          name: "webview-player",
        }));
      };
      socket.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "joined") {
          try { await startPeer(); } catch { fail("WebRTC baslatilamadi."); }
          return;
        }
        if (message.type === "webrtc/answer" && peer) {
          try {
            await peer.setRemoteDescription({ type: "answer", sdp: String(message.value || "") });
            remoteDescriptionReady = true;
            while (pendingCandidates.length) await peer.addIceCandidate(pendingCandidates.shift());
          } catch { fail("Yayin cevabi uygulanamadi."); }
          return;
        }
        if (message.type === "webrtc/candidate" && peer && message.value) {
          const candidate = { candidate: String(message.value), sdpMid: "0" };
          if (!remoteDescriptionReady) pendingCandidates.push(candidate);
          else peer.addIceCandidate(candidate).catch(() => {});
          return;
        }
        if (message.type === "error") fail(String(message.message || "Yayin hatasi."));
      };
      socket.onerror = () => fail("Signaling baglantisi kurulamadi.");
      socket.onclose = () => {
        if (!video.srcObject) fail("Signaling baglantisi kapandi.");
      };
    })();
  </script>
</body>
</html>`,
  };
}

function gatewayStatus(streamName, res) {
  const headers =
    GO2RTC_API_USERNAME && GO2RTC_API_PASSWORD
      ? {
          Authorization: `Basic ${Buffer.from(
            `${GO2RTC_API_USERNAME}:${GO2RTC_API_PASSWORD}`,
            "utf8",
          ).toString("base64")}`,
        }
      : {};

  const request = http.request(
    {
      host: GATEWAY_HOST,
      port: GATEWAY_API_PORT,
      path: "/api/streams",
      method: "GET",
      headers,
      timeout: 5000,
    },
    (gatewayResponse) => {
      const chunks = [];
      gatewayResponse.on("data", (chunk) => chunks.push(chunk));
      gatewayResponse.on("end", () => {
        if (gatewayResponse.statusCode !== 200) {
          writeJson(res, 502, { ok: false, error: "Gateway unavailable" });
          return;
        }

        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          const stream = payload[streamName];
          writeJson(res, 200, {
            [streamName]: {
              producers: Array.isArray(stream?.producers)
                ? stream.producers.map(() => ({ active: true }))
                : [],
              consumers: Array.isArray(stream?.consumers)
                ? stream.consumers.map(() => ({ active: true }))
                : [],
            },
          });
        } catch {
          writeJson(res, 502, { ok: false, error: "Invalid gateway response" });
        }
      });
    },
  );

  request.on("timeout", () => request.destroy(new Error("Gateway timeout")));
  request.on("error", () => {
    if (!res.headersSent) {
      writeJson(res, 502, { ok: false, error: "Gateway unavailable" });
    }
  });
  request.end();
}

function ensureRoom(roomName) {
  if (!rooms.has(roomName)) {
    rooms.set(roomName, {
      name: roomName,
      members: new Set(),
      createdAt: new Date().toISOString(),
    });
  }

  return rooms.get(roomName);
}

function roomSnapshot(room) {
  return {
    name: room.name,
    createdAt: room.createdAt,
    members: Array.from(room.members).map((clientId) => {
      const client = clients.get(clientId);
      return client
        ? {
            id: client.id,
            role: client.role,
            name: client.name,
            joinedAt: client.joinedAt,
          }
        : { id: clientId };
    }),
  };
}

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastToRoom(roomName, payload, exceptClientId = null) {
  const room = rooms.get(roomName);
  if (!room) return;

  for (const memberId of room.members) {
    if (memberId === exceptClientId) continue;
    const member = clients.get(memberId);
    if (member) {
      send(member.ws, payload);
    }
  }
}

function closeMediaSocket(client) {
  const mediaSocket = client?.mediaSocket;
  if (!mediaSocket) return;

  client.mediaSocket = null;
  client.mediaQueue = [];
  if (
    mediaSocket.readyState === WebSocket.OPEN ||
    mediaSocket.readyState === WebSocket.CONNECTING
  ) {
    mediaSocket.close();
  }
}

function leaveRoom(clientId) {
  const client = clients.get(clientId);
  if (!client) return;

  const roomName = client.room;
  if (roomName) {
    const room = rooms.get(roomName);
    if (room) {
      room.members.delete(clientId);
      broadcastToRoom(
        roomName,
        {
          type: "peer-left",
          room: roomName,
          peerId: clientId,
        },
        clientId,
      );

      if (room.members.size === 0) {
        rooms.delete(roomName);
      }
    }
  }

  closeMediaSocket(client);
  client.room = null;
}

function removeClient(clientId) {
  const client = clients.get(clientId);
  if (!client) return;

  leaveRoom(clientId);
  clients.delete(clientId);
}

function gatewayWebSocketUrl(streamName) {
  const baseUrl = `ws://${GATEWAY_HOST}:${GATEWAY_API_PORT}`;
  return `${baseUrl}/api/ws?src=${encodeURIComponent(streamName)}`;
}

function forwardToGateway(client, payload) {
  if (client.mediaSocket?.readyState === WebSocket.OPEN) {
    client.mediaSocket.send(JSON.stringify(payload));
    return;
  }

  client.mediaQueue.push(payload);
}

function ensureMediaBridge(client) {
  const existing = client.mediaSocket;
  if (
    existing &&
    (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  const headers =
    GO2RTC_API_USERNAME && GO2RTC_API_PASSWORD
      ? {
          Authorization: `Basic ${Buffer.from(
            `${GO2RTC_API_USERNAME}:${GO2RTC_API_PASSWORD}`,
            "utf8",
          ).toString("base64")}`,
        }
      : undefined;

  const mediaSocket = new WebSocket(gatewayWebSocketUrl(client.room), { headers });
  client.mediaSocket = mediaSocket;

  mediaSocket.on("open", () => {
    if (client.mediaSocket !== mediaSocket) return;
    for (const queued of client.mediaQueue.splice(0)) {
      mediaSocket.send(JSON.stringify(queued));
    }
  });

  mediaSocket.on("message", (raw) => {
    if (client.mediaSocket !== mediaSocket) return;
    try {
      send(client.ws, JSON.parse(raw.toString()));
    } catch {
      send(client.ws, { type: "error", message: "Gateway gecersiz mesaj gonderdi." });
    }
  });

  mediaSocket.on("error", () => {
    send(client.ws, {
      type: "error",
      message: "go2rtc media gateway baglantisi kurulamadi.",
    });
  });

  mediaSocket.on("close", () => {
    if (client.mediaSocket === mediaSocket) {
      client.mediaSocket = null;
      client.mediaQueue = [];
    }
  });
}

// Bu HTTP sunucusu signaling katmaninin ilk iskeletidir.
// Sonraki asamada WebSocket eklenecek ve mobil uygulama ile karsilikli mesajlasma baslayacak.
const requestHandler = async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const maskedIp = maskValue(clientIp(req));

  if (!takeRateLimit(req)) {
    logEvent("rate-limit", { ip: maskedIp, path: url.pathname });
    writeJson(res, 429, {
      ok: false,
      error: "Too many requests",
    });
    return;
  }

  if (url.pathname === "/health") {
    writeJson(res, 200, {
      ok: true,
      service: "signaling-server",
      rooms: rooms.size,
      port: PORT,
    });
    return;
  }

  if (url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(
      [
        "Signaling server calisiyor.",
        "",
        "WebSocket katmani aktif.",
        "offer, answer ve ICE candidate mesajlari /ws uzerinden relaye ediliyor.",
        "",
        "Saglik kontrolu icin /health adresini kullanabilirsin.",
        "Aktif odalari gormek icin /rooms adresini kullanabilirsin.",
        "Kamera katalogu icin /cameras adresini kullanabilirsin.",
      ].join("\n"),
    );
    return;
  }

  if (url.pathname === "/auth/login") {
    if (req.method !== "POST") {
      writeJson(res, 405, { ok: false, error: "Method not allowed" });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      writeJson(res, 400, { ok: false, error: "Invalid request" });
      return;
    }

    if (!validLogin(body.username, body.password)) {
      logEvent("login-failed", { ip: maskedIp });
      writeJson(res, 401, { ok: false, error: "Invalid credentials" });
      return;
    }

    const accessToken = issueAccessSession();
    logEvent("login-success", { ip: maskedIp, user: SIGNALING_AUTH_USERNAME });
    res.setHeader("Cache-Control", "no-store");
    writeJson(res, 200, {
      ok: true,
      accessToken,
      expiresIn: Math.floor(ACCESS_SESSION_TTL_MS / 1000),
    });
    return;
  }

  if (url.pathname === "/rooms") {
    if (!isAuthorized(req, url)) {
      logEvent("unauthorized-http", { ip: maskedIp, path: url.pathname });
      writeJson(res, 401, {
        ok: false,
        error: "Unauthorized",
      });
      return;
    }

    writeJson(res, 200, {
      ok: true,
      rooms: Array.from(rooms.values()).map(roomSnapshot),
    });
    return;
  }

  if (url.pathname === "/cameras") {
    if (!isAuthorized(req, url)) {
      logEvent("unauthorized-http", { ip: maskedIp, path: url.pathname });
      writeJson(res, 401, {
        ok: false,
        error: "Unauthorized",
      });
      return;
    }

    writeJson(res, 200, {
      ok: true,
      cameras: cameraCatalog(),
    });
    return;
  }

  if (url.pathname === "/player") {
    if (!isAuthorized(req, url)) {
      logEvent("unauthorized-http", { ip: maskedIp, path: url.pathname });
      writeJson(res, 401, { ok: false, error: "Unauthorized" });
      return;
    }

    const streamName = String(url.searchParams.get("src") ?? "").trim();
    if (streamName !== CAMERA_STREAM_NAME) {
      writeJson(res, 404, { ok: false, error: "Camera not found" });
      return;
    }

    if (!hasValidPlayerSession(req)) {
      createPlayerSession(req, res);
    }
    const player = playerHtml(streamName);
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'none'; script-src 'nonce-${player.nonce}'; style-src 'nonce-${player.nonce}'; ` +
        "connect-src 'self' ws: wss:; media-src 'self' blob:; img-src 'self' data:; base-uri 'none'",
    );
    res.setHeader("Cache-Control", "no-store");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(player.html);
    return;
  }

  if (url.pathname === "/gateway/status") {
    if (!isAuthorized(req, url)) {
      logEvent("unauthorized-http", { ip: maskedIp, path: url.pathname });
      writeJson(res, 401, { ok: false, error: "Unauthorized" });
      return;
    }

    const streamName = String(url.searchParams.get("src") ?? "").trim();
    if (streamName !== CAMERA_STREAM_NAME) {
      writeJson(res, 404, { ok: false, error: "Camera not found" });
      return;
    }

    gatewayStatus(streamName, res);
    return;
  }

  writeJson(res, 404, {
    ok: false,
    error: "Not found",
  });
};

assertConfiguration();

const server =
  SIGNALING_TLS_CERT_PATH && SIGNALING_TLS_KEY_PATH
    ? https.createServer(
        {
          cert: fs.readFileSync(SIGNALING_TLS_CERT_PATH),
          key: fs.readFileSync(SIGNALING_TLS_KEY_PATH),
        },
        (req, res) => {
          requestHandler(req, res).catch(() => {
            if (!res.headersSent) writeJson(res, 500, { ok: false, error: "Internal error" });
          });
        },
      )
    : http.createServer((req, res) => {
        requestHandler(req, res).catch(() => {
          if (!res.headersSent) writeJson(res, 500, { ok: false, error: "Internal error" });
        });
      });

server.listen(PORT, () => {
  const protocol = SIGNALING_TLS_CERT_PATH && SIGNALING_TLS_KEY_PATH ? "https" : "http";
  console.log(`Signaling server ${protocol}://localhost:${PORT} adresinde calisiyor.`);
});

// WebSocket, WebRTC tarafinin teklif/cvp/ICE mesajlarini tasimasi icin kullanilir.
// HTTP sadece saglik ve room gozlemi icin açık bırakıldı.
const wss = new WebSocket.Server({ server, path: "/ws", maxPayload: 256 * 1024 });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "/ws", `http://${req.headers.host ?? "localhost"}`);
  const maskedIp = maskValue(clientIp(req));

  if (!takeRateLimit(req)) {
    logEvent("rate-limit-ws", { ip: maskedIp, path: url.pathname });
    ws.close(1013, "Rate limit");
    return;
  }

  if (!isAuthorized(req, url)) {
    logEvent("unauthorized-ws", { ip: maskedIp, path: url.pathname });
    ws.close(1008, "Unauthorized");
    return;
  }

  const clientId = crypto.randomUUID();

  clients.set(clientId, {
    id: clientId,
    ws,
    room: null,
    role: "viewer",
    name: `client-${clientId.slice(0, 8)}`,
    joinedAt: new Date().toISOString(),
    mediaSocket: null,
    mediaQueue: [],
  });

  send(ws, {
    type: "connected",
    clientId,
    message: "Signaling websocket baglantisi kuruldu.",
  });
  logEvent("ws-connected", { ip: maskedIp, clientId: clientId.slice(0, 8) });

  ws.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      send(ws, {
        type: "error",
        message: "JSON formatinda mesaj bekleniyor.",
      });
      return;
    }

    const client = clients.get(clientId);
    if (!client) return;

    if (message.type === "join") {
      const roomName = String(message.room ?? "").trim();
      if (!roomName) {
        send(ws, {
          type: "error",
          message: "join icin room alanı zorunlu.",
        });
        return;
      }
      if (roomName !== CAMERA_STREAM_NAME) {
        send(ws, {
          type: "error",
          message: "Bu kamera odasina erisim izni yok.",
        });
        return;
      }

      const joiningNewRoom = client.room !== roomName;
      if (client.room && joiningNewRoom) {
        leaveRoom(clientId);
      }

      const room = ensureRoom(roomName);
      client.room = roomName;
      client.role = message.role === "publisher" ? "publisher" : "viewer";
      client.name = String(message.name ?? client.name).trim().slice(0, 80);
      client.joinedAt = new Date().toISOString();
      room.members.add(clientId);

      send(ws, {
        type: "joined",
        room: roomName,
        clientId,
        role: client.role,
        members: roomSnapshot(room).members,
      });
      logEvent("room-join", {
        ip: maskedIp,
        room: roomName,
        clientId: clientId.slice(0, 8),
        role: client.role,
      });

      if (joiningNewRoom) {
        broadcastToRoom(
          roomName,
          {
            type: "peer-joined",
            room: roomName,
            peerId: clientId,
            role: client.role,
            name: client.name,
          },
          clientId,
        );
      }
      return;
    }

    if (message.type === "leave") {
      send(ws, {
        type: "left",
        room: client.room,
      });
      leaveRoom(clientId);
      return;
    }

    if (!client.room) {
      send(ws, {
        type: "error",
        message: "Once bir room'a join olmalisin.",
      });
      return;
    }

    if (!ALLOWED_SIGNAL_TYPES.has(message.type)) {
      send(ws, {
        type: "error",
        message: "Desteklenmeyen signaling mesaji.",
      });
      return;
    }

    if (client.role === "viewer" && message.type.startsWith("webrtc/")) {
      ensureMediaBridge(client);
      forwardToGateway(client, {
        type: message.type,
        value: message.value,
      });
      return;
    }

    // offer / answer / ice-candidate gibi mesajlar odaya dağıtılır.
    broadcastToRoom(
      client.room,
      {
        ...message,
        from: clientId,
        room: client.room,
      },
      clientId,
    );
  });

  ws.on("close", () => {
    logEvent("ws-closed", { ip: maskedIp, clientId: clientId.slice(0, 8) });
    removeClient(clientId);
  });
});

/**
 * Sonraki aşamada burada şu parçalar olacak:
 *
 * 1. WebSocket bağlantısı
 *    - Mobil uygulama ile karşılıklı mesajlaşma için
 *
 * 2. Oda mantığı
 *    - Hangi kullanıcının hangi kamerayı izlediğini eşlemek için
 *
 * 3. SDP aktarımı
 *    - WebRTC oturum tanımını taşımak için
 *
 * 4. ICE candidate aktarımı
 *    - Uygun bağlantı yolunu bulmak için
 */
