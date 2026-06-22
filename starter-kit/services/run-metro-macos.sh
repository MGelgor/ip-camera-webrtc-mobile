#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STARTER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
MOBILE_DIR="${STARTER_DIR}/mobile"

NODE_BIN_DIR=""
for candidate in "${HOME}"/.nvm/versions/node/v20.*/bin; do
  if [[ -x "${candidate}/node" ]]; then
    NODE_BIN_DIR="${candidate}"
  fi
done

if [[ -z "${NODE_BIN_DIR}" ]]; then
  echo "Node.js 20 bulunamadi: ${HOME}/.nvm/versions/node/v20.*/bin/node"
  exit 1
fi

if [[ ! -x "${MOBILE_DIR}/node_modules/.bin/expo" ]]; then
  echo "Expo bulunamadi. Once mobile dizininde npm ci calistir."
  exit 1
fi

export PATH="${NODE_BIN_DIR}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export ANDROID_SERIAL="${ANDROID_SERIAL:-emulator-5554}"
export EXPO_PUBLIC_SIGNALING_URL="${EXPO_PUBLIC_SIGNALING_URL:-ws://10.0.2.2:3000/ws}"

cd "${MOBILE_DIR}"
exec ./node_modules/.bin/expo start
