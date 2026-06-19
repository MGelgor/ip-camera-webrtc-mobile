#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_LABEL="com.multitek.ip-camera-webrtc-mobile.coturn"
PLIST_PATH="${HOME}/Library/LaunchAgents/${SERVICE_LABEL}.plist"
LOG_DIR="${HOME}/Library/Logs/ip-camera-webrtc-mobile"
INSTALL_DIR="${HOME}/Library/Application Support/ip-camera-webrtc-mobile"
INSTALLED_RUNNER="${INSTALL_DIR}/run-coturn-macos.sh"
TURN_USER="${TURN_USER:-multitek}"
TURN_KEYCHAIN_SERVICE="${TURN_KEYCHAIN_SERVICE:-ip-camera-webrtc-mobile-coturn}"
TURN_REALM="${TURN_REALM:-ip-camera-webrtc-mobile}"
TURN_DB_PATH="${INSTALL_DIR}/turnserver.sqlite"

if ! command -v turnserver >/dev/null 2>&1 && [[ ! -x "/opt/homebrew/opt/coturn/bin/turnserver" ]]; then
  echo "coturn bulunamadi. Once: brew install coturn"
  exit 1
fi

if ! command -v turnadmin >/dev/null 2>&1; then
  echo "turnadmin bulunamadi. coturn kurulumunu kontrol et."
  exit 1
fi

mkdir -p "$(dirname "${PLIST_PATH}")" "${LOG_DIR}" "${INSTALL_DIR}"

if ! security find-generic-password -s "${TURN_KEYCHAIN_SERVICE}" -a "${TURN_USER}" -w >/dev/null 2>&1; then
  TURN_PASSWORD="$(openssl rand -hex 24)"
  security add-generic-password -U -s "${TURN_KEYCHAIN_SERVICE}" -a "${TURN_USER}" -w "${TURN_PASSWORD}" >/dev/null
fi

TURN_PASSWORD="$(security find-generic-password -s "${TURN_KEYCHAIN_SERVICE}" -a "${TURN_USER}" -w)"
turnadmin --add --db "${TURN_DB_PATH}" --user "${TURN_USER}" --realm "${TURN_REALM}" --password "${TURN_PASSWORD}"
chmod 600 "${TURN_DB_PATH}"
unset TURN_PASSWORD

install -m 0755 "${SCRIPT_DIR}/run-coturn-macos.sh" "${INSTALLED_RUNNER}"

cat >"${PLIST_PATH}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${INSTALLED_RUNNER}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/coturn.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/coturn-error.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/${UID}/${SERVICE_LABEL}" >/dev/null 2>&1 || true
sleep 1
service_loaded=false
for _attempt in 1 2 3 4 5; do
  if launchctl bootstrap "gui/${UID}" "${PLIST_PATH}" 2>/dev/null; then
    service_loaded=true
    break
  fi
  sleep 2
done
if [[ "${service_loaded}" != "true" ]]; then
  echo "coturn LaunchAgent yuklenemedi: ${SERVICE_LABEL}"
  exit 1
fi
launchctl kickstart -k "gui/${UID}/${SERVICE_LABEL}"

echo "coturn LaunchAgent kuruldu: ${SERVICE_LABEL}"
echo "TURN kullanicisi: ${TURN_USER}"
echo "Log: ${LOG_DIR}/coturn.log"
