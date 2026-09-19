#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================================"
echo "  Antigravity-Plus 一键安装部署"
echo "========================================================"

if ! command -v node >/dev/null 2>&1; then
    echo "[错误] 未检测到 Node.js 环境，请先安装 Node.js (v16+) 后再运行。"
    exit 1
fi

node "$SCRIPT_DIR/core/patcher.js" --install "$@"

echo "========================================================"
echo "  [√] Antigravity-Plus 汉化已成功部署！"
echo "========================================================"
