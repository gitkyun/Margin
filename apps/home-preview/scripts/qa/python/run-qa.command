#!/bin/bash
# macOS 런처: 더블클릭 또는 ./run-qa.command --mode standard
# 미리보기 서버가 꺼져 있으면 켜고, 끝나면 이 스크립트가 켠 서버만 끕니다.
cd "$(dirname "$0")" || exit 1
HERE="$PWD"; APP="$(cd ../../.. && pwd)"; ROOT="$(cd ../../../../.. && pwd)"
PORT=5174; STARTED=""
[ -x "$HERE/.venv/bin/python" ] || { python3 -m venv "$HERE/.venv" && "$HERE/.venv/bin/pip" install -q -r "$HERE/requirements.txt" && "$HERE/.venv/bin/python" -m playwright install chromium webkit; }
if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/r"; then
  (cd "$APP" && VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npx vite --port $PORT --strictPort >/tmp/margin-qa-vite.log 2>&1 &) ; STARTED=1
  for _ in $(seq 1 40); do curl -s -o /dev/null "http://127.0.0.1:$PORT/r" && break; sleep 0.5; done
fi
ARGS=("$@"); [ ${#ARGS[@]} -eq 0 ] && ARGS=(--mode smoke)
cd "$ROOT" && "$HERE/.venv/bin/python" "$HERE/capture_all.py" "${ARGS[@]}"; CODE=$?
[ -n "$STARTED" ] && pkill -f "vite --port $PORT" 
open "$ROOT/qa-results/latest/index.html" 2>/dev/null
exit $CODE
