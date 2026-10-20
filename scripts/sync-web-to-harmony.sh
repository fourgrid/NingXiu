#!/bin/bash
# 把柠檬秀秀 H5 源码同步进鸿蒙工程的 rawfile/www
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$DIR/harmony/entry/src/main/resources/rawfile/www"
rm -rf "$DEST"
mkdir -p "$DEST"
cp "$DIR/index.html" "$DIR/style.css" "$DEST/"
cp -r "$DIR/js" "$DEST/"
echo "✅ 已同步到 $DEST"
