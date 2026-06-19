#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

set +e
output="$(
  ANDROID_SERIAL=emulator-5554 \
  GO2RTC_API_USERNAME=test-user \
  GO2RTC_API_PASSWORD=test-password \
  ANDROID_GATEWAY_HOST=10.1.1.3 \
  EXPO_PUBLIC_SIGNALING_URL=ws://127.0.0.1:3000/ws \
  bash "${SCRIPT_DIR}/run-android-device.sh" 2>&1
)"
status=$?
set -e

if [[ "${status}" -eq 0 ]]; then
  echo "run-android-device.sh emulator hedefini kabul etti."
  exit 1
fi

if [[ "${output}" != *"android:device sadece fiziksel telefon icindir"* ]]; then
  echo "Beklenen emulator reddetme mesaji alinmadi."
  echo "${output}"
  exit 1
fi

echo "android:device emulator hedefini dogru sekilde reddetti."
