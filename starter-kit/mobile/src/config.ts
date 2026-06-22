import { Platform } from "react-native";
import type { CameraConfig } from "./cameras";

// This file keeps runtime defaults in one place.
// We start with hard-coded local development values so the emulator can connect
// without any extra setup. Later, these defaults can be replaced by env values.
export function getSignalingDefaults(camera: CameraConfig, authToken?: string | null) {
  const defaultUrl = Platform.OS === "android" ? "ws://10.0.2.2:3000/ws" : "ws://localhost:3000/ws";
  const url = process.env.EXPO_PUBLIC_SIGNALING_URL?.trim() || defaultUrl;

  return {
    // Android emulator cannot reach host localhost directly.
    // 10.0.2.2 maps back to the developer machine from the emulator.
    url,
    room: camera.streamName,
    role: "viewer" as const,
    name: "mobile-viewer",
    authToken: authToken ?? null,
  };
}
