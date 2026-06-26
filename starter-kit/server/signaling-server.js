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
const GATEWAY_REQUEST_TIMEOUT_MS = Number(process.env.GATEWAY_REQUEST_TIMEOUT_MS ?? 2500);
const GO2RTC_API_USERNAME = process.env.GO2RTC_API_USERNAME ?? "";
const GO2RTC_API_PASSWORD = process.env.GO2RTC_API_PASSWORD ?? "";
const CAMERA_STREAM_NAME = process.env.CAMERA_NAME ?? "ofis_kamera";
const CAMERA_LABEL = process.env.CAMERA_LABEL ?? "Ofis Kamera";
const CAMERA_LOCATION = process.env.CAMERA_LOCATION ?? "Multitek test alani";
const CAMERA_CATALOG_PATH = process.env.CAMERA_CATALOG_PATH ?? `${__dirname}/camera-catalog.json`;
const SIGNALING_AUTH_TOKEN = (process.env.SIGNALING_AUTH_TOKEN ?? "").trim();
const SIGNALING_AUTH_USERNAME = (process.env.SIGNALING_AUTH_USERNAME ?? "").trim();
const SIGNALING_AUTH_PASSWORD = process.env.SIGNALING_AUTH_PASSWORD ?? "";
const SIGNALING_TLS_CERT_PATH = process.env.SIGNALING_TLS_CERT_PATH ?? "";
const SIGNALING_TLS_KEY_PATH = process.env.SIGNALING_TLS_KEY_PATH ?? "";
const SIGNALING_RATE_LIMIT_WINDOW_MS = Number(process.env.SIGNALING_RATE_LIMIT_WINDOW_MS ?? 60_000);
const SIGNALING_RATE_LIMIT_MAX_REQUESTS = Number(process.env.SIGNALING_RATE_LIMIT_MAX_REQUESTS ?? 120);
const SIGNALING_LOGIN_RATE_LIMIT_WINDOW_MS = Number(
  process.env.SIGNALING_LOGIN_RATE_LIMIT_WINDOW_MS ?? 15 * 60_000,
);
const SIGNALING_LOGIN_RATE_LIMIT_MAX_REQUESTS = Number(
  process.env.SIGNALING_LOGIN_RATE_LIMIT_MAX_REQUESTS ?? 5,
);
const SIGNALING_TRUST_PROXY = process.env.SIGNALING_TRUST_PROXY === "true";
const SESSION_SWEEP_INTERVAL_MS = Number(process.env.SESSION_SWEEP_INTERVAL_MS ?? 60_000);
const MAX_SESSION_ENTRIES = Number(process.env.MAX_SESSION_ENTRIES ?? 10_000);
const STUN_URL = process.env.STUN_URL ?? "";
const TURN_URL = process.env.TURN_URL ?? "";
const TURN_USER = process.env.TURN_USER ?? "";
const TURN_PASSWORD = process.env.TURN_PASSWORD ?? "";
const ALLOWED_SIGNAL_TYPES = new Set(["offer", "answer", "ice-candidate", "webrtc/offer", "webrtc/answer", "webrtc/candidate"]);
const PLAYER_SESSION_COOKIE = "signaling_player_session";
const PLAYER_SESSION_TTL_MS = Number(process.env.PLAYER_SESSION_TTL_MS ?? 10 * 60 * 1000);
const ACCESS_SESSION_TTL_MS = Number(process.env.ACCESS_SESSION_TTL_MS ?? 60 * 60 * 1000);

