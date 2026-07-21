#!/bin/sh
# Daily backup job (doc 05): pg_dump + uploads tar to /backups, with retention.
# RPO target <= 24h. In real deployments /backups is mounted to storage OFF the
# app VPS. Runs forever, once per day.
set -eu

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

run_backup() {
  ts="$(date +%Y%m%d-%H%M%S)"
  echo "[backup] starting $ts"

  pg_dump --format=custom --file="/backups/db-${ts}.dump"
  echo "[backup] db dump written: db-${ts}.dump"

  if [ -d /data/uploads ]; then
    tar -czf "/backups/uploads-${ts}.tar.gz" -C /data uploads
    echo "[backup] uploads archived: uploads-${ts}.tar.gz"
  fi

  # Retention prune.
  find /backups -type f -name 'db-*.dump' -mtime "+${RETENTION_DAYS}" -delete || true
  find /backups -type f -name 'uploads-*.tar.gz' -mtime "+${RETENTION_DAYS}" -delete || true
  echo "[backup] done $ts (retention ${RETENTION_DAYS}d)"
}

# Backup once on start, then every 24h.
while true; do
  run_backup || echo "[backup] FAILED — will retry next cycle"
  sleep 86400
done
