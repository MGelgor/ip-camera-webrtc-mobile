#!/usr/bin/env bash
set -euo pipefail

# Run this from a machine that can reach the camera LAN gateway.
# It exposes Azure localhost:1984 to the private go2rtc gateway without making
# go2rtc public on the internet.

AZURE_SIGNALING_HOST="${AZURE_SIGNALING_HOST:-test.multitek.com.tr}"
AZURE_SIGNALING_USER="${AZURE_SIGNALING_USER:-azureadmin}"
AZURE_SSH_PORT="${AZURE_SSH_PORT:-22}"
REMOTE_BIND_HOST="${REMOTE_BIND_HOST:-127.0.0.1}"
REMOTE_GO2RTC_PORT="${REMOTE_GO2RTC_PORT:-1984}"
GATEWAY_HOST="${GATEWAY_HOST:-10.1.1.3}"
GO2RTC_API_PORT="${GO2RTC_API_PORT:-1984}"

exec ssh \
  -N \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -p "${AZURE_SSH_PORT}" \
  -R "${REMOTE_BIND_HOST}:${REMOTE_GO2RTC_PORT}:${GATEWAY_HOST}:${GO2RTC_API_PORT}" \
  "${AZURE_SIGNALING_USER}@${AZURE_SIGNALING_HOST}"

