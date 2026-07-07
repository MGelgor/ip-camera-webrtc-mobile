#!/system/bin/sh

WORKDIR=/data/local/tmp/staj-gateway
BIN="$WORKDIR/ipcam-ssh-tunnel"
KEY_FILE="$WORKDIR/azure_tunnel_ed25519"
PID_FILE="$WORKDIR/azure-tunnel.pid"
LOG_FILE="$WORKDIR/azure-tunnel.log"

AZURE_SSH_HOST="${AZURE_SSH_HOST:-4.210.154.232:22}"
AZURE_SSH_USER="${AZURE_SSH_USER:-azureadmin}"
AZURE_HOST_KEY_SHA256="${AZURE_HOST_KEY_SHA256:-lOf578Xkd9/SoKGQLHt63pgbokKJfuto/wShkNCiI3c}"
REMOTE_ADDR="${REMOTE_ADDR:-127.0.0.1:1984}"
LOCAL_ADDR="${LOCAL_ADDR:-127.0.0.1:1984}"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG_FILE"
}

is_running() {
  pid="$(cat "$PID_FILE" 2>/dev/null)"
  [ -n "$pid" ] || return 1
  [ -d "/proc/$pid" ] || return 1
  tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -q ipcam-ssh-tunnel
}

mkdir -p "$WORKDIR"
cd "$WORKDIR" || exit 1

if is_running; then
  log "azure tunnel already running pid=$(cat "$PID_FILE" 2>/dev/null)"
  exit 0
fi

if [ ! -x "$BIN" ]; then
  log "missing tunnel binary: $BIN"
  exit 1
fi

if [ ! -f "$KEY_FILE" ]; then
  log "missing tunnel key: $KEY_FILE"
  exit 1
fi

rm -f "$PID_FILE"
log "starting azure reverse tunnel ssh=$AZURE_SSH_HOST remote=$REMOTE_ADDR local=$LOCAL_ADDR"
nohup "$BIN" \
  -ssh-host "$AZURE_SSH_HOST" \
  -ssh-user "$AZURE_SSH_USER" \
  -key "$KEY_FILE" \
  -host-key-sha256 "$AZURE_HOST_KEY_SHA256" \
  -remote "$REMOTE_ADDR" \
  -local "$LOCAL_ADDR" \
  >> "$LOG_FILE" 2>&1 &
echo "$!" > "$PID_FILE"
sleep 2

if is_running; then
  log "azure tunnel started pid=$(cat "$PID_FILE" 2>/dev/null)"
  exit 0
fi

log "azure tunnel start failed"
exit 1
