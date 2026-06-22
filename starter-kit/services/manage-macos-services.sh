#!/usr/bin/env bash
set -euo pipefail

DOMAIN="gui/${UID}"
SIGNALING_LABEL="com.multitek.ip-camera.signaling"
METRO_LABEL="com.multitek.ip-camera.metro"
LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"

usage() {
  echo "Kullanim: $0 status|restart|stop|start|uninstall"
}

service_action() {
  local action="$1"
  local label="$2"

  case "${action}" in
    start)
      launchctl enable "${DOMAIN}/${label}"
      launchctl kickstart -k "${DOMAIN}/${label}"
      ;;
    stop)
      launchctl disable "${DOMAIN}/${label}"
      launchctl kill SIGTERM "${DOMAIN}/${label}" >/dev/null 2>&1 || true
      ;;
    restart)
      launchctl kickstart -k "${DOMAIN}/${label}"
      ;;
    status)
      launchctl print "${DOMAIN}/${label}" | grep -E 'state =|pid =|last exit code ='
      ;;
    uninstall)
      launchctl bootout "${DOMAIN}/${label}" >/dev/null 2>&1 || true
      rm -f "${LAUNCH_AGENTS_DIR}/${label}.plist"
      ;;
  esac
}

action="${1:-}"
case "${action}" in
  start|stop|restart|status|uninstall)
    service_action "${action}" "${SIGNALING_LABEL}"
    service_action "${action}" "${METRO_LABEL}"
    ;;
  *)
    usage
    exit 1
    ;;
esac
