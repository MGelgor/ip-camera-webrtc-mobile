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

export async function fetchRuntimeCameraConfig(
  signalingUrl: string,
  fallbackCamera: CameraConfig,
  authToken?: string | null,
): Promise<CameraConfig> {
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
      gatewayAuthHeader?: string;
    }>;
  };

  const firstCamera = payload.cameras?.[0];
  if (!firstCamera?.streamName) {
    return fallbackCamera;
  }

  return {
    id: firstCamera.id ?? fallbackCamera.id,
    name: firstCamera.name ?? fallbackCamera.name,
    location: firstCamera.location ?? fallbackCamera.location,
    streamName: firstCamera.streamName,
    gatewayHost: firstCamera.gatewayHost ?? fallbackCamera.gatewayHost,
    gatewayAuthHeader: firstCamera.gatewayAuthHeader ?? fallbackCamera.gatewayAuthHeader,
  };
}
