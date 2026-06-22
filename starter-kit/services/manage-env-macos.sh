#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STARTER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${STARTER_DIR}/.env"
EXAMPLE_FILE="${STARTER_DIR}/.env.example"
BACKUP_DIR="${HOME}/Library/Application Support/ip-camera-webrtc-mobile/secrets"
BACKUP_FILE="${BACKUP_DIR}/starter-kit.env"

usage() {
  echo "Kullanim: $0 init|backup|restore|status [--force]"
}

file_status() {
  local path="$1"
  if [[ -f "${path}" ]]; then
    stat -f '%N mode=%Sp size=%z modified=%Sm' -t '%Y-%m-%d %H:%M:%S' "${path}"
  else
    echo "${path}: yok"
  fi
}

action="${1:-}"
force="${2:-}"
umask 077

case "${action}" in
  init)
    if [[ -e "${ENV_FILE}" && "${force}" != "--force" ]]; then
      echo "Mevcut .env korunuyor. Uzerine yazmak icin --force kullanin." >&2
      exit 1
    fi
    install -m 600 "${EXAMPLE_FILE}" "${ENV_FILE}"
    echo "Sablondan olusturuldu: ${ENV_FILE}"
    echo "Placeholder degerleri gercek secret'larla degistirmeden servisleri kurmayin."
    ;;
  backup)
    if [[ ! -f "${ENV_FILE}" ]]; then
      echo "Yedeklenecek .env bulunamadi: ${ENV_FILE}" >&2
      exit 1
    fi
    mkdir -p -m 700 "${BACKUP_DIR}"
    install -m 600 "${ENV_FILE}" "${BACKUP_FILE}"
    echo "Izinleri 600 olan yerel yedek guncellendi: ${BACKUP_FILE}"
    ;;
  restore)
    if [[ ! -f "${BACKUP_FILE}" ]]; then
      echo "Geri yuklenecek yedek bulunamadi: ${BACKUP_FILE}" >&2
      exit 1
    fi
    if [[ -e "${ENV_FILE}" && "${force}" != "--force" ]]; then
      echo "Mevcut .env korunuyor. Uzerine yazmak icin --force kullanin." >&2
      exit 1
    fi
    install -m 600 "${BACKUP_FILE}" "${ENV_FILE}"
    echo ".env guvenli yerel yedekten geri yuklendi."
    ;;
  status)
    file_status "${ENV_FILE}"
    file_status "${BACKUP_FILE}"
    ;;
  *)
    usage
    exit 1
    ;;
esac
