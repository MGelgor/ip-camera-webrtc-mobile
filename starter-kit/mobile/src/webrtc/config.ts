import type { CameraConfig } from "../cameras";
import { signalingHttpBase } from "../runtime";

// go2rtc exposes its WebSocket-based WebRTC endpoint under /api/ws.
// In Android emulator, 10.0.2.2 points back to the development machine.
export function getGo2RtcDefaults(
  camera: CameraConfig,
  signalingUrl: string,
  signalingAuthToken?: string | null,
) {
  const signalingBaseUrl = signalingHttpBase(signalingUrl).replace(/\/$/, "");
  const encodedStreamName = encodeURIComponent(camera.streamName);
  const requestHeaders = signalingAuthToken
    ? { Authorization: `Bearer ${signalingAuthToken}` }
    : undefined;

  return {
    wsUrl: signalingUrl,
    playerUrl: camera.playerUrl ?? `${signalingBaseUrl}/player?src=${encodedStreamName}`,
    streamStatusUrl:
      camera.streamStatusUrl ?? `${signalingBaseUrl}/gateway/status?src=${encodedStreamName}`,
    requestHeaders,

    streamName: camera.streamName,
    iceServers: camera.iceServers ?? [],
  };
}
