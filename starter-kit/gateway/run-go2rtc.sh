#!/usr/bin/env bash
set -euo pipefail

# Bu script go2rtc'yi gateway klasorunden calistirmak icin kullanilir.
# Once .env dosyasini yukler, sonra go2rtc config dosyasini acikca vererek baslatir.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
CONFIG_FILE="${SCRIPT_DIR}/go2rtc.yaml"
GO2RTC_BIN="${GO2RTC_BIN:-${SCRIPT_DIR}/go2rtc}"

if [[ ! -x "${GO2RTC_BIN}" ]]; then
  if command -v go2rtc >/dev/null 2>&1; then
    GO2RTC_BIN="$(command -v go2rtc)"
  else
    echo "go2rtc bulunamadi."
    echo "Gateway klasorunde ./go2rtc binary'sini veya PATH icinde go2rtc komutunu bekliyorum."
    echo "Mevcut binary'yi kurduktan sonra script yeniden calistirilabilir."
    exit 1
  fi
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo ".env dosyasi bulunamadi: ${ENV_FILE}"
  echo "Ornek dosyayi .env olarak kopyalayip icini doldurman gerekiyor."
  exit 1
fi

# .env dosyasindaki degiskenleri mevcut shell'e aktar.
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

# go2rtc config'i environment degiskenlerinden RTSP URL uretir.
# Bu alanlardan biri bos kalirsa servis baslasa bile kamera okunamaz.
required_vars=(
  CAMERA_NAME
  CAMERA_IP
  CAMERA_PORT
  CAMERA_USER
  CAMERA_PASSWORD
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
    echo ".env dosyasini kontrol et: ${ENV_FILE}"
    exit 1
  fi
done

if [[ "${CAMERA_PASSWORD}" == "CHANGE_ME" ]]; then
  echo "CAMERA_PASSWORD hala ornek degerde gorunuyor."
  echo "Gercek kamera sifresini sadece .env dosyasina yazmalisin."
  exit 1
fi

echo "go2rtc baslatiliyor..."
echo "Config: ${CONFIG_FILE}"
echo "Env   : ${ENV_FILE}"

exec "${GO2RTC_BIN}" -c "${CONFIG_FILE}"
