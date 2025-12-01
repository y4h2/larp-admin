#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/../frontend"
STATIC_DIR="$SCRIPT_DIR/static"

# 确定使用哪个 env 文件
# 优先级: ENV_FILE 环境变量 > .env.production > .env
if [ -n "$ENV_FILE" ]; then
  ENV_PATH="$SCRIPT_DIR/$ENV_FILE"
elif [ -f "$SCRIPT_DIR/.env.production" ]; then
  ENV_PATH="$SCRIPT_DIR/.env.production"
elif [ -f "$SCRIPT_DIR/.env" ]; then
  ENV_PATH="$SCRIPT_DIR/.env"
else
  echo "Warning: No .env file found"
  ENV_PATH=""
fi

# Load VITE_ env vars
if [ -n "$ENV_PATH" ] && [ -f "$ENV_PATH" ]; then
  echo "Loading env from: $ENV_PATH"
  export $(grep -E '^VITE_' "$ENV_PATH" | xargs)
fi

echo "Building frontend..."
echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
cd "$FRONTEND_DIR" && npm run build

echo "Copying to backend/static..."
rm -rf "$STATIC_DIR"
cp -r "$FRONTEND_DIR/dist" "$STATIC_DIR"

echo "Build complete!"
