#!/usr/bin/env bash

# launchd does not load the user's interactive shell, so its PATH usually omits
# Homebrew and version managers. Resolve any modern local Node installation
# instead of pinning the service to one NVM major version.
resolve_node_bin_dir() {
  local candidate=""
  local node_bin=""
  local major=""
  local candidates=()

  if [[ -n "${NODE_BINARY:-}" ]]; then
    candidates+=("${NODE_BINARY}")
  fi
  candidates+=("/opt/homebrew/bin/node" "/usr/local/bin/node")

  shopt -s nullglob
  for candidate in "${HOME}"/.nvm/versions/node/*/bin/node \
    "${HOME}"/.volta/bin/node \
    "${HOME}"/.asdf/shims/node; do
    candidates+=("${candidate}")
  done
  shopt -u nullglob

  for candidate in "${candidates[@]}"; do
    [[ -x "${candidate}" ]] || continue
    major="$("${candidate}" -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || true)"
    if [[ "${major}" =~ ^[0-9]+$ ]] && (( major >= 20 )); then
      node_bin="$(cd "$(dirname "${candidate}")" && pwd)"
      printf '%s\n' "${node_bin}"
      return 0
    fi
  done

  return 1
}