// Oda mantigini hafif bir bellek yapisinda tutuyoruz.
// Bu server video tasimaz; sadece baglanti mesajlarini relaye eder.
const rooms = new Map();
const clients = new Map();
const rateLimits = new Map();
const loginRateLimits = new Map();
const playerSessions = new Map();
const accessSessions = new Map();
let cameraCatalogEntries = loadCameraCatalog();

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

  const positiveSettings = {
    SIGNALING_RATE_LIMIT_WINDOW_MS,
    SIGNALING_RATE_LIMIT_MAX_REQUESTS,
    SIGNALING_LOGIN_RATE_LIMIT_WINDOW_MS,
    SIGNALING_LOGIN_RATE_LIMIT_MAX_REQUESTS,
    SESSION_SWEEP_INTERVAL_MS,
    MAX_SESSION_ENTRIES,
    PLAYER_SESSION_TTL_MS,
    ACCESS_SESSION_TTL_MS,
  };
  for (const [name, value] of Object.entries(positiveSettings)) {
    if (!Number.isFinite(value) || value <= 0) {
      console.error(`${name} pozitif bir sayi olmalidir.`);
      process.exit(1);
    }
  }
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function clientIp(req) {
  const peerIp = String(req.socket.remoteAddress ?? "");
  const isLoopbackProxy =
    SIGNALING_TRUST_PROXY &&
    (peerIp === "127.0.0.1" || peerIp === "::1" || peerIp === "::ffff:127.0.0.1");
  const forwarded = isLoopbackProxy
    ? req.headers["cf-connecting-ip"] ?? req.headers["x-forwarded-for"]
    : null;
  const raw = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded ?? req.socket.remoteAddress ?? "unknown";
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

function defaultCameraCatalog() {
  return [
    {
      id: "ofis-kamera",
      name: CAMERA_LABEL,
      location: CAMERA_LOCATION,
      streamName: CAMERA_STREAM_NAME,
      rtspUrl: "",
    },
  ];
}

function normalizeCameraEntry(entry) {
  const streamName = String(entry.streamName ?? entry.name ?? "").trim();
  const id = String(entry.id ?? streamName.replaceAll("_", "-")).trim();
  return {
    id,
    name: String(entry.name ?? streamName).trim(),
    location: String(entry.location ?? "").trim(),
    streamName,
    rtspUrl: String(entry.rtspUrl ?? "").trim(),
  };
}

function loadCameraCatalog() {
  try {
    const raw = fs.readFileSync(CAMERA_CATALOG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const cameras = Array.isArray(parsed.cameras) ? parsed.cameras : [];
    const normalized = cameras.map(normalizeCameraEntry).filter((camera) => camera.id && camera.streamName);
    return normalized.length > 0 ? normalized : defaultCameraCatalog();
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(`Kamera katalogu okunamadi: ${CAMERA_CATALOG_PATH}`);
    }
    return defaultCameraCatalog();
  }
}

function saveCameraCatalog() {
  const payload = {
    cameras: cameraCatalogEntries,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CAMERA_CATALOG_PATH, JSON.stringify(payload, null, 2));
}

function publicCamera(camera) {
  const streamName = camera.streamName;
  return {
    id: camera.id,
    name: camera.name,
    location: camera.location,
    streamName,
    playerPath: `/player?src=${encodeURIComponent(streamName)}`,
    streamStatusPath: `/gateway/status?src=${encodeURIComponent(streamName)}`,
    room: streamName,
    iceServers: [
      ...(STUN_URL ? [{ urls: [STUN_URL] }] : []),
      ...(TURN_URL && TURN_USER && TURN_PASSWORD
        ? [{ urls: [TURN_URL], username: TURN_USER, credential: TURN_PASSWORD }]
        : []),
    ],
  };
}

function takeRateLimit(store, key, windowMs, maxRequests) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count += 1;
  return true;
}

function takeGeneralRateLimit(req) {
  return takeRateLimit(
    rateLimits,
    clientIp(req),
    SIGNALING_RATE_LIMIT_WINDOW_MS,
    SIGNALING_RATE_LIMIT_MAX_REQUESTS,
  );
}

function takeLoginRateLimit(req) {
  return takeRateLimit(
    loginRateLimits,
    clientIp(req),
    SIGNALING_LOGIN_RATE_LIMIT_WINDOW_MS,
    SIGNALING_LOGIN_RATE_LIMIT_MAX_REQUESTS,
  );
}

function deleteExpiredEntries(store, now) {
  for (const [key, value] of store) {
    const expiresAt = typeof value === "number" ? value : value.resetAt;
    if (expiresAt <= now) store.delete(key);
  }
}

function cleanupExpiredState() {
  const now = Date.now();
  deleteExpiredEntries(rateLimits, now);
  deleteExpiredEntries(loginRateLimits, now);
  deleteExpiredEntries(playerSessions, now);
  deleteExpiredEntries(accessSessions, now);
}

function enforceMapLimit(store) {
  while (store.size >= MAX_SESSION_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) return;
    store.delete(oldestKey);
  }
}

function cameraCatalog() {
  return cameraCatalogEntries.map(publicCamera);
}

function findCameraByStreamName(streamName) {
  return cameraCatalogEntries.find((camera) => camera.streamName === streamName) ?? null;
}

