#!/bin/sh
set -e

# ==============================================================================
# STUDYSYNC AUTOMATED ROLLBACK SCRIPT
# Restores previous working container image if deployment fails health validation
# ==============================================================================

PROD_CONTAINER="studysync-prod"
BACKUP_IMAGE="studysync:rollback-backup"
PROD_PORT="${PORT:-3000}"

echo "[ROLLBACK] Initiating rollback to backup image ${BACKUP_IMAGE}..."

if ! docker image inspect "${BACKUP_IMAGE}" > /dev/null 2>&1; then
  echo "[ROLLBACK ERROR] No backup image found (${BACKUP_IMAGE}). Cannot auto-rollback."
  exit 1
fi

docker rm -f "${PROD_CONTAINER}" > /dev/null 2>&1 || true

docker run -d \
  --name "${PROD_CONTAINER}" \
  --restart unless-stopped \
  -p "${PROD_PORT}:3000" \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DATABASE_PATH=/app/data/studysync.db \
  -v studysync-data:/app/data \
  -v studysync-uploads:/app/uploads \
  "${BACKUP_IMAGE}"

sleep 3
if curl -sf "http://localhost:${PROD_PORT}/api/health" > /dev/null 2>&1; then
  echo "[ROLLBACK SUCCESS] Successfully restored previous working production container!"
  exit 0
else
  echo "[ROLLBACK FATAL] Rolled-back container failed health check. Manual inspection required."
  exit 1
fi
