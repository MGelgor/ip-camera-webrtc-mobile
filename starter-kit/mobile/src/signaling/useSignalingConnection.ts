import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SignalingConnectionSnapshot, SignalingEvent } from "../types";

type SignalingOptions = {
  url: string;
  room: string;
  role: "viewer" | "publisher";
  name: string;
  authToken?: string | null;
  autoConnect?: boolean;
};

function openWebSocket(url: string, authToken?: string | null) {
  const ReactNativeWebSocket = WebSocket as unknown as new (
    socketUrl: string,
    protocols?: string | string[],
    options?: { headers?: Record<string, string> },
  ) => WebSocket;
  return new ReactNativeWebSocket(
    url,
    undefined,
    authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined,
  );
}

function now() {
  return new Date().toISOString();
}

function buildSummary(message: unknown) {
  if (typeof message === "string") {
    return message;
  }

  try {
    const encoded = JSON.stringify(message);
    return encoded.length > 160 ? `${encoded.slice(0, 157)}...` : encoded;
  } catch {
    return "Mesaj özetlenemedi.";
  }
}

function createEvent(
  direction: SignalingEvent["direction"],
  type: string,
  message: unknown,
): SignalingEvent {
  return {
    direction,
    type,
    summary: buildSummary(message),
    at: now(),
  };
}

// This hook is the first real client-side signaling step.
// It opens the WebSocket, joins a room, and keeps the current server state visible.
export function useSignalingConnection({
  url,
  room,
  role,
  name,
  authToken = null,
  autoConnect = true,
}: SignalingOptions) {
  const socketRef = useRef<WebSocket | null>(null);
  const closingByUserRef = useRef(false);
  const [snapshot, setSnapshot] = useState<SignalingConnectionSnapshot>({
    status: autoConnect ? "connecting" : "idle",
    serverUrl: url,
    room,
    role,
    name,
    clientId: null,
    members: 0,
    lastEvent: null,
    lastError: null,
  });

  const sync = useCallback((updater: (current: SignalingConnectionSnapshot) => SignalingConnectionSnapshot) => {
    setSnapshot((current) => updater(current));
  }, []);

  const disconnect = useCallback(() => {
    closingByUserRef.current = true;
    const socket = socketRef.current;

    if (!socket) {
      sync((current) => ({
        ...current,
        status: "disconnected",
        lastEvent: createEvent("system", "disconnect", "Bağlantı zaten kapalıydı."),
      }));
      return;
    }

    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }

    socketRef.current = null;
    sync((current) => ({
      ...current,
      status: "disconnected",
      lastEvent: createEvent("system", "disconnect", "Kullanıcı bağlantıyı kapattı."),
    }));
  }, [sync]);

  const connect = useCallback(() => {
    const existing = socketRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.CONNECTING || existing.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    closingByUserRef.current = false;

    const socket = openWebSocket(url, authToken);
    socketRef.current = socket;

    sync((current) => ({
      ...current,
      status: "connecting",
      serverUrl: url,
      room,
      role,
      name,
      lastError: null,
      lastEvent: createEvent("system", "connect", `Bağlantı deneniyor: ${url}`),
    }));

    socket.onopen = () => {
      const joinMessage = {
        type: "join",
        room,
        role,
        name,
      };

      socket.send(JSON.stringify(joinMessage));
      sync((current) => ({
        ...current,
        status: "connected",
        lastEvent: createEvent("outbound", "join", joinMessage),
      }));
    };

    socket.onmessage = (event) => {
      let parsed: Record<string, unknown>;

      try {
        parsed = JSON.parse(String(event.data)) as Record<string, unknown>;
      } catch {
        sync((current) => ({
          ...current,
          lastEvent: createEvent("inbound", "raw", event.data),
        }));
        return;
      }

      const type = String(parsed.type ?? "message");

      if (type === "connected") {
        sync((current) => ({
          ...current,
          clientId: typeof parsed.clientId === "string" ? parsed.clientId : current.clientId,
          lastEvent: createEvent("inbound", type, parsed),
        }));
        return;
      }

      if (type === "joined") {
        sync((current) => ({
          ...current,
          status: "connected",
          room: typeof parsed.room === "string" ? parsed.room : current.room,
          clientId: typeof parsed.clientId === "string" ? parsed.clientId : current.clientId,
          members: Array.isArray(parsed.members) ? parsed.members.length : current.members,
          lastEvent: createEvent("inbound", type, parsed),
        }));
        return;
      }

      if (type === "peer-joined") {
        sync((current) => ({
          ...current,
          members: current.members + 1,
          lastEvent: createEvent("inbound", type, parsed),
        }));
        return;
      }

      if (type === "peer-left") {
        sync((current) => ({
          ...current,
          members: Math.max(0, current.members - 1),
          lastEvent: createEvent("inbound", type, parsed),
        }));
        return;
      }

      if (type === "left") {
        sync((current) => ({
          ...current,
          members: 0,
          status: "disconnected",
          lastEvent: createEvent("inbound", type, parsed),
        }));
        return;
      }

      if (type === "error") {
        const errorText = String(parsed.message ?? "WebSocket hata verdi.");
        sync((current) => ({
          ...current,
          status: "error",
          lastError: errorText,
          lastEvent: createEvent("inbound", type, parsed),
        }));
        return;
      }

      sync((current) => ({
        ...current,
        lastEvent: createEvent("inbound", type, parsed),
      }));
    };

    socket.onerror = () => {
      sync((current) => ({
        ...current,
        status: "error",
        lastError: "WebSocket bağlantısı kurulamadı.",
        lastEvent: createEvent("system", "error", "WebSocket bağlantısı kurulamadı."),
      }));
    };

    socket.onclose = () => {
      socketRef.current = null;
      sync((current) => ({
        ...current,
        status: closingByUserRef.current ? "disconnected" : current.lastError ? "error" : "disconnected",
        lastEvent: createEvent(
          "system",
          "close",
          closingByUserRef.current ? "Bağlantı kullanıcı tarafından kapatıldı." : "WebSocket kapandı.",
        ),
      }));
    };
  }, [authToken, name, room, role, sync, url]);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      closingByUserRef.current = true;
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [autoConnect, connect]);

  return useMemo(
    () => ({
      ...snapshot,
      connect,
      disconnect,
    }),
    [connect, disconnect, snapshot],
  );
}
