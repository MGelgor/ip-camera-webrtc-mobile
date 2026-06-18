#!/usr/bin/env bash
set -euo pipefail

# Installs a root-level Android boot hook for the Multitek gateway device.
# It keeps the vendor starapp.sh behavior and appends a small go2rtc autostart block.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVICE_SERIAL="${ANDROID_GATEWAY_SERIAL:-10.1.1.3:5555}"
DEVICE_HOST="${DEVICE_SERIAL%%:*}"
DEVICE_WORKDIR="${ANDROID_GATEWAY_WORKDIR:-/data/local/tmp/staj-gateway}"
DEVICE_ROOT_START="${DEVICE_WORKDIR}/start-go2rtc-root.sh"
DEVICE_BOOT_LOG="${DEVICE_WORKDIR}/boot-hook.log"
DEVICE_VENDOR_START="/system/bin/starapp.sh"
DEVICE_VENDOR_BACKUP="/system/bin/starapp.sh.staj.bak"
LOCAL_ROOT_START="${SCRIPT_DIR}/start-go2rtc-root.sh"

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

if [[ ! -f "${LOCAL_ROOT_START}" ]]; then
  echo "Root start wrapper bulunamadi: ${LOCAL_ROOT_START}"
  exit 1
fi

echo "Android gateway cihaza baglaniliyor: ${DEVICE_SERIAL}"
"${ADB_BIN}" connect "${DEVICE_HOST}" >/dev/null 2>&1 || true

echo "Root start wrapper cihaza kopyalaniyor..."
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "mkdir -p ${DEVICE_WORKDIR}"
"${ADB_BIN}" -s "${DEVICE_SERIAL}" push "${LOCAL_ROOT_START}" "${DEVICE_ROOT_START}" >/dev/null
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "chmod 755 ${DEVICE_ROOT_START}"

echo "Root wrapper test ediliyor..."
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "${DEVICE_ROOT_START}"

echo "System partition yazilabilir hale getiriliyor..."
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "mount -o remount,rw /system"

echo "Vendor start script yedekleniyor..."
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "if [ ! -f ${DEVICE_VENDOR_BACKUP} ]; then cp ${DEVICE_VENDOR_START} ${DEVICE_VENDOR_BACKUP}; chmod 755 ${DEVICE_VENDOR_BACKUP}; fi"

echo "Autostart hook kuruluyor..."
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "if grep -q 'staj-gateway-autostart begin' ${DEVICE_VENDOR_START}; then sed '/# staj-gateway-autostart begin/,/# staj-gateway-autostart end/d' ${DEVICE_VENDOR_START} > ${DEVICE_VENDOR_START}.tmp && cat ${DEVICE_VENDOR_START}.tmp > ${DEVICE_VENDOR_START} && rm -f ${DEVICE_VENDOR_START}.tmp; fi
cat >> ${DEVICE_VENDOR_START} <<'EOF'

# staj-gateway-autostart begin
(
  echo \"\$(date '+%Y-%m-%d %H:%M:%S') boot hook starting\"
  sleep 20
  /data/local/tmp/staj-gateway/start-go2rtc-root.sh
  echo \"\$(date '+%Y-%m-%d %H:%M:%S') boot hook finished rc=\$?\"
) > /data/local/tmp/staj-gateway/boot-hook.log 2>&1 &
# staj-gateway-autostart end
EOF
chmod 755 ${DEVICE_VENDOR_START}"

echo "System partition tekrar salt okunur hale getiriliyor..."
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "mount -o remount,ro /system"

echo
echo "Kurulum tamamlandi. Kontrol:"
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "tail -n 20 ${DEVICE_VENDOR_START}; echo; ls -l ${DEVICE_ROOT_START} ${DEVICE_VENDOR_BACKUP} ${DEVICE_VENDOR_START}; echo; ps | grep go2rtc || true; tail -n 10 ${DEVICE_WORKDIR}/autostart.log 2>/dev/null || true; tail -n 10 ${DEVICE_BOOT_LOG} 2>/dev/null || true"
