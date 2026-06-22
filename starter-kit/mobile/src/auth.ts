import { signalingHttpBase } from "./runtime";

export type SignalingSession = {
  accessToken: string;
  expiresAt: number;
};

export async function loginToSignaling(
  signalingUrl: string,
  username: string,
  password: string,
): Promise<SignalingSession> {
  const response = await fetch(`${signalingHttpBase(signalingUrl)}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const payload = (await response.json()) as {
    accessToken?: string;
    expiresIn?: number;
    error?: string;
  };

  if (!response.ok || !payload.accessToken || !payload.expiresIn) {
    throw new Error(
      response.status === 401
        ? "Kullanici adi veya parola hatali."
        : payload.error || "Oturum acilamadi.",
    );
  }

  return {
    accessToken: payload.accessToken,
    expiresAt: Date.now() + payload.expiresIn * 1000,
  };
}
