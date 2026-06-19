#!/usr/bin/env sh
set -eu

# Expo, ADB'de hem emulator hem de Android gateway gorundugunde hedef cihazi
# karistirabiliyor. Bu script gelistirme oturumunu emulator'a sabitler.

ANDROID_SERIAL="${ANDROID_SERIAL:-emulator-5554}"
export ANDROID_SERIAL

unset npm_config_prefix

if [ -n "${NVM_DIR:-}" ] && [ -s "${NVM_DIR}/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "${NVM_DIR}/nvm.sh"
fi

if command -v nvm >/dev/null 2>&1; then
  nvm use 20 >/dev/null
fi

exec npx expo start --clear
