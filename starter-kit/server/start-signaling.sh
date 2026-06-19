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
  echo "Signaling bagimliliklari kuruluyor..."
  npm ci --prefix "${SCRIPT_DIR}"
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

exec node "${SERVER_FILE}"