function isValidStreamName(streamName) {
  return /^[a-zA-Z0-9_-]{2,64}$/.test(streamName);
}

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function buildRtspUrl(body) {
  const directUrl = String(body.rtspUrl ?? "").trim();
  if (directUrl) return directUrl;

  const host = String(body.host ?? "").trim();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const port = String(body.port ?? "554").trim() || "554";
  const path = String(body.path ?? "").trim();
  if (!host || !path) return "";

  const auth =
    username || password
      ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
      : "";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `rtsp://${auth}${host}:${port}${normalizedPath}`;
}

function validateCameraInput(body) {
  const name = String(body.name ?? "").trim();
  const location = String(body.location ?? "").trim();
  const streamName = String(body.streamName ?? slugify(name).replaceAll("-", "_")).trim();
  const id = String(body.id ?? slugify(streamName.replaceAll("_", "-"))).trim();
  const rtspUrl = buildRtspUrl(body);

  if (!name) return { error: "Kamera adi zorunlu." };
  if (!isValidStreamName(streamName)) {
    return { error: "Stream adi 2-64 karakter olmali; harf, rakam, _ veya - kullan." };
  }
  if (!rtspUrl.startsWith("rtsp://") && !rtspUrl.startsWith("rtsps://")) {
    return { error: "RTSP adresi rtsp:// veya rtsps:// ile baslamali." };
  }
  if (cameraCatalogEntries.some((camera) => camera.streamName === streamName || camera.id === id)) {
    return { error: "Bu kamera veya stream adi zaten kayitli." };
  }

  return {
    camera: {
      id,
      name,
      location,
      streamName,
      rtspUrl,
    },
  };
}

function gatewayAuthHeaders() {
  return GO2RTC_API_USERNAME && GO2RTC_API_PASSWORD
    ? {
        Authorization: `Basic ${Buffer.from(
          `${GO2RTC_API_USERNAME}:${GO2RTC_API_PASSWORD}`,
          "utf8",
        ).toString("base64")}`,
      }
    : {};
}

function requestGateway({ method, path }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      callback();
    };
    const request = http.request(
      {
        host: GATEWAY_HOST,
        port: GATEWAY_API_PORT,
        path,
        method,
        headers: gatewayAuthHeaders(),
        timeout: GATEWAY_REQUEST_TIMEOUT_MS,
      },
      (gatewayResponse) => {
        const chunks = [];
        gatewayResponse.on("data", (chunk) => chunks.push(chunk));
        gatewayResponse.on("end", () => {
          settle(() => {
            resolve({
              statusCode: gatewayResponse.statusCode ?? 0,
              body: Buffer.concat(chunks).toString("utf8"),
            });
          });
        });
      },
    );
    request.on("timeout", () => {
      settle(() => reject(new Error("Gateway timeout")));
      request.destroy();
    });
    request.on("error", (error) => settle(() => reject(error)));
    request.end();
  });
}

