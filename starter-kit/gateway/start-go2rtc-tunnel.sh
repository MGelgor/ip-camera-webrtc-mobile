#!/usr/bin/env bash
set -euo pipefail

GATEWAY_HOST="${GATEWAY_HOST:-10.1.1.3}"
GO2RTC_API_PORT="${GO2RTC_API_PORT:-1984}"
ORIGIN_URL="http://${GATEWAY_HOST}:${GO2RTC_API_PORT}"
CLOUDFLARED_PROTOCOL="${CLOUDFLARED_PROTOCOL:-http2}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared bulunamadi. macOS icin: brew install cloudflared"
  exit 1
fi

STATUS_CODE="$(curl -sS --max-time 3 -o /dev/null -w '%{http_code}' "${ORIGIN_URL}/api/streams" || true)"
if [[ "${STATUS_CODE}" != "200" && "${STATUS_CODE}" != "401" ]]; then
  echo "go2rtc gateway yanit vermiyor: ${ORIGIN_URL} (HTTP ${STATUS_CODE:-000})"
  exit 1
fi

echo "Gecici go2rtc HTTPS/WebSocket tunnel aciliyor: ${ORIGIN_URL}"
echo "Olusan https://...trycloudflare.com adresini GATEWAY_PUBLIC_BASE_URL olarak kullan."

exec cloudflared tunnel \
  --no-autoupdate \
  --protocol "${CLOUDFLARED_PROTOCOL}" \
  --edge-ip-version 4 \
  --url "${ORIGIN_URL}"
