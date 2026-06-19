const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");
const WebSocket = require("ws");

const SERVER_DIR = path.resolve(__dirname, "..");

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

function waitForMessage(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("WebSocket message timeout"));
    }, 3000);

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

async function joinRoom(socket, room) {
  socket.send(JSON.stringify({ type: "join", room, role: "viewer", name: "test-viewer" }));
  return waitForMessage(socket, (message) => message.type === "joined" && message.room === room);
}

test("room switch and leave keep membership consistent", async (context) => {
  const port = await findOpenPort();
  const child = spawn(process.execPath, ["signaling-server.js"], {
    cwd: SERVER_DIR,
    env: { ...process.env, SIGNALING_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  context.after(() => {
    child.kill("SIGTERM");
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server startup timeout")), 3000);
    child.stdout.on("data", (chunk) => {
      if (!chunk.toString().includes("adresinde calisiyor")) return;
      clearTimeout(timer);
      resolve();
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited early with code ${code}`));
    });
  });

  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  context.after(() => socket.close());

  await waitForMessage(socket, (message) => message.type === "connected");
  await joinRoom(socket, "room-a");
  await joinRoom(socket, "room-b");

  let rooms = await getJson(`http://127.0.0.1:${port}/rooms`);
  assert.deepEqual(
    rooms.rooms.map((room) => ({ name: room.name, members: room.members.length })),
    [{ name: "room-b", members: 1 }],
  );

  socket.send(JSON.stringify({ type: "leave" }));
  await waitForMessage(socket, (message) => message.type === "left" && message.room === "room-b");
  await joinRoom(socket, "room-c");

  rooms = await getJson(`http://127.0.0.1:${port}/rooms`);
  assert.deepEqual(
    rooms.rooms.map((room) => ({ name: room.name, members: room.members.length })),
    [{ name: "room-c", members: 1 }],
  );
});
