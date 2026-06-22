#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
STARTER_DIR="$(cd "${MOBILE_DIR}/.." && pwd)"
ENV_FILE="${STARTER_DIR}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo ".env dosyasi bulunamadi: ${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

PUBLIC_HOST="${SIGNALING_PUBLIC_HOST:-${TURN_PUBLIC_IP:-}}"
PUBLIC_PORT="${SIGNALING_PUBLIC_PORT:-13000}"
if [[ -z "${PUBLIC_HOST}" ]]; then
  echo "SIGNALING_PUBLIC_HOST veya TURN_PUBLIC_IP tanimli olmalidir." >&2
  exit 1
fi

export EXPO_PUBLIC_SIGNALING_URL="ws://${PUBLIC_HOST}:${PUBLIC_PORT}/ws"
export EXPO_PUBLIC_NATIVE_WEBRTC_ENABLED="false"
"${SCRIPT_DIR}/build-android-debug.sh"

SOURCE_APK="${MOBILE_DIR}/android/app/build/outputs/apk/debug/app-debug.apk"
PUBLIC_APK="${MOBILE_DIR}/android/app/build/outputs/apk/debug/app-public-ws-debug.apk"
cp "${SOURCE_APK}" "${PUBLIC_APK}"

echo "UYARI: Bu APK test icin sifresiz public WS kullanir; production icin uygun degildir."
echo "Public test APK: ${PUBLIC_APK}"
