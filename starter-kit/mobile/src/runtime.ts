import type { CameraConfig } from "./cameras";

export function signalingHttpBase(signalingUrl: string) {
  if (signalingUrl.startsWith("wss://")) {
    return `https://${signalingUrl.slice("wss://".length).replace(/\/ws$/, "")}`;
  }

  if (signalingUrl.startsWith("ws://")) {
    return `http://${signalingUrl.slice("ws://".length).replace(/\/ws$/, "")}`;
  }

  return signalingUrl.replace(/\/ws$/, "");
}

export async function fetchRuntimeCameras(
  signalingUrl: string,
  fallbackCameras: CameraConfig[],
  authToken?: string | null,
): Promise<CameraConfig[]> {
  const baseUrl = signalingHttpBase(signalingUrl);
  const response = await fetch(`${baseUrl}/cameras`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  });
  if (!response.ok) {
    throw new Error(`Camera catalog request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok?: boolean;
    cameras?: Array<{
      id?: string;
      name?: string;
      location?: string;
      streamName?: string;
      gatewayHost?: string;
      gatewayBaseUrl?: string;
      gatewayAuthHeader?: string;
    }>;
  };

  const fallbackById = new Map(fallbackCameras.map((camera) => [camera.id, camera]));
  const cameras = payload.cameras?.filter((camera) => camera.streamName) ?? [];
  if (cameras.length === 0) {
    return fallbackCameras;
  }

  return cameras.map((camera, index) => {
    const fallback = fallbackById.get(camera.id ?? "") ?? fallbackCameras[index] ?? fallbackCameras[0];
    return {
      id: camera.id ?? `camera-${index + 1}`,
      name: camera.name ?? fallback?.name ?? `Camera ${index + 1}`,
      location: camera.location ?? fallback?.location ?? "",
      streamName: camera.streamName!,
      gatewayHost: camera.gatewayHost ?? fallback?.gatewayHost,
      gatewayBaseUrl: camera.gatewayBaseUrl ?? fallback?.gatewayBaseUrl,
      gatewayAuthHeader: camera.gatewayAuthHeader ?? fallback?.gatewayAuthHeader,
      gatewayUsername: fallback?.gatewayUsername,
      gatewayPassword: fallback?.gatewayPassword,
    };
  });
}
