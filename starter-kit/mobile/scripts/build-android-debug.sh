#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
STARTER_DIR="$(cd "${MOBILE_DIR}/.." && pwd)"
ENV_FILE="${STARTER_DIR}/.env"
SIGNALING_URL_OVERRIDE="${EXPO_PUBLIC_SIGNALING_URL:-}"
NATIVE_WEBRTC_OVERRIDE="${EXPO_PUBLIC_NATIVE_WEBRTC_ENABLED:-}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo ".env dosyasi bulunamadi: ${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a
[[ -n "${SIGNALING_URL_OVERRIDE}" ]] && EXPO_PUBLIC_SIGNALING_URL="${SIGNALING_URL_OVERRIDE}"
[[ -n "${NATIVE_WEBRTC_OVERRIDE}" ]] && EXPO_PUBLIC_NATIVE_WEBRTC_ENABLED="${NATIVE_WEBRTC_OVERRIDE}"

export NODE_ENV="${NODE_ENV:-development}"
export JAVA_HOME="${ANDROID_JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-${HOME}/Library/Android/sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME}}"
export PATH="${JAVA_HOME}/bin:${ANDROID_HOME}/platform-tools:${PATH}"
ANDROID_ABIS="${ANDROID_ABIS:-arm64-v8a}"

cd "${MOBILE_DIR}"
npx expo prebuild --platform android

WRAPPER_FILE="${MOBILE_DIR}/android/gradle/wrapper/gradle-wrapper.properties"
sed -i.bak 's/gradle-9\.3\.1-bin\.zip/gradle-8.13-bin.zip/' "${WRAPPER_FILE}"
rm -f "${WRAPPER_FILE}.bak"

# `gradle clean` can run native CMake cleanup before React Native codegen has
# recreated its generated JNI directories. Rerunning tasks refreshes the JS
# bundle (including EXPO_PUBLIC_* values) without that ordering failure.
./android/gradlew -p android assembleDebug --rerun-tasks \
  -PreactNativeArchitectures="${ANDROID_ABIS}"

APK="${MOBILE_DIR}/android/app/build/outputs/apk/debug/app-debug.apk"
echo "APK hazir: ${APK}"
ls -lh "${APK}"
