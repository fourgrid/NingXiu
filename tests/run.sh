#!/bin/bash
# 柠檬秀秀功能测试：headless Chrome 跑 tests/functional.html
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ ! -x "$CHROME" ] && { echo "需要安装 Chrome"; exit 1; }
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT=$(mktemp)
pkill -9 -f "Google Chrome.*headless" 2>/dev/null; sleep 1
"$CHROME" --headless=new --disable-gpu --user-data-dir="$(mktemp -d)/prof" \
  --virtual-time-budget=60000 --allow-file-access-from-files \
  --dump-dom "file://$DIR/functional.html" 2>/dev/null > "$OUT"
python3 - "$OUT" << 'PY'
import re, sys
raw = open(sys.argv[1]).read()
marks = re.findall(r'class="TRES">([^<]*)', raw)
fails = [m for m in marks if m.startswith('FAIL')]
print('\n'.join(marks))
print()
p = sum(1 for m in marks if m.startswith('PASS'))
print(f'PASS: {p} / FAIL: {len(fails)}')
sys.exit(1 if fails else 0)
PY
