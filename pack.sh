#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_NAME="larpadmin"

echo "Building frontend..."
cd "$SCRIPT_DIR/backend" && ./build.sh

echo "Packing $OUTPUT_NAME.zip..."
cd "$SCRIPT_DIR"
rm -rf "$OUTPUT_NAME" "$OUTPUT_NAME.zip"
cp -r backend "$OUTPUT_NAME"
zip -r "$OUTPUT_NAME.zip" "$OUTPUT_NAME" \
  -x "$OUTPUT_NAME/.venv/*" \
  -x "$OUTPUT_NAME/__pycache__/*" \
  -x "$OUTPUT_NAME/**/__pycache__/*" \
  -x "$OUTPUT_NAME/.pytest_cache/*" \
  -x "$OUTPUT_NAME/.ruff_cache/*" \
  -x "$OUTPUT_NAME/.coverage" \
  -x "$OUTPUT_NAME/*.egg-info/*"
rm -rf "$OUTPUT_NAME"

echo "Done! Created $OUTPUT_NAME.zip"
