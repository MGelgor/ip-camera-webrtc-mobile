#!/system/bin/sh

WORKDIR=/data/local/tmp/staj-gateway
START_SCRIPT="$WORKDIR/start-go2rtc-device.sh"
PID_FILE="$WORKDIR/go2rtc.pid"
LOG_FILE="$WORKDIR/autostart.log"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG_FILE"
}

is_running() {
  pid="$(cat "$PID_FILE" 2>/dev/null)"
  [ -n "$pid" ] || return 1
  [ -d "/proc/$pid" ] || return 1
  tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -q go2rtc
}

mkdir -p "$WORKDIR"
cd "$WORKDIR" || exit 1

if is_running; then
  log "go2rtc already running pid=$(cat "$PID_FILE" 2>/dev/null)"
  exit 0
fi

log "go2rtc not running, starting"
rm -f "$PID_FILE"
"$START_SCRIPT"
sleep 2

if is_running; then
  log "go2rtc started pid=$(cat "$PID_FILE" 2>/dev/null)"
  exit 0
fi

log "go2rtc start failed"
exit 1
