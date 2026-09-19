#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================================"
echo "  Antigravity-Plus 卸载与还原"
echo "========================================================"

if ! command -v node >/dev/null 2>&1; then
    echo "[错误] 未检测到 Node.js 环境。"
    exit 1
fi

node "$SCRIPT_DIR/core/patcher.js" --uninstall "$@"

echo "========================================================"
echo "  [√] 客户端已成功还原为官方原生英文状态！"
echo "========================================================"
