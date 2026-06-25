#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${MOBILE_DIR}/.env.release"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Release ortam dosyasi bulunamadi: ${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

required=(
  EXPO_PUBLIC_SIGNALING_URL
  ANDROID_RELEASE_KEYSTORE_PATH
  ANDROID_RELEASE_STORE_PASSWORD
  ANDROID_RELEASE_KEY_ALIAS
  ANDROID_RELEASE_KEY_PASSWORD
)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Release build icin ${name} tanimli olmalidir." >&2
    exit 1
  fi
done

if [[ "${EXPO_PUBLIC_SIGNALING_URL}" != wss://*/ws ]]; then
  echo "Release signaling adresi wss:// ile baslamali ve /ws ile bitmelidir." >&2
  exit 1
fi

if [[ ! -f "${ANDROID_RELEASE_KEYSTORE_PATH}" ]]; then
  echo "Release keystore bulunamadi (icerik veya parola yazdirilmadi)." >&2
  exit 1
fi

export NODE_ENV=production
export EXPO_PUBLIC_NATIVE_WEBRTC_ENABLED="${EXPO_PUBLIC_NATIVE_WEBRTC_ENABLED:-false}"
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

./android/gradlew -p android assembleRelease --rerun-tasks \
  -PreactNativeArchitectures="${ANDROID_ABIS}"

APK="${MOBILE_DIR}/android/app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "${APK}" ]]; then
  echo "Release APK uretilmedi." >&2
  exit 1
fi

APKSIGNER="$(find "${ANDROID_HOME}/build-tools" -type f -name apksigner -print -quit)"
if [[ -z "${APKSIGNER}" ]]; then
  echo "Android SDK icinde apksigner bulunamadi." >&2
  exit 1
fi
"${APKSIGNER}" verify --verbose "${APK}" >/dev/null

echo "Imzali release APK hazir: ${APK}"
shasum -a 256 "${APK}"
