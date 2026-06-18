#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

find_docker() {
  if [[ -n "${DOCKER_BIN:-}" && -x "${DOCKER_BIN}" ]]; then
    printf '%s\n' "${DOCKER_BIN}"
    return 0
  fi
  if command -v docker >/dev/null 2>&1; then
    command -v docker
    return 0
  fi
  local app_docker="/Applications/Docker.app/Contents/Resources/bin/docker"
  if [[ -x "${app_docker}" ]]; then
    printf '%s\n' "${app_docker}"
    return 0
  fi
  return 1
}

DOCKER_BIN="$(find_docker || true)"
if [[ -z "${DOCKER_BIN}" ]]; then
  echo "docker bulunamadi."
  exit 1
fi

export PATH="$(dirname "${DOCKER_BIN}"):/usr/local/bin:${PATH}"

cd "${SCRIPT_DIR}"
"${DOCKER_BIN}" compose down
