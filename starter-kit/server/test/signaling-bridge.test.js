const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");
const WebSocket = require("ws");

const SERVER_DIR = path.resolve(__dirname, "..");
const SIGNALING_TOKEN = "test-signaling-token-that-is-at-least-32-characters";
const LOGIN_USERNAME = "test-viewer";
const LOGIN_PASSWORD = "test-password-that-is-long-enough";

function openPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function waitForMessage(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("WebSocket message timeout"));
    }, 4000);

    function cleanup() {
      clearTimeout(timer);
      socket.off("message", onMessage);
      socket.off("error", onError);
    }

    function onMessage(raw) {
      const message = JSON.parse(raw.toString());
      if (!predicate(message)) return;
      cleanup();
      resolve(message);
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    socket.on("message", onMessage);
    socket.on("error", onError);
  });
}

function waitForClose(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebSocket close timeout")), 4000);
    socket.once("close", (code, reason) => {
      clearTimeout(timer);
      resolve({ code, reason: reason.toString() });
    });
    socket.once("error", () => {
      // The close event carries the authorization result.
    });
  });
}

function httpRequest(port, path, token = null, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: options.method ?? "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.headers ?? {}),
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    request.on("error", reject);
    if (options.body) request.write(JSON.stringify(options.body));
    request.end();
  });
}

async function httpJson(port, path, token = null, options = {}) {
  const response = await httpRequest(port, path, token, options);
  return {
    ...response,
    body: JSON.parse(response.body),
  };
}

