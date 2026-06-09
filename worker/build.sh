#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Installing dependencies..."
pip install -r requirements.txt pyinstaller

echo "Building worker binary..."
pyinstaller \
  --onefile \
  --name worker \
  --add-binary "$(which ffmpeg):." \
  --add-binary "$(which ffprobe):." \
  --hidden-import=googleapiclient \
  --hidden-import=google.auth \
  --hidden-import=google.oauth2 \
  worker.py

echo "Copying binary to desktop resources..."
mkdir -p "$SCRIPT_DIR/../desktop/resources"
cp dist/worker "$SCRIPT_DIR/../desktop/resources/worker"

echo "Done. Binary at desktop/resources/worker"