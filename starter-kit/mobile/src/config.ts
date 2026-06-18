import { Platform } from "react-native";
import type { CameraConfig } from "./cameras";

// This file keeps runtime defaults in one place.
// We start with hard-coded local development values so the emulator can connect
// without any extra setup. Later, these defaults can be replaced by env values.
export function getSignalingDefaults(camera: CameraConfig) {
  const url = Platform.OS === "android" ? "ws://10.0.2.2:3000/ws" : "ws://localhost:3000/ws";

  return {
    // Android emulator cannot reach host localhost directly.
    // 10.0.2.2 maps back to the developer machine from the emulator.
    url,
    room: camera.streamName,
    role: "viewer" as const,
    name: "mobile-viewer",
    authToken: null as string | null,
  };
}
