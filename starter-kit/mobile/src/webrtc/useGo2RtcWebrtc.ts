import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from "react-native-webrtc";

type WebRtcState = "idle" | "connecting" | "connected" | "closing" | "disconnected" | "error";

export type WebRtcSnapshot = {
  status: WebRtcState;
  wsUrl: string;
  streamName: string;
  remoteStreamUrl: string | null;
  lastError: string | null;
  lastMessage: string | null;
};

type Options = {
  wsUrl: string;
  streamName: string;
  autoConnect?: boolean;
  enabled?: boolean;
};

function timestamp() {
  return new Date().toISOString();
}

function summarize(message: unknown) {
  if (typeof message === "string") return message;
  try {
    const json = JSON.stringify(message);
    return json.length > 170 ? `${json.slice(0, 167)}...` : json;
  } catch {
    return "Mesaj özetlenemedi.";
  }
}

function safeState(status: WebRtcState, connected: boolean) {
  if (connected) return "connected";
  return status;
}

// This hook is the first real media layer.
// It talks directly to go2rtc's WebRTC WebSocket endpoint, creates an RTCPeerConnection,
// and exposes the remote stream URL for rendering in an RTCView.
export function useGo2RtcWebrtc({ wsUrl, streamName, autoConnect = true, enabled = true }: Options) {
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const closingByUserRef = useRef(false);
  const remoteDescriptionReadyRef = useRef(false);

  const [snapshot, setSnapshot] = useState<WebRtcSnapshot>({
    status: autoConnect && enabled ? "connecting" : "idle",
    wsUrl,
    streamName,
    remoteStreamUrl: null,
    lastError: null,
    lastMessage: null,
  });

  const sync = useCallback((updater: (current: WebRtcSnapshot) => WebRtcSnapshot) => {
    setSnapshot((current) => updater(current));
  }, []);

  const resetPeer = useCallback(() => {
    pendingCandidatesRef.current = [];
    remoteDescriptionReadyRef.current = false;
    remoteStreamRef.current = new MediaStream();
  }, []);

  const disconnect = useCallback(() => {
    closingByUserRef.current = true;

    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }

    const pc = pcRef.current;
    pcRef.current = null;
    if (pc) {
      pc.close();
    }

    resetPeer();
    sync((current) => ({
      ...current,
      status: "disconnected",
      remoteStreamUrl: null,
      lastMessage: `${timestamp()} · Bağlantı kapatıldı.`,
    }));
  }, [resetPeer, sync]);

  const connect = useCallback(() => {
    if (!enabled) {
      sync((current) => ({
        ...current,
        status: "idle",
        lastMessage: `${timestamp()} · Canlı ekran devre dışı.`,
      }));
      return;
    }

    const existingWs = wsRef.current;
    if (
      existingWs &&
      (existingWs.readyState === WebSocket.CONNECTING || existingWs.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    closingByUserRef.current = false;
    resetPeer();

    sync((current) => ({
      ...current,
      status: "connecting",
      wsUrl,
      streamName,
      remoteStreamUrl: null,
      lastError: null,
      lastMessage: `${timestamp()} · go2rtc bağlantısı deneniyor.`,
    }));

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;
    socket.onopen = async () => {
      if (closingByUserRef.current) return;

      const pc = new RTCPeerConnection({
        bundlePolicy: "max-bundle",
        iceServers: [
          {
            urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"],
          },
        ],
      });
      pcRef.current = pc;

      const pcAny = pc as any;

      pcAny.addEventListener("connectionstatechange", () => {
        const state = pc.connectionState;
        if (state === "connected") {
          sync((current) => ({
            ...current,
            status: "connected",
            lastMessage: `${timestamp()} · PeerConnection connected.`,
          }));
          return;
        }

        if (state === "disconnected" || state === "failed") {
          sync((current) => ({
            ...current,
            status: state === "failed" ? "error" : "disconnected",
            lastError: state === "failed" ? "PeerConnection failed." : current.lastError,
            lastMessage: `${timestamp()} · PeerConnection ${state}.`,
          }));
        }
      });

      pcAny.addEventListener("icecandidate", (event: any) => {
        if (!event.candidate) {
          socket.send(JSON.stringify({ type: "webrtc/candidate", value: "" }));
          return;
        }

        socket.send(
          JSON.stringify({
            type: "webrtc/candidate",
            value: event.candidate.toJSON().candidate,
          }),
        );
      });

      pcAny.addEventListener("track", (event: any) => {
        const track = event.track;
        remoteStreamRef.current.addTrack(track);
        sync((current) => ({
          ...current,
          remoteStreamUrl: remoteStreamRef.current.toURL(),
          lastMessage: `${timestamp()} · Track alındı: ${track.kind}`,
        }));
      });

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      socket.send(
        JSON.stringify({
          type: "webrtc/offer",
          value: offer.sdp,
        }),
      );

      sync((current) => ({
        ...current,
        lastMessage: `${timestamp()} · webrtc/offer gönderildi.`,
      }));
    };

    socket.onmessage = async (event) => {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(String(event.data)) as Record<string, unknown>;
      } catch {
        sync((current) => ({
          ...current,
          lastMessage: `${timestamp()} · Ham mesaj alındı.`,
        }));
        return;
      }

      const type = String(parsed.type ?? "message");

      if (type === "error") {
        const message = String(parsed.value ?? parsed.message ?? "go2rtc hata verdi.");
        sync((current) => ({
          ...current,
          status: "error",
          lastError: message,
          lastMessage: `${timestamp()} · error: ${message}`,
        }));
        return;
      }

      if (type === "webrtc/answer") {
        const pc = pcRef.current;
        if (!pc) return;

        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: "answer", sdp: String(parsed.value ?? "") }),
        );
        remoteDescriptionReadyRef.current = true;

        const candidates = pendingCandidatesRef.current.splice(0);
        for (const candidate of candidates) {
          try {
            await pc.addIceCandidate(candidate);
          } catch {
            // Keep the stream alive even if one queued candidate fails.
          }
        }

        sync((current) => ({
          ...current,
          status: "connected",
          lastMessage: `${timestamp()} · webrtc/answer alındı.`,
        }));
        return;
      }

      if (type === "webrtc/candidate") {
        const pc = pcRef.current;
        const candidateValue = String(parsed.value ?? "");
        if (!pc || !candidateValue) return;

        const candidate = new RTCIceCandidate({ candidate: candidateValue, sdpMid: "0" });
        if (!remoteDescriptionReadyRef.current) {
          pendingCandidatesRef.current.push(candidate);
          return;
        }

        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // Ignore invalid late candidates. The stream can still continue.
        }
        return;
      }

      sync((current) => ({
        ...current,
        lastMessage: `${timestamp()} · ${type}`,
      }));
    };

    socket.onerror = () => {
      sync((current) => ({
        ...current,
        status: "error",
        lastError: "go2rtc WebSocket bağlantısı kurulamadı.",
        lastMessage: `${timestamp()} · WebSocket error.`,
      }));
    };

    socket.onclose = () => {
      wsRef.current = null;
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      resetPeer();

      sync((current) => ({
        ...current,
        status: closingByUserRef.current ? "disconnected" : safeState(current.status, false),
        remoteStreamUrl: null,
        lastMessage: `${timestamp()} · WebSocket kapandı.`,
      }));
    };
  }, [enabled, resetPeer, streamName, sync, wsUrl]);

  useEffect(() => {
    if (enabled && autoConnect) {
      connect();
    }

    if (!enabled) {
      disconnect();
    }

    return () => {
      closingByUserRef.current = true;
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }

      const pc = pcRef.current;
      pcRef.current = null;
      if (pc) pc.close();
    };
  }, [autoConnect, connect, disconnect, enabled]);

  return useMemo(
    () => ({
      ...snapshot,
      connect,
      disconnect,
    }),
    [connect, disconnect, snapshot],
  );
}
