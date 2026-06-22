#!/usr/bin/env bash
set -euo pipefail

SIGNALING_PORT="${SIGNALING_PORT:-3000}"
LOCAL_URL="http://127.0.0.1:${SIGNALING_PORT}"
CLOUDFLARED_PROTOCOL="${CLOUDFLARED_PROTOCOL:-http2}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared bulunamadi. macOS icin: brew install cloudflared"
  exit 1
fi

if ! curl -fsS --max-time 3 "${LOCAL_URL}/health" >/dev/null; then
  echo "Signaling server yanit vermiyor: ${LOCAL_URL}/health"
  echo "Once signaling server'i baslat."
  exit 1
fi

echo "Gecici HTTPS/WSS tunnel aciliyor: ${LOCAL_URL}"
echo "cloudflared ciktisindaki https://...trycloudflare.com adresini kullan."
echo "Mobil WebSocket adresi ayni hostun wss://.../ws halidir."

exec cloudflared tunnel \
  --no-autoupdate \
  --protocol "${CLOUDFLARED_PROTOCOL}" \
  --edge-ip-version 4 \
  --url "${LOCAL_URL}"
