import { Platform } from "react-native";
import type { CameraConfig } from "../cameras";

// go2rtc exposes its WebSocket-based WebRTC endpoint under /api/ws.
// In Android emulator, 10.0.2.2 points back to the development machine.
export function getGo2RtcDefaults(camera: CameraConfig) {
  // The active go2rtc gateway now runs on the smart intercom device instead of
  // the developer machine. Both emulator and desktop previews should point to
  // that fixed LAN address while we validate the gateway phase.
  const host = camera.gatewayHost ?? (Platform.OS === "android" ? "10.0.2.2" : "localhost");
  const encodedStreamName = encodeURIComponent(camera.streamName);

  return {
    // Native WebRTC endpoint. This stays here for the later phase where we
    // want to exchange SDP directly inside React Native.
    wsUrl: `ws://${host}:1984/api/ws?src=${encodedStreamName}`,

    // Stable preview endpoint. go2rtc already provides a browser player that
    // can play our RTSP camera through its own WebRTC/MSE/HLS pipeline.
    // In the Android emulator, 10.0.2.2 means "the Mac that runs the emulator".
    playerUrl: `http://${host}:1984/stream.html?src=${encodedStreamName}&mode=mse`,
    streamStatusUrl: `http://${host}:1984/api/streams`,
    requestHeaders: camera.gatewayAuthHeader ? { Authorization: camera.gatewayAuthHeader } : undefined,

    streamName: camera.streamName,
  };
}
