#!/usr/bin/env bash
set -euo pipefail

# scripts/backup-demo-db.sh
# Performs a full logical backup of the demo database into gitignored backups/ directory.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTPUT_FILE="${BACKUP_DIR}/revenue_guardian_demo_${TIMESTAMP}.sql"

mkdir -p "${BACKUP_DIR}"

echo "[BACKUP] Dumping revenue_guardian demo database to ${OUTPUT_FILE}..."

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "^rg-postgres$"; then
  docker exec -i rg-postgres pg_dump -U postgres -d revenue_guardian > "${OUTPUT_FILE}"
else
  PGPASSWORD="${PGPASSWORD:-postgres}" pg_dump -h "${PGHOST:-localhost}" -p "${PGPORT:-5433}" -U "${PGUSER:-postgres}" -d "${PGDATABASE:-revenue_guardian}" > "${OUTPUT_FILE}"
fi

echo "[BACKUP] Successfully created ${OUTPUT_FILE} ($(du -h "${OUTPUT_FILE}" | cut -f1))"
