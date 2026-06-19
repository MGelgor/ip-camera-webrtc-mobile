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
const GATEWAY_WEBRTC_PORT = Number(process.env.GO2RTC_WEBRTC_PORT ?? 8555);
const CAMERA_STREAM_NAME = process.env.CAMERA_NAME ?? "ofis_kamera";
const CAMERA_LABEL = process.env.CAMERA_LABEL ?? "Ofis Kamera";
const CAMERA_LOCATION = process.env.CAMERA_LOCATION ?? "Multitek test alani";
const SIGNALING_AUTH_TOKEN = process.env.SIGNALING_AUTH_TOKEN ?? "";
const SIGNALING_TLS_CERT_PATH = process.env.SIGNALING_TLS_CERT_PATH ?? "";
const SIGNALING_TLS_KEY_PATH = process.env.SIGNALING_TLS_KEY_PATH ?? "";
const GO2RTC_API_USERNAME = process.env.GO2RTC_API_USERNAME ?? "";
const GO2RTC_API_PASSWORD = process.env.GO2RTC_API_PASSWORD ?? "";
const SIGNALING_RATE_LIMIT_WINDOW_MS = Number(process.env.SIGNALING_RATE_LIMIT_WINDOW_MS ?? 60_000);
const SIGNALING_RATE_LIMIT_MAX_REQUESTS = Number(process.env.SIGNALING_RATE_LIMIT_MAX_REQUESTS ?? 120);

// Oda mantigini hafif bir bellek yapisinda tutuyoruz.
// Bu server video tasimaz; sadece baglanti mesajlarini relaye eder.
const rooms = new Map();
const clients = new Map();
const rateLimits = new Map();

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
  const encodedStreamName = encodeURIComponent(CAMERA_STREAM_NAME);
  const gatewayAuthHeader =
    GO2RTC_API_USERNAME && GO2RTC_API_PASSWORD
      ? `Basic ${Buffer.from(`${GO2RTC_API_USERNAME}:${GO2RTC_API_PASSWORD}`, "utf8").toString("base64")}`
      : null;

  return [
    {
      id: "ofis-kamera",
      name: CAMERA_LABEL,
      location: CAMERA_LOCATION,
      streamName: CAMERA_STREAM_NAME,
      gatewayHost: GATEWAY_HOST,
      playerUrl: `http://${GATEWAY_HOST}:${GATEWAY_API_PORT}/stream.html?src=${encodedStreamName}`,
      webrtcUrl: `ws://${GATEWAY_HOST}:${GATEWAY_API_PORT}/api/ws?src=${encodedStreamName}`,
      gatewayWebRtcPort: GATEWAY_WEBRTC_PORT,
      gatewayAuthHeader,
      room: CAMERA_STREAM_NAME,
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

function isAuthorized(req, url) {
  if (!SIGNALING_AUTH_TOKEN) {
    return true;
  }

  return extractBearerToken(req, url) === SIGNALING_AUTH_TOKEN;
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

  client.room = null;
}

function removeClient(clientId) {
  leaveRoom(clientId);
  clients.delete(clientId);
}

// Bu HTTP sunucusu signaling katmaninin ilk iskeletidir.
// Sonraki asamada WebSocket eklenecek ve mobil uygulama ile karsilikli mesajlasma baslayacak.
const requestHandler = (req, res) => {
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

  writeJson(res, 404, {
    ok: false,
    error: "Not found",
  });
};

const server =
  SIGNALING_TLS_CERT_PATH && SIGNALING_TLS_KEY_PATH
    ? https.createServer(
        {
          cert: fs.readFileSync(SIGNALING_TLS_CERT_PATH),
          key: fs.readFileSync(SIGNALING_TLS_KEY_PATH),
        },
        requestHandler,
      )
    : http.createServer(requestHandler);

server.listen(PORT, () => {
  const protocol = SIGNALING_TLS_CERT_PATH && SIGNALING_TLS_KEY_PATH ? "https" : "http";
  console.log(`Signaling server ${protocol}://localhost:${PORT} adresinde calisiyor.`);
});

// WebSocket, WebRTC tarafinin teklif/cvp/ICE mesajlarini tasimasi icin kullanilir.
// HTTP sadece saglik ve room gozlemi icin açık bırakıldı.
const wss = new WebSocket.Server({ server, path: "/ws" });

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

      const joiningNewRoom = client.room !== roomName;
      if (client.room && joiningNewRoom) {
        leaveRoom(clientId);
      }

      const room = ensureRoom(roomName);
      client.room = roomName;
      client.role = message.role === "publisher" ? "publisher" : "viewer";
      client.name = String(message.name ?? client.name).trim();
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
      const roomName = client.room;
      send(ws, {
        type: "left",
        room: roomName,
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
