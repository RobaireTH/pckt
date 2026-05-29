#!/usr/bin/env bash
# Devnet + backend bring-up.
#
#   scripts/devnet.sh up      # start ckb + miner + backend
#   scripts/devnet.sh down    # stop all three
#   scripts/devnet.sh status  # report state + tip + indexer cursor
#   scripts/devnet.sh logs    # tail backend stdout
#
# State lives in .devnet/ (gitignored). Re-runnable.

set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DEV_DIR="$ROOT/.devnet"
BACKEND_LOG="$DEV_DIR/backend.log"
BACKEND_PID="$DEV_DIR/backend.pid"

mkdir -p "$DEV_DIR"

ckb_up() {
  if docker ps --format '{{.Names}}' | grep -q '^pckt-ckb$'; then
    echo "ckb already up"
  else
    docker run -d --name pckt-ckb --rm --entrypoint=ckb \
      -v "$DEV_DIR:/data" -w /data -p 8114:8114 -p 8115:8115 \
      nervos/ckb:latest run >/dev/null
    echo "ckb started"
    sleep 3
  fi
  if docker ps --format '{{.Names}}' | grep -q '^pckt-miner$'; then
    echo "miner already up"
  else
    docker run -d --name pckt-miner --rm --entrypoint=ckb \
      --network=container:pckt-ckb -v "$DEV_DIR:/data" -w /data \
      nervos/ckb:latest miner >/dev/null
    echo "miner started"
  fi
}

ckb_down() {
  for c in pckt-miner pckt-ckb; do
    if docker ps --format '{{.Names}}' | grep -q "^$c$"; then
      docker stop "$c" >/dev/null
      echo "$c stopped"
    fi
  done
}

backend_up() {
  if [ -f "$BACKEND_PID" ] && kill -0 "$(cat "$BACKEND_PID")" 2>/dev/null; then
    echo "backend already up (pid $(cat "$BACKEND_PID"))"
    return
  fi
  cd "$ROOT/backend"
  ENV_VARS=$(grep -v '^#' .env | xargs)
  cd "$ROOT"
  env $ENV_VARS nohup cargo run -p pckt-backend >"$BACKEND_LOG" 2>&1 &
  echo $! >"$BACKEND_PID"
  echo "backend started (pid $!), tailing $BACKEND_LOG"
}

backend_down() {
  if [ -f "$BACKEND_PID" ]; then
    pid=$(cat "$BACKEND_PID")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      echo "backend stopped (pid $pid)"
    fi
    rm -f "$BACKEND_PID"
  else
    echo "no backend pid file"
  fi
}

status() {
  echo "== docker =="
  docker ps --format '{{.Names}}\t{{.Status}}' | grep pckt || echo "no ckb containers"
  echo
  echo "== ckb =="
  if curl -s -X POST -H "Content-Type: application/json" \
      -d '{"id":1,"jsonrpc":"2.0","method":"get_tip_block_number","params":[]}' \
      http://127.0.0.1:8114 2>/dev/null | grep -q result; then
    tip=$(curl -s -X POST -H "Content-Type: application/json" \
        -d '{"id":1,"jsonrpc":"2.0","method":"get_tip_block_number","params":[]}' \
        http://127.0.0.1:8114 | python3 -c "import sys,json; print(int(json.load(sys.stdin)['result'],16))")
    echo "tip block: $tip"
  else
    echo "ckb rpc not reachable"
  fi
  echo
  echo "== backend =="
  if curl -s http://127.0.0.1:8181/healthz 2>/dev/null | grep -q ok; then
    curl -s http://127.0.0.1:8181/healthz; echo
  else
    echo "backend not reachable on :8181"
  fi
}

case "${1:-}" in
  up)   ckb_up; backend_up ;;
  down) backend_down; ckb_down ;;
  status) status ;;
  logs) tail -f "$BACKEND_LOG" ;;
  *) echo "usage: $0 {up|down|status|logs}"; exit 1 ;;
esac
