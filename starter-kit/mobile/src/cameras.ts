// Camera definitions live in one place so screens do not hard-code stream names.
// Later this array can come from an API instead of being written by hand.
export type CameraConfig = {
  id: string;
  name: string;
  location: string;
  streamName: string;
  gatewayHost?: string;
  gatewayAuthHeader?: string;
  gatewayUsername?: string;
  gatewayPassword?: string;
};

export const CAMERAS: CameraConfig[] = [
  {
    id: "ofis-kamera",
    name: "Ofis Kamera",
    location: "Multitek test alani",
    streamName: "ofis_kamera",
    gatewayHost: process.env.EXPO_PUBLIC_GATEWAY_HOST?.trim() || undefined,
    gatewayAuthHeader: process.env.EXPO_PUBLIC_GO2RTC_AUTH_HEADER?.trim() || undefined,
    gatewayUsername: process.env.EXPO_PUBLIC_GO2RTC_USERNAME?.trim() || undefined,
    gatewayPassword: process.env.EXPO_PUBLIC_GO2RTC_PASSWORD?.trim() || undefined,
  },
];

export const DEFAULT_CAMERA = CAMERAS[0];
