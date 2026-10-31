#!/bin/sh
set -e

# ==============================================================================
# STUDYSYNC ZERO-DOWNTIME CANDIDATE DEPLOYMENT SCRIPT
# Ensures current working deployment is never destroyed before candidate verification
# ==============================================================================

IMAGE_TAG="${1:-latest}"
IMAGE_NAME="studysync:${IMAGE_TAG}"
PROD_CONTAINER="studysync-prod"
CANDIDATE_CONTAINER="studysync-candidate-${IMAGE_TAG}"
STAGING_PORT="3099"
PROD_PORT="${PORT:-3000}"

echo "=================================================="
echo "Starting deployment for image: ${IMAGE_NAME}"
echo "=================================================="

# 1. Ensure docker daemon is reachable
if ! docker info > /dev/null 2>&1; then
  echo "[ERROR] Docker daemon is not running or current user lacks permissions."
  exit 1
fi

# 2. Cleanup any dangling candidate containers from previous runs
docker rm -f "${CANDIDATE_CONTAINER}" > /dev/null 2>&1 || true

# 3. Start candidate container on staging port to validate health
echo "[STAGE] Starting candidate container on staging port ${STAGING_PORT}..."
docker run -d \
  --name "${CANDIDATE_CONTAINER}" \
  -p "${STAGING_PORT}:3000" \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DATABASE_PATH=/app/data/studysync.db \
  -v studysync-data:/app/data \
  -v studysync-uploads:/app/uploads \
  "${IMAGE_NAME}"

# 4. Probe candidate health endpoint
echo "[STAGE] Probing candidate health at http://localhost:${STAGING_PORT}/api/health..."
MAX_ATTEMPTS=20
ATTEMPT=1
HEALTHY=0

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  if curl -sf "http://localhost:${STAGING_PORT}/api/health" > /dev/null 2>&1; then
    echo "[SUCCESS] Candidate container is HEALTHY on attempt ${ATTEMPT}!"
    HEALTHY=1
    break
  fi
  echo "Attempt ${ATTEMPT}/${MAX_ATTEMPTS}: Candidate not ready yet, sleeping 2s..."
  sleep 2
  ATTEMPT=$((ATTEMPT + 1))
done

if [ $HEALTHY -ne 1 ]; then
  echo "[FATAL] Candidate container failed health check! Preserving current production deployment."
  echo "--- Candidate Logs ---"
  docker logs --tail 50 "${CANDIDATE_CONTAINER}" || true
  docker rm -f "${CANDIDATE_CONTAINER}" > /dev/null 2>&1 || true
  exit 1
fi

# 5. Candidate verified. Clean up candidate staging container
docker rm -f "${CANDIDATE_CONTAINER}" > /dev/null 2>&1

# 6. Backup existing production container tag for rollback if active
if docker ps -a --format '{{.Names}}' | grep -Eq "^${PROD_CONTAINER}\$"; then
  echo "[STAGE] Backing up current production container before switch..."
  docker commit "${PROD_CONTAINER}" studysync:rollback-backup > /dev/null 2>&1 || true
  docker stop "${PROD_CONTAINER}" > /dev/null 2>&1 || true
  docker rm "${PROD_CONTAINER}" > /dev/null 2>&1 || true
fi

# 7. Start new container on production port
echo "[STAGE] Launching new production container on port ${PROD_PORT}..."
docker run -d \
  --name "${PROD_CONTAINER}" \
  --restart unless-stopped \
  -p "${PROD_PORT}:3000" \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DATABASE_PATH=/app/data/studysync.db \
  -v studysync-data:/app/data \
  -v studysync-uploads:/app/uploads \
  "${IMAGE_NAME}"

# 8. Final verification on production port
sleep 3
if curl -sf "http://localhost:${PROD_PORT}/api/health" > /dev/null 2>&1; then
  echo "[SUCCESS] StudySync production deployment verified and live on port ${PROD_PORT}!"
  # Tag as current verified production release
  docker tag "${IMAGE_NAME}" studysync:current-production || true
  exit 0
else
  echo "[ERROR] Production container failed verification after switch! Triggering rollback..."
  ./scripts/rollback.sh || true
  exit 1
fi
