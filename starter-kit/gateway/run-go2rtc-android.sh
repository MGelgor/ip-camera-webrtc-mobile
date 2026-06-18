#!/usr/bin/env bash
set -euo pipefail

# Android tabanli gateway cihazda go2rtc'yi arka planda baslatmak icin
# host bilgisayardan calisan yardimci script.
#
# Bu script mevcut mobil kodu etkilemez. Sadece:
# 1. uygun ARM64 binary'yi cihaza kopyalar
# 2. go2rtc.yaml dosyasini gunceller
# 3. gerekli env degerlerini cihaza aktarir
# 4. go2rtc'yi nohup ile log dosyasina yazarak baslatir

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
CONFIG_FILE="${SCRIPT_DIR}/go2rtc.yaml"
ANDROID_BIN="${GO2RTC_ANDROID_BIN:-${SCRIPT_DIR}/go2rtc_linux_arm64}"
DEVICE_SERIAL="${ANDROID_GATEWAY_SERIAL:-10.1.1.3:5555}"
DEVICE_HOST="${DEVICE_SERIAL%%:*}"
DEVICE_WORKDIR="${ANDROID_GATEWAY_WORKDIR:-/data/local/tmp/staj-gateway}"
DEVICE_BINARY="${DEVICE_WORKDIR}/go2rtc"
DEVICE_CONFIG="${DEVICE_WORKDIR}/go2rtc.yaml"
DEVICE_LOG="${DEVICE_WORKDIR}/go2rtc.log"
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

shell_quote() {
  local value="${1//\'/\'\"\'\"\'}"
  printf "'%s'" "${value}"
}

ADB_BIN="$(find_adb || true)"
if [[ -z "${ADB_BIN}" ]]; then
  echo "adb bulunamadi."
  echo "ADB_BIN degiskeni ile tam yol verebilir veya Android SDK platform-tools kurabilirsin."
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo ".env dosyasi bulunamadi: ${ENV_FILE}"
  exit 1
fi

if [[ ! -f "${CONFIG_FILE}" ]]; then
  echo "go2rtc config bulunamadi: ${CONFIG_FILE}"
  exit 1
fi

if [[ ! -x "${ANDROID_BIN}" ]]; then
  echo "Android ARM64 go2rtc binary bulunamadi veya calistirilabilir degil: ${ANDROID_BIN}"
  echo "Beklenen dosya: ${SCRIPT_DIR}/go2rtc_linux_arm64"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

required_vars=(
  CAMERA_USER
  CAMERA_PASSWORD
  CAMERA_IP
  CAMERA_PORT
  CAMERA_RTSP_MAIN_PATH
  GO2RTC_API_USERNAME
  GO2RTC_API_PASSWORD
  STUN_URL
  TURN_URL
  TURN_USER
  TURN_PASSWORD
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Eksik ortam degiskeni: ${var_name}"
    exit 1
  fi
done

echo "Android gateway cihaza baglaniliyor: ${DEVICE_SERIAL}"
"${ADB_BIN}" connect "${DEVICE_HOST}" >/dev/null 2>&1 || true

echo "Calisma klasoru hazirlaniyor: ${DEVICE_WORKDIR}"
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "mkdir -p ${DEVICE_WORKDIR}"

echo "Binary kopyalaniyor..."
"${ADB_BIN}" -s "${DEVICE_SERIAL}" push "${ANDROID_BIN}" "${DEVICE_BINARY}" >/dev/null

echo "Config kopyalaniyor..."
"${ADB_BIN}" -s "${DEVICE_SERIAL}" push "${CONFIG_FILE}" "${DEVICE_CONFIG}" >/dev/null

echo "Eski process temizleniyor..."
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "pkill go2rtc || true"

echo "Calisma izinleri veriliyor..."
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "chmod 755 ${DEVICE_BINARY}"

remote_command=$(
  cat <<EOF
cd $(shell_quote "${DEVICE_WORKDIR}") && \
export CAMERA_USER=$(shell_quote "${CAMERA_USER}") && \
export CAMERA_PASSWORD=$(shell_quote "${CAMERA_PASSWORD}") && \
export CAMERA_IP=$(shell_quote "${CAMERA_IP}") && \
export CAMERA_PORT=$(shell_quote "${CAMERA_PORT}") && \
export CAMERA_RTSP_MAIN_PATH=$(shell_quote "${CAMERA_RTSP_MAIN_PATH}") && \
export GO2RTC_API_USERNAME=$(shell_quote "${GO2RTC_API_USERNAME}") && \
export GO2RTC_API_PASSWORD=$(shell_quote "${GO2RTC_API_PASSWORD}") && \
export STUN_URL=$(shell_quote "${STUN_URL}") && \
export TURN_URL=$(shell_quote "${TURN_URL}") && \
export TURN_USER=$(shell_quote "${TURN_USER}") && \
export TURN_PASSWORD=$(shell_quote "${TURN_PASSWORD}") && \
nohup $(shell_quote "${DEVICE_BINARY}") -c $(shell_quote "${DEVICE_CONFIG}") > $(shell_quote "${DEVICE_LOG}") 2>&1 < /dev/null & \
echo \$! > $(shell_quote "${DEVICE_PID}")
EOF
)

echo "go2rtc Android cihazda arka planda baslatiliyor..."
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "${remote_command}"

sleep 2

echo
echo "Durum kontrolu:"
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "cat ${DEVICE_PID} 2>/dev/null || true"
"${ADB_BIN}" -s "${DEVICE_SERIAL}" shell "ls -l ${DEVICE_LOG} ${DEVICE_PID} 2>/dev/null || true"

echo
echo "Mac uzerinden kontrol etmek icin:"
echo "  curl http://${DEVICE_HOST}:1984/api/streams"
echo "  open http://${DEVICE_HOST}:1984"
