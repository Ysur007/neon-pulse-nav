#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$PROJECT_DIR"

if ! docker info >/dev/null 2>&1; then
  echo "Cannot access Docker daemon."
  echo "Run with sudo/root, or add the current user to the docker group."
  echo "Example: sudo sh scripts/nas-git-stop.sh"
  exit 1
fi

docker compose down
