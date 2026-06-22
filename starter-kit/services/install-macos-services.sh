#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STARTER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"
INSTALL_ROOT="${HOME}/Library/Application Support/ip-camera-webrtc-mobile"
INSTALLED_STARTER_DIR="${INSTALL_ROOT}/starter-kit"
INSTALLED_SERVICES_DIR="${INSTALLED_STARTER_DIR}/services"
LOG_DIR="${HOME}/Library/Logs/ip-camera-webrtc-mobile"
DOMAIN="gui/${UID}"

SIGNALING_LABEL="com.multitek.ip-camera.signaling"
METRO_LABEL="com.multitek.ip-camera.metro"
SIGNALING_PLIST="${LAUNCH_AGENTS_DIR}/${SIGNALING_LABEL}.plist"
METRO_PLIST="${LAUNCH_AGENTS_DIR}/${METRO_LABEL}.plist"

mkdir -p "${LAUNCH_AGENTS_DIR}" "${LOG_DIR}" "${INSTALLED_STARTER_DIR}"
if [[ ! -f "${STARTER_DIR}/.env" ]]; then
  echo "Gercek ortam dosyasi bulunamadi: ${STARTER_DIR}/.env" >&2
  echo "Once services/restore-env-macos.sh veya services/create-env-macos.sh kullanin." >&2
  exit 1
fi
if [[ "$(stat -f '%Lp' "${STARTER_DIR}/.env")" != "600" ]]; then
  echo "Guvenlik icin ${STARTER_DIR}/.env izni 600 olmalidir." >&2
  echo "Duzeltmek icin: chmod 600 '${STARTER_DIR}/.env'" >&2
  exit 1
fi

chmod 755 "${SCRIPT_DIR}/run-signaling-macos.sh" "${SCRIPT_DIR}/run-metro-macos.sh" \
  "${SCRIPT_DIR}/resolve-node-macos.sh"

# launchd cannot access projects under Desktop without additional macOS privacy
# permissions. Install a runtime copy under Application Support instead.
DEPENDENCY_SIGNATURE="$(
  shasum "${STARTER_DIR}/mobile/package-lock.json" "${STARTER_DIR}/server/package-lock.json" \
    | shasum \
    | awk '{ print $1 }'
)"
INSTALLED_SIGNATURE_FILE="${INSTALL_ROOT}/dependency-signature"

rsync -a --delete \
  --exclude '.DS_Store' \
  --exclude 'logs/' \
  --exclude 'mobile/.expo/' \
  --exclude 'mobile/android/' \
  --exclude 'mobile/node_modules/' \
  --exclude 'server/node_modules/' \
  "${STARTER_DIR}/" "${INSTALLED_STARTER_DIR}/"

INSTALLED_SIGNATURE=""
if [[ -f "${INSTALLED_SIGNATURE_FILE}" ]]; then
  INSTALLED_SIGNATURE="$(cat "${INSTALLED_SIGNATURE_FILE}")"
fi

if [[ "${INSTALLED_SIGNATURE}" != "${DEPENDENCY_SIGNATURE}" ]] \
  || [[ ! -d "${INSTALLED_STARTER_DIR}/mobile/node_modules" ]] \
  || [[ ! -d "${INSTALLED_STARTER_DIR}/server/node_modules" ]]; then
  rm -rf "${INSTALLED_STARTER_DIR}/mobile/node_modules" \
    "${INSTALLED_STARTER_DIR}/server/node_modules"
  cp -cR "${STARTER_DIR}/mobile/node_modules" "${INSTALLED_STARTER_DIR}/mobile/node_modules"
  cp -cR "${STARTER_DIR}/server/node_modules" "${INSTALLED_STARTER_DIR}/server/node_modules"
  printf '%s\n' "${DEPENDENCY_SIGNATURE}" >"${INSTALLED_SIGNATURE_FILE}"
fi

chmod 600 "${INSTALLED_STARTER_DIR}/.env"
chmod 755 "${INSTALLED_SERVICES_DIR}/run-signaling-macos.sh" \
  "${INSTALLED_SERVICES_DIR}/run-metro-macos.sh" \
  "${INSTALLED_SERVICES_DIR}/resolve-node-macos.sh"

write_plist() {
  local label="$1"
  local runner="$2"
  local working_directory="$3"
  local stdout_path="$4"
  local stderr_path="$5"
  local plist_path="$6"

  cat >"${plist_path}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${runner}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${working_directory}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>${stdout_path}</string>
  <key>StandardErrorPath</key>
  <string>${stderr_path}</string>
</dict>
</plist>
PLIST

  chmod 644 "${plist_path}"
  plutil -lint "${plist_path}" >/dev/null
}

write_plist \
  "${SIGNALING_LABEL}" \
  "${INSTALLED_SERVICES_DIR}/run-signaling-macos.sh" \
  "${INSTALLED_STARTER_DIR}/server" \
  "${LOG_DIR}/signaling.log" \
  "${LOG_DIR}/signaling-error.log" \
  "${SIGNALING_PLIST}"

write_plist \
  "${METRO_LABEL}" \
  "${INSTALLED_SERVICES_DIR}/run-metro-macos.sh" \
  "${INSTALLED_STARTER_DIR}/mobile" \
  "${LOG_DIR}/metro.log" \
  "${LOG_DIR}/metro-error.log" \
  "${METRO_PLIST}"

for label in "${SIGNALING_LABEL}" "${METRO_LABEL}"; do
  launchctl bootout "${DOMAIN}/${label}" >/dev/null 2>&1 || true
done
sleep 1

bootstrap_service() {
  local label="$1"
  local plist="$2"
  local attempt=""

  for attempt in 1 2 3; do
    if launchctl bootstrap "${DOMAIN}" "${plist}" >/dev/null 2>&1; then
      return 0
    fi
    if launchctl print "${DOMAIN}/${label}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "LaunchAgent bootstrap basarisiz: ${label}" >&2
  launchctl bootstrap "${DOMAIN}" "${plist}"
}

bootstrap_service "${SIGNALING_LABEL}" "${SIGNALING_PLIST}"
bootstrap_service "${METRO_LABEL}" "${METRO_PLIST}"
launchctl enable "${DOMAIN}/${SIGNALING_LABEL}"
launchctl enable "${DOMAIN}/${METRO_LABEL}"
launchctl kickstart -k "${DOMAIN}/${SIGNALING_LABEL}"
launchctl kickstart -k "${DOMAIN}/${METRO_LABEL}"

echo "macOS servisleri kuruldu:"
echo "  ${SIGNALING_LABEL}"
echo "  ${METRO_LABEL}"
echo "Calisma kopyasi: ${INSTALLED_STARTER_DIR}"
echo "Log dizini: ${LOG_DIR}"
