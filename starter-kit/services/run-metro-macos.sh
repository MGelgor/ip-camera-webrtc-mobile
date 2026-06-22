#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STARTER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
MOBILE_DIR="${STARTER_DIR}/mobile"
ENV_FILE="${STARTER_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

source "${SCRIPT_DIR}/resolve-node-macos.sh"
if ! NODE_BIN_DIR="$(resolve_node_bin_dir)"; then
  echo "Node.js 20 veya daha yeni bir surum bulunamadi. NODE_BINARY ile yolu belirtin."
  exit 1
fi

if [[ ! -x "${MOBILE_DIR}/node_modules/.bin/expo" ]]; then
  echo "Expo bulunamadi. Once mobile dizininde npm ci calistir."
  exit 1
fi

export PATH="${NODE_BIN_DIR}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export ANDROID_SERIAL="${ANDROID_SERIAL:-emulator-5554}"
export EXPO_PUBLIC_SIGNALING_URL="${EXPO_PUBLIC_SIGNALING_URL:-ws://${SIGNALING_HOST:-10.0.2.2}:${SIGNALING_PORT:-3000}/ws}"

cd "${MOBILE_DIR}"
exec ./node_modules/.bin/expo start
