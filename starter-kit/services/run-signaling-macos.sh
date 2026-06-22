#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STARTER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

source "${SCRIPT_DIR}/resolve-node-macos.sh"
if ! NODE_BIN_DIR="$(resolve_node_bin_dir)"; then
  echo "Node.js 20 veya daha yeni bir surum bulunamadi. NODE_BINARY ile yolu belirtin."
  exit 1
fi

export PATH="${NODE_BIN_DIR}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
exec "${STARTER_DIR}/server/start-signaling.sh"
