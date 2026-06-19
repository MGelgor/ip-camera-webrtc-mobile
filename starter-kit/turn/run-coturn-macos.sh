#!/usr/bin/env bash
set -euo pipefail

TURN_PORT="${TURN_PORT:-3478}"
TURN_MIN_PORT="${TURN_MIN_PORT:-48160}"
TURN_MAX_PORT="${TURN_MAX_PORT:-48200}"
TURN_REALM="${TURN_REALM:-ip-camera-webrtc-mobile}"
TURN_SERVER_NAME="${TURN_SERVER_NAME:-multitek-turn}"
TURN_DB_PATH="${TURN_DB_PATH:-${HOME}/Library/Application Support/ip-camera-webrtc-mobile/turnserver.sqlite}"

find_turnserver() {
  if command -v turnserver >/dev/null 2>&1; then
    command -v turnserver
    return
  fi

  local homebrew_turnserver="/opt/homebrew/opt/coturn/bin/turnserver"
  [[ -x "${homebrew_turnserver}" ]] && printf '%s\n' "${homebrew_turnserver}"
}

TURN_SERVER_BIN="$(find_turnserver)"
if [[ -z "${TURN_SERVER_BIN}" ]]; then
  echo "coturn bulunamadi. macOS icin: brew install coturn"
  exit 1
fi

TURN_RELAY_IP="${TURN_RELAY_IP:-$(ipconfig getifaddr en0 || true)}"
if [[ -z "${TURN_RELAY_IP}" ]]; then
  echo "TURN_RELAY_IP bulunamadi. Aktif ag arayuzunun IP adresini ver."
  exit 1
fi

TURN_PUBLIC_IP="${TURN_PUBLIC_IP:-$(curl -4 -fsS --max-time 8 https://api.ipify.org || true)}"
if [[ -z "${TURN_PUBLIC_IP}" ]]; then
  echo "TURN_PUBLIC_IP bulunamadi. Public IPv4 adresini ortam degiskeniyle ver."
  exit 1
fi

if [[ ! -f "${TURN_DB_PATH}" ]]; then
  echo "TURN kullanici veritabani bulunamadi. Once install-coturn-macos-service.sh calistir."
  exit 1
fi

EXTERNAL_IP="${TURN_PUBLIC_IP}"
if [[ "${TURN_PUBLIC_IP}" != "${TURN_RELAY_IP}" ]]; then
  EXTERNAL_IP="${TURN_PUBLIC_IP}/${TURN_RELAY_IP}"
fi

exec "${TURN_SERVER_BIN}" -n \
  --listening-port "${TURN_PORT}" \
  --listening-ip 0.0.0.0 \
  --relay-ip "${TURN_RELAY_IP}" \
  --external-ip "${EXTERNAL_IP}" \
  --fingerprint \
  --lt-cred-mech \
  --userdb "${TURN_DB_PATH}" \
  --realm "${TURN_REALM}" \
  --server-name "${TURN_SERVER_NAME}" \
  --min-port "${TURN_MIN_PORT}" \
  --max-port "${TURN_MAX_PORT}" \
  --no-multicast-peers \
  --no-tls \
  --no-dtls \
  --stale-nonce 600 \
  --log-file stdout \
  --simple-log
