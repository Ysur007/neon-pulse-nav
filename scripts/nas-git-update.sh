#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$PROJECT_DIR"

if ! docker info >/dev/null 2>&1; then
  echo "Cannot access Docker daemon."
  echo "Run with sudo/root, or add the current user to the docker group."
  echo "Example: sudo sh scripts/nas-git-update.sh"
  exit 1
fi

if [ ! -d ".git" ]; then
  echo "This folder is not a git clone."
  exit 1
fi

echo "Pulling latest source..."
git pull --ff-only

mkdir -p data nas/transfer nas/music

echo "Rebuilding and restarting neon-pulse-nav..."
docker compose up -d --build

echo
echo "Update finished."
docker compose ps
echo "Port mapping:"
docker compose port neon-pulse-nav 3000 || true
