#!/bin/bash
# Run this on the remote VPS to install sentinel updater cron
# Usage: PROJECT_ID=executive-brief bash install-sentinel.sh

PROJECT_ID="${1:-$PROJECT_ID}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -z "$PROJECT_ID" ]; then
  echo "Usage: PROJECT_ID=executive-brief bash install-sentinel.sh"
  exit 1
fi

# Add cron job: every 5 minutes update sentinel
CRON_CMD="*/5 * * * * PROJECT_ID=$PROJECT_ID SENTINEL_DIR=/home/administrator/aios-sentinels bash $SCRIPT_DIR/sentinel-updater.sh >> /tmp/sentinel-$PROJECT_ID.log 2>&1"
(crontab -l 2>/dev/null | grep -v "sentinel-$PROJECT_ID"; echo "$CRON_CMD") | crontab -
echo "[sentinel] cron installed for $PROJECT_ID"
