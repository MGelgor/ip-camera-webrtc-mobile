#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
STARTER_DIR="$(cd "${MOBILE_DIR}/.." && pwd)"
ENV_FILE="${STARTER_DIR}/.env"
GATEWAY_SERIAL="${ANDROID_GATEWAY_SERIAL:-10.1.1.3:5555}"
SIGNALING_URL_OVERRIDE="${EXPO_PUBLIC_SIGNALING_URL:-}"
NATIVE_WEBRTC_OVERRIDE="${EXPO_PUBLIC_NATIVE_WEBRTC_ENABLED:-}"
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi
[[ -n "${SIGNALING_URL_OVERRIDE}" ]] && EXPO_PUBLIC_SIGNALING_URL="${SIGNALING_URL_OVERRIDE}"
[[ -n "${NATIVE_WEBRTC_OVERRIDE}" ]] && EXPO_PUBLIC_NATIVE_WEBRTC_ENABLED="${NATIVE_WEBRTC_OVERRIDE}"

if [[ -z "${ANDROID_SERIAL:-}" ]]; then
  PHONE_SERIALS=()
  while IFS= read -r serial; do
    [[ -n "${serial}" ]] && PHONE_SERIALS+=("${serial}")
  done < <(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }' | grep -v -F "${GATEWAY_SERIAL}" || true)

  if [[ "${#PHONE_SERIALS[@]}" -ne 1 ]]; then
    echo "Bir fiziksel Android telefon bekleniyor; bulunan telefon sayisi: ${#PHONE_SERIALS[@]}"
    echo "USB hata ayiklamayi ac, telefonu bagla ve yetki penceresini onayla."
    adb devices -l
    exit 1
  fi

  ANDROID_SERIAL="${PHONE_SERIALS[0]}"
fi

export ANDROID_SERIAL
if [[ "${ANDROID_SERIAL}" == emulator-* ]]; then
  DEFAULT_SIGNALING_HOST="10.0.2.2"
else
  DEFAULT_SIGNALING_HOST="${SIGNALING_HOST:-10.0.2.128}"
fi
export EXPO_PUBLIC_SIGNALING_URL="${EXPO_PUBLIC_SIGNALING_URL:-ws://${DEFAULT_SIGNALING_HOST}:${SIGNALING_PORT:-3000}/ws}"
export EXPO_PUBLIC_NATIVE_WEBRTC_ENABLED="${EXPO_PUBLIC_NATIVE_WEBRTC_ENABLED:-false}"

cd "${MOBILE_DIR}"

if [[ ! -d node_modules ]]; then
  npm ci
fi

# React Native's Gradle plugins currently require an LTS JDK. On macOS, prefer
# the JDK bundled with Android Studio instead of a newer system Java runtime.
ANDROID_STUDIO_JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
if [[ "$(uname -s)" == "Darwin" && -x "${ANDROID_STUDIO_JAVA_HOME}/bin/java" ]]; then
  export JAVA_HOME="${ANDROID_JAVA_HOME:-${ANDROID_STUDIO_JAVA_HOME}}"
  export PATH="${JAVA_HOME}/bin:${PATH}"
fi

DEFAULT_ANDROID_SDK_ROOT="${HOME}/Library/Android/sdk"
if [[ -z "${ANDROID_HOME:-}" && -d "${DEFAULT_ANDROID_SDK_ROOT}" ]]; then
  export ANDROID_HOME="${DEFAULT_ANDROID_SDK_ROOT}"
fi
if [[ -n "${ANDROID_HOME:-}" ]]; then
  export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME}}"
  export PATH="${ANDROID_HOME}/platform-tools:${PATH}"
fi

echo "Android hedefi: ${ANDROID_SERIAL}"
echo "Signaling: ${EXPO_PUBLIC_SIGNALING_URL}"
echo "Native WebRTC: ${EXPO_PUBLIC_NATIVE_WEBRTC_ENABLED}"
echo "Java: $(java -version 2>&1 | head -n 1)"
echo "Android SDK: ${ANDROID_HOME:-tanimli degil}"

npx expo prebuild --platform android

# React Native 0.85 currently generates Gradle 9.3.1 while its bundled
# Foojay resolver 0.5.0 still needs the Gradle 8 API. AGP 8.12 supports 8.13.
WRAPPER_FILE="${MOBILE_DIR}/android/gradle/wrapper/gradle-wrapper.properties"
sed -i.bak 's/gradle-9\.3\.1-bin\.zip/gradle-8.13-bin.zip/' "${WRAPPER_FILE}"
rm -f "${WRAPPER_FILE}.bak"

exec npx expo run:android
