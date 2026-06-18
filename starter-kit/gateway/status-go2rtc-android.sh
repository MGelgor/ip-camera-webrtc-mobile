#!/usr/bin/env bash
set -euo pipefail

DEVICE_SERIAL="${ANDROID_GATEWAY_SERIAL:-10.1.1.3:5555}"
DEVICE_WORKDIR="${ANDROID_GATEWAY_WORKDIR:-/data/local/tmp/staj-gateway}"
DEVICE_LOG="${DEVICE_WORKDIR}/go2rtc.log"
DEVICE_PID="${DEVICE_WORKDIR}/go2rtc.pid"
DEVICE_START_SCRIPT="${DEVICE_WORKDIR}/start-go2rtc-device.sh"

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

echo "PID dosyasi:"
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "cat ${DEVICE_PID} 2>/dev/null || echo pid-yok"

echo
echo "Start script:"
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "ls -l ${DEVICE_START_SCRIPT} 2>/dev/null || echo script-yok"

echo
echo "go2rtc process kontrolu:"
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "ps | grep go2rtc || true"

echo
echo "Son loglar:"
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "tail -n 30 ${DEVICE_LOG} 2>/dev/null || echo log-yok"