async function addGatewayStream(camera) {
  const path =
    `/api/streams?name=${encodeURIComponent(camera.streamName)}` +
    `&src=${encodeURIComponent(camera.rtspUrl)}`;
  const response = await requestGateway({ method: "PUT", path });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Gateway stream eklenemedi: HTTP ${response.statusCode}`);
  }
}

async function createCamera(body) {
  const validation = validateCameraInput(body);
  if (validation.error) return { statusCode: 400, payload: { ok: false, error: validation.error } };

  const camera = validation.camera;
  await addGatewayStream(camera);
  cameraCatalogEntries = [...cameraCatalogEntries, camera];
  saveCameraCatalog();
  return {
    statusCode: 201,
    payload: {
      ok: true,
      camera: publicCamera(camera),
    },
  };
}

async function syncStoredGatewayStreams() {
  for (const camera of cameraCatalogEntries) {
    if (!camera.rtspUrl) continue;
    try {
      await addGatewayStream(camera);
      logEvent("camera-sync", { stream: camera.streamName });
    } catch {
      logEvent("camera-sync-failed", { stream: camera.streamName });
    }
  }
}

function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  return "";
}

function extractBasicCredentials(req) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== "string" || !authHeader.startsWith("Basic ")) return null;

  try {
    const decoded = Buffer.from(authHeader.slice("Basic ".length), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function tokensEqual(receivedToken, expectedToken) {
  const expected = Buffer.from(expectedToken, "utf8");
  const received = Buffer.from(receivedToken, "utf8");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function accessSessionExpiry(token) {
  if (!token) return false;

  const expiresAt = accessSessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    accessSessions.delete(token);
    return false;
  }

  return expiresAt;
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
        safeDecodeURIComponent(item.slice(separator + 1).trim()),
      ];
    }),
  );
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function playerSessionExpiry(req) {
  const sessionId = parseCookies(req)[PLAYER_SESSION_COOKIE];
  if (!sessionId) return false;

  const expiresAt = playerSessions.get(sessionId);
  if (!expiresAt || expiresAt <= Date.now()) {
    playerSessions.delete(sessionId);
    return false;
  }

  return expiresAt;
}

function authorizationExpiry(req, _url, { allowPlayerSession = false } = {}) {
  const receivedToken = extractBearerToken(req);
  if (tokensEqual(receivedToken, SIGNALING_AUTH_TOKEN)) return Infinity;

  const accessExpiry = accessSessionExpiry(receivedToken);
  if (accessExpiry) return accessExpiry;

  return allowPlayerSession ? playerSessionExpiry(req) : false;
}

function isAuthorized(req, url, options) {
  return Boolean(authorizationExpiry(req, url, options));
}

function isAdminAuthorized(req, url) {
  if (isAuthorized(req, url)) return true;

  const credentials = extractBasicCredentials(req);
  return credentials ? validLogin(credentials.username, credentials.password) : false;
}

function requestBasicAuth(res) {
  res.setHeader("WWW-Authenticate", 'Basic realm="Multitek Gateway"');
  writeJson(res, 401, { ok: false, error: "Unauthorized" });
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
  enforceMapLimit(accessSessions);
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
  enforceMapLimit(playerSessions);
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

function playerHtml(streamName, iceMode = "auto") {
  const nonce = crypto.randomBytes(18).toString("base64");
  const allIceServers = cameraCatalog()[0].iceServers;
  const matchesProtocol = (server, protocol) =>
    server.urls.some((serverUrl) => String(serverUrl).startsWith(`${protocol}:`));
  const iceServers =
    iceMode === "stun"
      ? allIceServers.filter((server) => matchesProtocol(server, "stun"))
      : iceMode === "turn"
        ? allIceServers.filter(
            (server) => matchesProtocol(server, "turn") || matchesProtocol(server, "turns"),
          )
        : allIceServers;
  const playerConfig = JSON.stringify({
    streamName,
    iceMode,
    iceServers,
    iceTransportPolicy: iceMode === "turn" ? "relay" : "all",
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
      let routeCheckTimer = null;

      function postToApp(payload) {
        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === "function") {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      async function reportSelectedRoute() {
        if (!peer) return false;
        const stats = await peer.getStats();
        let selectedPair = null;
        stats.forEach((report) => {
          if (report.type === "transport" && report.selectedCandidatePairId) {
            selectedPair = stats.get(report.selectedCandidatePairId) || selectedPair;
          }
        });
        if (!selectedPair) {
          stats.forEach((report) => {
            if (
              report.type === "candidate-pair" &&
              report.state === "succeeded" &&
              (report.nominated || report.selected)
            ) {
              selectedPair = report;
            }
          });
        }
        if (!selectedPair) return false;
        const local = stats.get(selectedPair.localCandidateId);
        const remote = stats.get(selectedPair.remoteCandidateId);
        const candidateType = String(
          config.iceTransportPolicy === "relay"
            ? "relay"
            : local?.candidateType || remote?.candidateType || "unknown",
        );
        postToApp({ type: "ice-route", candidateType, iceMode: config.iceMode });
        return candidateType !== "unknown";
      }

      function startRouteReporter() {
        if (routeCheckTimer) clearInterval(routeCheckTimer);
        let attempts = 0;
        const check = async () => {
          attempts += 1;
          const reported = await reportSelectedRoute().catch(() => false);
          if ((reported || attempts >= 20) && routeCheckTimer) {
            clearInterval(routeCheckTimer);
            routeCheckTimer = null;
          }
        };
        check();
        routeCheckTimer = setInterval(check, 1000);
      }

      function fail(message) {
        state.hidden = false;
        state.textContent = message;
        if (peer) peer.close();
      }

      async function startPeer() {
        peer = new RTCPeerConnection({
          bundlePolicy: "max-bundle",
          iceServers: config.iceServers,
          iceTransportPolicy: config.iceTransportPolicy,
        });
        peer.addTransceiver("video", { direction: "recvonly" });
        peer.addTransceiver("audio", { direction: "recvonly" });
        peer.ontrack = (event) => {
          video.srcObject = event.streams[0] || new MediaStream([event.track]);
          state.hidden = true;
          video.play().catch(() => {});
          startRouteReporter();
        };
        peer.onicecandidate = (event) => {
          socket.send(JSON.stringify({
            type: "webrtc/candidate",
            value: event.candidate ? event.candidate.candidate : "",
          }));
        };
        peer.onconnectionstatechange = () => {
          if (peer.connectionState === "failed") fail("WebRTC baglantisi kurulamadi.");
          if (peer.connectionState === "connected") {
            if (config.iceTransportPolicy === "relay") {
              postToApp({ type: "ice-route", candidateType: "relay", iceMode: config.iceMode });
            }
            startRouteReporter();
          }
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

function adminHtml() {
  const nonce = crypto.randomBytes(18).toString("base64");
  return {
    nonce,
    html: `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Gateway Kamera Paneli</title>
  <style nonce="${nonce}">
    :root{color-scheme:light;--bg:#f5f7fa;--panel:#fff;--text:#172033;--muted:#627086;--border:#d9e0ea;--accent:#1167b1;--danger:#b42318;--ok:#087443}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    header{border-bottom:1px solid var(--border);background:#fff}main,header>div{width:min(1040px,calc(100% - 32px));margin:0 auto}
    header>div{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 0}h1{font-size:22px;margin:0}p{margin:4px 0 0;color:var(--muted)}
    main{display:grid;grid-template-columns:minmax(280px,380px) 1fr;gap:18px;padding:22px 0 40px}
    section{background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:18px}h2{font-size:16px;margin:0 0 14px}
    label{display:grid;gap:6px;margin:0 0 12px;font-size:13px;font-weight:650}input{width:100%;height:40px;border:1px solid var(--border);border-radius:6px;padding:8px 10px;font:inherit}
    input:focus{outline:2px solid rgba(17,103,177,.22);border-color:var(--accent)}button{height:40px;border:0;border-radius:6px;background:var(--accent);color:#fff;font-weight:700;padding:0 14px;cursor:pointer}
    button:disabled{opacity:.55;cursor:wait}.hint{font-size:12px;color:var(--muted)}.status{min-height:20px;margin-top:12px;font-size:13px}.status.error{color:var(--danger)}.status.ok{color:var(--ok)}
    table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--border);vertical-align:top}th{font-size:12px;color:var(--muted);font-weight:700}
    code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}.empty{color:var(--muted);padding:18px 8px}
    @media (max-width:760px){main{grid-template-columns:1fr}header>div{align-items:flex-start;flex-direction:column}table{display:block;overflow-x:auto;white-space:nowrap}}
  </style>
