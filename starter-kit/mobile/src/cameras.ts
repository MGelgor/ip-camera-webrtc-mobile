// Camera definitions live in one place so screens do not hard-code stream names.
// Later this array can come from an API instead of being written by hand.
export type CameraConfig = {
  id: string;
  name: string;
  location: string;
  streamName: string;
  gatewayHost?: string;
  gatewayAuthHeader?: string;
};

export const CAMERAS: CameraConfig[] = [
  {
    id: "ofis-kamera",
    name: "Ofis Kamera",
    location: "Multitek test alani",
    streamName: "ofis_kamera",
  },
];

export const DEFAULT_CAMERA = CAMERAS[0];
