#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$PROJECT_DIR"

if ! docker info >/dev/null 2>&1; then
  echo "Cannot access Docker daemon."
  echo "Run with sudo/root, or add the current user to the docker group."
  echo "Example: sudo sh scripts/nas-git-deploy.sh"
  exit 1
fi

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
  echo "Edit .env if you need to change NAS paths or port."
fi

mkdir -p data nas/transfer nas/music

echo "Building and starting neon-pulse-nav..."
docker compose up -d --build

echo
echo "Deployment finished."
docker compose ps
echo "Port mapping:"
docker compose port neon-pulse-nav 3000 || true