</head>
<body>
  <header>
    <div>
      <div>
        <h1>Gateway Kamera Paneli</h1>
        <p>Yeni kamerayı go2rtc'ye ekler ve mobil katalogda görünür hale getirir.</p>
      </div>
      <button id="refresh" type="button">Yenile</button>
    </div>
  </header>
  <main>
    <section>
      <h2>Yeni kamera</h2>
      <form id="camera-form">
        <label>Kamera adı<input name="name" required autocomplete="off" placeholder="Depo Kamera"></label>
        <label>Konum<input name="location" autocomplete="off" placeholder="Depo giriş"></label>
        <label>Stream adı<input name="streamName" required autocomplete="off" pattern="[A-Za-z0-9_-]{2,64}" placeholder="depo_kamera"></label>
        <label>RTSP adresi<input name="rtspUrl" required autocomplete="off" placeholder="rtsp://user:pass@192.168.1.20:554/live"></label>
        <div class="hint">RTSP bilgisi sadece server katalog dosyasında tutulur; mobil uygulamaya dönmez.</div>
        <button id="submit" type="submit">Kamerayı ekle</button>
        <div id="status" class="status"></div>
      </form>
    </section>
    <section>
      <h2>Kamera kataloğu</h2>
      <div id="camera-list" class="empty">Yükleniyor...</div>
    </section>
  </main>
  <script nonce="${nonce}">
    const form = document.getElementById("camera-form");
    const status = document.getElementById("status");
    const submit = document.getElementById("submit");
    const list = document.getElementById("camera-list");
    const refresh = document.getElementById("refresh");

    function setStatus(message, kind) {
      status.textContent = message;
      status.className = "status" + (kind ? " " + kind : "");
    }

    function render(cameras) {
      if (!cameras.length) {
        list.className = "empty";
        list.textContent = "Kamera bulunamadı.";
        return;
      }
      list.className = "";
      list.innerHTML = "<table><thead><tr><th>Ad</th><th>Konum</th><th>Stream</th></tr></thead><tbody>" +
        cameras.map((camera) => "<tr><td>" + escapeHtml(camera.name) + "</td><td>" +
          escapeHtml(camera.location || "-") + "</td><td><code>" +
          escapeHtml(camera.streamName) + "</code></td></tr>").join("") +
        "</tbody></table>";
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[char]));
    }

    async function loadCameras() {
      const response = await fetch("/cameras", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Katalog okunamadı.");
      render(payload.cameras || []);
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = true;
      setStatus("Kamera ekleniyor...", "");
      const body = Object.fromEntries(new FormData(form).entries());
      try {
        const response = await fetch("/admin/cameras", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Kamera eklenemedi.");
        form.reset();
        setStatus("Kamera eklendi. Mobil katalog yenilendiğinde listede görünecek.", "ok");
        await loadCameras();
      } catch (error) {
        setStatus(error.message || "Kamera eklenemedi.", "error");
      } finally {
        submit.disabled = false;
      }
    });
    refresh.addEventListener("click", () => loadCameras().catch((error) => setStatus(error.message, "error")));
    loadCameras().catch((error) => setStatus(error.message, "error"));
  </script>
</body>
</html>`,
  };
}

function gatewayStatus(streamName, res) {
  let completed = false;
  const respond = (statusCode, payload) => {
    if (completed || res.headersSent) return;
    completed = true;
    writeJson(res, statusCode, payload);
  };
  const request = http.request(
    {
      host: GATEWAY_HOST,
      port: GATEWAY_API_PORT,
      path: "/api/streams",
      method: "GET",
      headers: gatewayAuthHeaders(),
      timeout: GATEWAY_REQUEST_TIMEOUT_MS,
    },
    (gatewayResponse) => {
      const chunks = [];
      gatewayResponse.on("data", (chunk) => chunks.push(chunk));
      gatewayResponse.on("end", () => {
        if (gatewayResponse.statusCode !== 200) {
          respond(502, { ok: false, error: "Gateway unavailable" });
          return;
        }

        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          const stream = payload[streamName];
          respond(200, {
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
          respond(502, { ok: false, error: "Invalid gateway response" });
        }
      });
    },
  );

  request.on("timeout", () => {
    respond(502, { ok: false, error: "Gateway unavailable" });
    request.destroy();
  });
  request.on("error", () => {
    respond(502, { ok: false, error: "Gateway unavailable" });
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

  const headers = gatewayAuthHeaders();

  const mediaSocket = new WebSocket(gatewayWebSocketUrl(client.room), {
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });
  client.mediaSocket = mediaSocket;

  mediaSocket.on("open", () => {
    if (client.mediaSocket !== mediaSocket) return;
    logEvent("media-bridge-open", {
      room: client.room,
      clientId: client.id.slice(0, 8),
    });
    for (const queued of client.mediaQueue.splice(0)) {
      mediaSocket.send(JSON.stringify(queued));
    }
  });

  mediaSocket.on("message", (raw) => {
    if (client.mediaSocket !== mediaSocket) return;
    try {
      const message = JSON.parse(raw.toString());
      const errorMessage =
        message.type === "error"
          ? String(message.message ?? message.value ?? "error").replace(/\s+/g, "_").slice(0, 120)
          : "";
      logEvent("media-bridge-message", {
        room: client.room,
        clientId: client.id.slice(0, 8),
        type: String(message.type ?? "unknown"),
        ...(errorMessage ? { error: errorMessage } : {}),
      });
      send(client.ws, message);
    } catch {
      send(client.ws, { type: "error", message: "Gateway gecersiz mesaj gonderdi." });
    }
  });

  mediaSocket.on("error", () => {
    logEvent("media-bridge-error", {
      room: client.room,
      clientId: client.id.slice(0, 8),
    });
    send(client.ws, {
      type: "error",
      message: "go2rtc media gateway baglantisi kurulamadi.",
    });
  });

  mediaSocket.on("close", () => {
    logEvent("media-bridge-close", {
      room: client.room,
      clientId: client.id.slice(0, 8),
    });
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

  if (!takeGeneralRateLimit(req)) {
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
        "Gateway kamera paneli icin /admin adresini kullanabilirsin.",
      ].join("\n"),
    );
    return;
  }

  if (url.pathname === "/admin") {
    if (!isAdminAuthorized(req, url)) {
      logEvent("unauthorized-admin", { ip: maskedIp, path: url.pathname });
      requestBasicAuth(res);
      return;
    }

    const page = adminHtml();
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'none'; script-src 'nonce-${page.nonce}'; style-src 'nonce-${page.nonce}'; ` +
        "connect-src 'self'; base-uri 'none'; form-action 'self'",
    );
    res.setHeader("Cache-Control", "no-store");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page.html);
    return;
  }

  if (url.pathname === "/admin/cameras") {
    if (!isAdminAuthorized(req, url)) {
      logEvent("unauthorized-admin", { ip: maskedIp, path: url.pathname });
      requestBasicAuth(res);
      return;
    }
    if (req.method !== "POST") {
      writeJson(res, 405, { ok: false, error: "Method not allowed" });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req, 16 * 1024);
    } catch {
      writeJson(res, 400, { ok: false, error: "Invalid request" });
      return;
    }

    try {
      const result = await createCamera(body);
      writeJson(res, result.statusCode, result.payload);
    } catch (error) {
      logEvent("camera-add-failed", { ip: maskedIp, error: maskValue(error.message) });
      writeJson(res, 502, { ok: false, error: "Gateway'e kamera eklenemedi." });
    }
    return;
  }

  if (url.pathname === "/auth/login") {
    if (req.method !== "POST") {
      writeJson(res, 405, { ok: false, error: "Method not allowed" });
      return;
    }

    if (!takeLoginRateLimit(req)) {
      logEvent("login-rate-limit", { ip: maskedIp });
      res.setHeader("Retry-After", String(Math.ceil(SIGNALING_LOGIN_RATE_LIMIT_WINDOW_MS / 1000)));
      writeJson(res, 429, { ok: false, error: "Too many login attempts" });
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
    if (!isAuthorized(req, url) && !isAdminAuthorized(req, url)) {
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
    if (!findCameraByStreamName(streamName)) {
      writeJson(res, 404, { ok: false, error: "Camera not found" });
      return;
    }

    const iceMode = String(url.searchParams.get("iceMode") ?? "auto").trim();
    if (!["auto", "stun", "turn"].includes(iceMode)) {
      writeJson(res, 400, { ok: false, error: "Invalid ICE mode" });
      return;
    }

    if (!playerSessionExpiry(req)) {
      createPlayerSession(req, res);
    }
    const player = playerHtml(streamName, iceMode);
    logEvent("player-open", { ip: maskedIp, stream: streamName, iceMode });
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
    if (!findCameraByStreamName(streamName)) {
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

const cleanupTimer = setInterval(cleanupExpiredState, SESSION_SWEEP_INTERVAL_MS);
cleanupTimer.unref();

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
  syncStoredGatewayStreams();
});

// WebSocket, WebRTC tarafinin teklif/cvp/ICE mesajlarini tasimasi icin kullanilir.
// HTTP sadece saglik ve room gozlemi icin açık bırakıldı.
const wss = new WebSocket.Server({ server, path: "/ws", maxPayload: 256 * 1024 });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "/ws", `http://${req.headers.host ?? "localhost"}`);
  const maskedIp = maskValue(clientIp(req));

  if (!takeGeneralRateLimit(req)) {
    logEvent("rate-limit-ws", { ip: maskedIp, path: url.pathname });
    ws.close(1013, "Rate limit");
    return;
  }

  const expiresAt = authorizationExpiry(req, url, { allowPlayerSession: true });
  if (!expiresAt) {
    logEvent("unauthorized-ws", { ip: maskedIp, path: url.pathname });
    ws.close(1008, "Unauthorized");
    return;
  }

  const expiryTimer = Number.isFinite(expiresAt)
    ? setTimeout(() => ws.close(1008, "Session expired"), Math.max(0, expiresAt - Date.now()))
    : null;
  expiryTimer?.unref();

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
      if (!findCameraByStreamName(roomName)) {
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
        name: client.name.replace(/\s+/g, "_"),
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
      logEvent("media-message", {
        room: client.room,
        clientId: clientId.slice(0, 8),
        type: message.type,
      });
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
    if (expiryTimer) clearTimeout(expiryTimer);
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
