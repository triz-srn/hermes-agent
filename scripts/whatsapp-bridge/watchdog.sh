#!/usr/bin/env bash
set -uo pipefail

# Mavix WhatsApp watchdog: monitor the interactive profile bridge only.
# The default profile's WA bridge is intentionally monitor-only and is not
# restarted from this watchdog. Never restart a Hermes gateway from here.
STATE_DIR="${HERMES_HOME:-/root/.hermes}/runtime/whatsapp-watchdog"
STATE_FILE="$STATE_DIR/state"
LOCK_FILE="$STATE_DIR/lock"
HEALTH_URL="http://127.0.0.1:3001/health"
mkdir -p "$STATE_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

status="unknown"
if [[ -f "$STATE_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$STATE_FILE" || true
fi

payload="$(curl --silent --show-error --max-time 5 "$HEALTH_URL" 2>/dev/null || true)"
if [[ "$payload" == *'"status":"connected"'* ]]; then
  [[ "$status" == "down" ]] && logger -t hermes-whatsapp-watchdog -p daemon.notice -- "RECOVERED: Mavix WhatsApp bridge connected on 3001"
  printf 'failures=0\nstatus=healthy\n' > "$STATE_FILE"
  chmod 600 "$STATE_FILE"
  exit 0
fi

logger -t hermes-whatsapp-watchdog -p daemon.err -- "FAILED: Mavix WhatsApp bridge health check on 3001"
printf 'failures=1\nstatus=down\n' > "$STATE_FILE"
chmod 600 "$STATE_FILE"
# Fail closed: report only. Do not restart either gateway and do not alter
# the default monitor-only bridge.
exit 1
