#!/bin/bash
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/studyplatform}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
STAMP=$(date +%Y-%m-%d_%H-%M-%S)
mkdir -p "$BACKUP_DIR"
mongodump --uri="$MONGO_URI" --archive="$BACKUP_DIR/backup_$STAMP.gz" --gzip
ls -1t "$BACKUP_DIR"/backup_*.gz | tail -n +8 | xargs -r rm --
echo "Backup done: backup_$STAMP.gz"