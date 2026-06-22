#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STARTER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

NODE_BIN_DIR=""
for candidate in "${HOME}"/.nvm/versions/node/v20.*/bin; do
  if [[ -x "${candidate}/node" ]]; then
    NODE_BIN_DIR="${candidate}"
  fi
done

if [[ -z "${NODE_BIN_DIR}" ]]; then
  echo "Node.js 20 bulunamadi: ${HOME}/.nvm/versions/node/v20.*/bin/node"
  exit 1
fi

export PATH="${NODE_BIN_DIR}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
exec "${STARTER_DIR}/server/start-signaling.sh"