test("viewer SDP and ICE are bridged to authenticated go2rtc", async (context) => {
  const gatewayPort = await openPort();
  const signalingPort = await openPort();
  const gatewayHttp = http.createServer((request, response) => {
    if (request.url === "/api/streams") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          ofis_kamera: {
            producers: [{ url: "rtsp://admin:secret@camera/live/main" }],
            consumers: [],
          },
        }),
      );
      return;
    }
    response.writeHead(404);
    response.end();
  });
  const gatewayWss = new WebSocket.Server({ server: gatewayHttp });
  let gatewayAuthorization = null;

  gatewayWss.on("connection", (socket, request) => {
    gatewayAuthorization = request.headers.authorization;
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === "webrtc/offer") {
        socket.send(JSON.stringify({ type: "webrtc/answer", value: "test-answer" }));
        socket.send(JSON.stringify({ type: "webrtc/candidate", value: "test-candidate" }));
      }
    });
  });

  await new Promise((resolve) => gatewayHttp.listen(gatewayPort, "127.0.0.1", resolve));
  context.after(() => gatewayHttp.close());

  const child = spawn(process.execPath, ["signaling-server.js"], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      SIGNALING_PORT: String(signalingPort),
      GATEWAY_HOST: "127.0.0.1",
      GO2RTC_API_PORT: String(gatewayPort),
      GO2RTC_API_USERNAME: "gateway-user",
      GO2RTC_API_PASSWORD: "gateway-pass",
      CAMERA_NAME: "ofis_kamera",
      SIGNALING_AUTH_TOKEN: SIGNALING_TOKEN,
      SIGNALING_AUTH_USERNAME: LOGIN_USERNAME,
      SIGNALING_AUTH_PASSWORD: LOGIN_PASSWORD,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  context.after(() => child.kill("SIGTERM"));

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Signaling startup timeout")), 4000);
    child.stdout.on("data", (chunk) => {
      if (!chunk.toString().includes("adresinde calisiyor")) return;
      clearTimeout(timer);
      resolve();
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Signaling exited early with code ${code}`));
    });
  });

  const unauthorizedHttp = await httpJson(signalingPort, "/cameras");
  assert.equal(unauthorizedHttp.statusCode, 401);
  assert.equal(unauthorizedHttp.body.error, "Unauthorized");

  const failedLogin = await httpJson(signalingPort, "/auth/login", null, {
    method: "POST",
    body: { username: LOGIN_USERNAME, password: "wrong-password" },
  });
  assert.equal(failedLogin.statusCode, 401);

  const login = await httpJson(signalingPort, "/auth/login", null, {
    method: "POST",
    body: { username: LOGIN_USERNAME, password: LOGIN_PASSWORD },
  });
  assert.equal(login.statusCode, 200);
  assert.equal(typeof login.body.accessToken, "string");
  assert.equal(login.body.expiresIn, 3600);
  const accessToken = login.body.accessToken;

  const authorizedHttp = await httpJson(signalingPort, "/cameras", accessToken);
  assert.equal(authorizedHttp.statusCode, 200);
  assert.equal(authorizedHttp.body.cameras[0].streamName, "ofis_kamera");
  assert.equal(authorizedHttp.body.cameras[0].playerPath, "/player?src=ofis_kamera");
  assert.equal("gatewayHost" in authorizedHttp.body.cameras[0], false);
  assert.equal("gatewayBaseUrl" in authorizedHttp.body.cameras[0], false);

  const unauthorizedPlayer = await httpRequest(
    signalingPort,
    "/player?src=ofis_kamera",
  );
  assert.equal(unauthorizedPlayer.statusCode, 401);

  const authorizedPlayer = await httpRequest(
    signalingPort,
    "/player?src=ofis_kamera",
    accessToken,
  );
  assert.equal(authorizedPlayer.statusCode, 200);
  assert.match(authorizedPlayer.headers["set-cookie"][0], /HttpOnly/);
  assert.match(authorizedPlayer.headers["content-security-policy"], /default-src 'none'/);
  assert.doesNotMatch(authorizedPlayer.body, /gateway-pass|admin:secret/);

  const playerCookie = authorizedPlayer.headers["set-cookie"][0].split(";")[0];
  const cookieCannotReadCatalog = await httpJson(signalingPort, "/cameras", null, {
    headers: { Cookie: playerCookie },
  });
  assert.equal(cookieCannotReadCatalog.statusCode, 401);

  const cookieSocket = new WebSocket(`ws://127.0.0.1:${signalingPort}/ws`, {
    headers: { Cookie: playerCookie },
  });
  context.after(() => cookieSocket.close());
  await waitForMessage(cookieSocket, (message) => message.type === "connected");

  const gatewayStatus = await httpJson(
    signalingPort,
    "/gateway/status?src=ofis_kamera",
    accessToken,
  );
  assert.equal(gatewayStatus.statusCode, 200);
  assert.equal(gatewayStatus.body.ofis_kamera.producers.length, 1);
  assert.doesNotMatch(JSON.stringify(gatewayStatus.body), /rtsp|admin|secret/);

  const unauthorizedSocket = new WebSocket(`ws://127.0.0.1:${signalingPort}/ws`);
  const unauthorizedClose = await waitForClose(unauthorizedSocket);
  assert.equal(unauthorizedClose.code, 1008);
  assert.equal(unauthorizedClose.reason, "Unauthorized");

  const queryTokenSocket = new WebSocket(
    `ws://127.0.0.1:${signalingPort}/ws?token=${encodeURIComponent(accessToken)}`,
  );
  const queryTokenClose = await waitForClose(queryTokenSocket);
  assert.equal(queryTokenClose.code, 1008);

  const mobile = new WebSocket(`ws://127.0.0.1:${signalingPort}/ws`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  context.after(() => mobile.close());
  await waitForMessage(mobile, (message) => message.type === "connected");

  mobile.send(
    JSON.stringify({
      type: "join",
      room: "ofis_kamera",
      role: "viewer",
      name: "integration-test",
    }),
  );
  await waitForMessage(mobile, (message) => message.type === "joined");

  const answerPromise = waitForMessage(
    mobile,
    (message) => message.type === "webrtc/answer",
  );
  const candidatePromise = waitForMessage(
    mobile,
    (message) => message.type === "webrtc/candidate",
  );
  mobile.send(JSON.stringify({ type: "webrtc/offer", value: "test-offer" }));
  const [answer, candidate] = await Promise.all([answerPromise, candidatePromise]);

  assert.equal(answer.value, "test-answer");
  assert.equal(candidate.value, "test-candidate");
  assert.equal(
    gatewayAuthorization,
    `Basic ${Buffer.from("gateway-user:gateway-pass").toString("base64")}`,
  );

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const retry = await httpJson(signalingPort, "/auth/login", null, {
      method: "POST",
      body: { username: LOGIN_USERNAME, password: "wrong-password" },
    });
    assert.equal(retry.statusCode, 401);
  }
  const rateLimitedLogin = await httpJson(signalingPort, "/auth/login", null, {
    method: "POST",
    body: { username: LOGIN_USERNAME, password: "wrong-password" },
  });
  assert.equal(rateLimitedLogin.statusCode, 429);
  assert.equal(rateLimitedLogin.body.error, "Too many login attempts");
});

test("server refuses to start without a strong signaling token", async () => {
  const signalingPort = await openPort();
  const child = spawn(process.execPath, ["signaling-server.js"], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      SIGNALING_PORT: String(signalingPort),
      SIGNALING_AUTH_TOKEN: "",
      SIGNALING_AUTH_USERNAME: LOGIN_USERNAME,
      SIGNALING_AUTH_PASSWORD: LOGIN_PASSWORD,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const result = await new Promise((resolve, reject) => {
    const stderr = [];
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Signaling configuration validation timeout"));
    }, 4000);

    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr: Buffer.concat(stderr).toString("utf8") });
    });
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /SIGNALING_AUTH_TOKEN zorunludur/);
});
