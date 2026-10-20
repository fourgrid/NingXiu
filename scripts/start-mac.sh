#!/bin/bash
# 柠檬秀秀 macOS 本地运行：起本地服务并打开浏览器
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8964}"
cd "$DIR"
echo "🍋 柠檬秀秀启动中: http://127.0.0.1:$PORT"
(sleep 1; open "http://127.0.0.1:$PORT") &
python3 -m http.server "$PORT"
