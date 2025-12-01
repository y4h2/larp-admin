#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/../frontend"
STATIC_DIR="$SCRIPT_DIR/static"

# Load env vars from backend .env
if [ -f "$SCRIPT_DIR/.env" ]; then
  export $(grep -E '^VITE_' "$SCRIPT_DIR/.env" | xargs)
fi

echo "Building frontend..."
echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
cd "$FRONTEND_DIR" && npm run build

echo "Copying to backend/static..."
rm -rf "$STATIC_DIR"
cp -r "$FRONTEND_DIR/dist" "$STATIC_DIR"

echo "Build complete!"
