#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f "../.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "../.env"
  set +a
fi

if [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
  export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

./gradlew :app:assembleDebug

echo "APK: app/build/outputs/apk/debug/app-debug.apk"
