#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
SERVER_FILE="${SCRIPT_DIR}/signaling-server.js"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo ".env dosyasi bulunamadi: ${ENV_FILE}"
  exit 1
fi

if [[ ! -d "${SCRIPT_DIR}/node_modules/ws" ]]; then
  npm install --prefix "${SCRIPT_DIR}"
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

SIGNALING_AUTH_TOKEN="${SIGNALING_AUTH_TOKEN:-}"
if [[ "${#SIGNALING_AUTH_TOKEN}" -lt 32 ]]; then
  echo "SIGNALING_AUTH_TOKEN zorunludur ve en az 32 karakter olmalidir."
  echo "Yeni token uretmek icin: openssl rand -hex 32"
  exit 1
fi

SIGNALING_AUTH_USERNAME="${SIGNALING_AUTH_USERNAME:-}"
SIGNALING_AUTH_PASSWORD="${SIGNALING_AUTH_PASSWORD:-}"
if [[ -z "${SIGNALING_AUTH_USERNAME}" || "${#SIGNALING_AUTH_PASSWORD}" -lt 12 ]]; then
  echo "SIGNALING_AUTH_USERNAME ve en az 12 karakterlik SIGNALING_AUTH_PASSWORD zorunludur."
  exit 1
fi

exec node "${SERVER_FILE}"
