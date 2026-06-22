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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response: Response;

  try {
    response = await fetch(`${signalingHttpBase(signalingUrl)}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    });
  } catch {
    throw new Error(
      signalingUrl.startsWith("ws://")
        ? "Signaling sunucusuna erisilemedi. Mobil veri icin public WSS adresi gerekir."
        : "Signaling sunucusuna erisilemedi. Ag baglantisini kontrol et.",
    );
  } finally {
    clearTimeout(timeout);
  }

  const payload = (await response.json()) as {
    accessToken?: string;
    expiresIn?: number;
    error?: string;
  };

  if (!response.ok || !payload.accessToken || !payload.expiresIn) {
    throw new Error(
      response.status === 401
        ? "Kullanici adi veya parola hatali."
        : response.status === 429
          ? "Cok fazla giris denemesi yapildi. Bir sure bekleyip tekrar dene."
          : payload.error || "Oturum acilamadi.",
    );
  }

  return {
    accessToken: payload.accessToken,
    expiresAt: Date.now() + payload.expiresIn * 1000,
  };
}
