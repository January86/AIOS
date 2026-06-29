#!/bin/bash
# AIOS Sentinel Updater
# Run this on each monitored VPS via cron every 5 minutes
# It touches a sentinel file so AIOS knows the project is alive

SENTINEL_DIR="${SENTINEL_DIR:-/home/administrator/aios-sentinels}"
PROJECT_ID="${PROJECT_ID:-unknown}"
SENTINEL_FILE="$SENTINEL_DIR/$PROJECT_ID/heartbeat"

mkdir -p "$SENTINEL_DIR/$PROJECT_ID"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$SENTINEL_FILE"
echo "[sentinel] updated $PROJECT_ID at $(date)"
