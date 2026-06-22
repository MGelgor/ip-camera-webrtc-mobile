// Camera definitions live in one place so screens do not hard-code stream names.
// Later this array can come from an API instead of being written by hand.
export type IceServerConfig = {
  urls: string[];
  username?: string;
  credential?: string;
};

export type CameraConfig = {
  id: string;
  name: string;
  location: string;
  streamName: string;
  playerUrl?: string;
  streamStatusUrl?: string;
  iceServers?: IceServerConfig[];
};

export const CAMERAS: CameraConfig[] = [
  {
    id: "ofis-kamera",
    name: "Ofis Kamera",
    location: "Multitek test alani",
    streamName: "ofis_kamera",
    iceServers: [
      {
        urls: ["stun:stun.cloudflare.com:3478"],
      },
    ],
  },
];

export const DEFAULT_CAMERA = CAMERAS[0];
