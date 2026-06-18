#!/usr/bin/env bash
set -euo pipefail

DEVICE_SERIAL="${ANDROID_GATEWAY_SERIAL:-10.1.1.3:5555}"
DEVICE_WORKDIR="${ANDROID_GATEWAY_WORKDIR:-/data/local/tmp/staj-gateway}"
DEVICE_PID="${DEVICE_WORKDIR}/go2rtc.pid"

find_adb() {
  if [[ -n "${ADB_BIN:-}" && -x "${ADB_BIN}" ]]; then
    printf '%s\n' "${ADB_BIN}"
    return 0
  fi
  if command -v adb >/dev/null 2>&1; then
    command -v adb
    return 0
  fi
  local sdk_adb="${HOME}/Library/Android/sdk/platform-tools/adb"
  if [[ -x "${sdk_adb}" ]]; then
    printf '%s\n' "${sdk_adb}"
    return 0
  fi
  return 1
}

ADB_BIN="$(find_adb || true)"
if [[ -z "${ADB_BIN}" ]]; then
  echo "adb bulunamadi."
  exit 1
fi

"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "if [ -f ${DEVICE_PID} ]; then kill \$(cat ${DEVICE_PID}) 2>/dev/null || true; rm -f ${DEVICE_PID}; fi; pkill go2rtc || true"
echo "Android gateway uzerindeki go2rtc durduruldu."
