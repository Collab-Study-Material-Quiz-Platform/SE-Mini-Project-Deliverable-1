#!/bin/bash
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/studyplatform}"
[ -z "$1" ] && echo "Usage: ./scripts/restore.sh backups/<file>.gz" && exit 1
mongorestore --uri="$MONGO_URI" --archive="$1" --gzip --drop
echo "Restore done"