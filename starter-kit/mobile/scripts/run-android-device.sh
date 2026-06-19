#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
STARTER_DIR="$(cd "${MOBILE_DIR}/.." && pwd)"
ENV_FILE="${STARTER_DIR}/.env"
GATEWAY_SERIAL="${ANDROID_GATEWAY_SERIAL:-10.1.1.3:5555}"

unset npm_config_prefix

if [[ -n "${NVM_DIR:-}" && -s "${NVM_DIR}/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "${NVM_DIR}/nvm.sh"
fi

if command -v nvm >/dev/null 2>&1; then
  nvm use 20 >/dev/null
fi

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

# The physical-device workflow should not inherit the emulator-only 10.0.2.2 host.
GATEWAY_HOST="${ANDROID_GATEWAY_HOST:-${GATEWAY_SERIAL%%:*}}"

if [[ -z "${GO2RTC_API_USERNAME:-}" || -z "${GO2RTC_API_PASSWORD:-}" ]]; then
  REMOTE_START_SCRIPT="/data/local/tmp/staj-gateway/start-go2rtc-device.sh"
  REMOTE_EXPORTS="$(
    adb -s "${GATEWAY_SERIAL}" exec-out sh -c "cat ${REMOTE_START_SCRIPT}" 2>/dev/null \
      | grep -E '^export GO2RTC_API_(USERNAME|PASSWORD)=' || true
  )"

  if [[ -n "${REMOTE_EXPORTS}" ]]; then
    eval "${REMOTE_EXPORTS}"
  fi
fi

if [[ -z "${GATEWAY_HOST:-}" || -z "${GO2RTC_API_USERNAME:-}" || -z "${GO2RTC_API_PASSWORD:-}" ]]; then
  echo "GATEWAY_HOST, GO2RTC_API_USERNAME ve GO2RTC_API_PASSWORD zorunludur."
  exit 1
fi

if [[ -z "${ANDROID_SERIAL:-}" ]]; then
  PHONE_SERIALS=()
  while IFS= read -r serial; do
    [[ -n "${serial}" ]] && PHONE_SERIALS+=("${serial}")
  done < <(
    adb devices \
      | awk 'NR > 1 && $2 == "device" { print $1 }' \
      | grep -v -F "${GATEWAY_SERIAL}" \
      | grep -v '^emulator-' \
      || true
  )

  if [[ "${#PHONE_SERIALS[@]}" -ne 1 ]]; then
    echo "Bir fiziksel Android telefon bekleniyor; bulunan telefon sayisi: ${#PHONE_SERIALS[@]}"
    echo "USB hata ayiklamayi ac, telefonu bagla ve yetki penceresini onayla."
    adb devices -l
    exit 1
  fi

  ANDROID_SERIAL="${PHONE_SERIALS[0]}"
fi

if [[ "${ANDROID_SERIAL}" == emulator-* ]]; then
  echo "android:device sadece fiziksel telefon icindir: ${ANDROID_SERIAL}"
  exit 1
fi

if [[ -z "${EXPO_PUBLIC_SIGNALING_URL:-}" ]]; then
  if [[ -z "${SIGNALING_HOST:-}" ]] && command -v ipconfig >/dev/null 2>&1; then
    SIGNALING_HOST="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
  fi

  if [[ -z "${SIGNALING_HOST:-}" ]]; then
    echo "SIGNALING_HOST veya EXPO_PUBLIC_SIGNALING_URL zorunludur."
    exit 1
  fi

  EXPO_PUBLIC_SIGNALING_URL="ws://${SIGNALING_HOST}:${SIGNALING_PORT:-3000}/ws"
fi

export ANDROID_SERIAL
export EXPO_PUBLIC_GATEWAY_HOST="${GATEWAY_HOST}"
export EXPO_PUBLIC_GO2RTC_AUTH_HEADER="Basic $(printf '%s' "${GO2RTC_API_USERNAME}:${GO2RTC_API_PASSWORD}" | base64 | tr -d '\r\n')"
export EXPO_PUBLIC_GO2RTC_USERNAME="${GO2RTC_API_USERNAME}"
export EXPO_PUBLIC_GO2RTC_PASSWORD="${GO2RTC_API_PASSWORD}"
export EXPO_PUBLIC_SIGNALING_URL
export EXPO_PUBLIC_SIGNALING_AUTH_TOKEN="${SIGNALING_AUTH_TOKEN:-}"

cd "${MOBILE_DIR}"

if [[ ! -d node_modules ]]; then
  npm ci
fi

echo "Android hedefi: ${ANDROID_SERIAL}"
echo "Gateway: ${EXPO_PUBLIC_GATEWAY_HOST}:1984"
echo "Signaling: ${EXPO_PUBLIC_SIGNALING_URL}"

npx expo prebuild --platform android

# React Native 0.85 currently generates Gradle 9.3.1 while its bundled
# Foojay resolver 0.5.0 still needs the Gradle 8 API. AGP 8.12 supports 8.13.
WRAPPER_FILE="${MOBILE_DIR}/android/gradle/wrapper/gradle-wrapper.properties"
sed -i.bak 's/gradle-9\.3\.1-bin\.zip/gradle-8.13-bin.zip/' "${WRAPPER_FILE}"
rm -f "${WRAPPER_FILE}.bak"

exec npx expo run:android
