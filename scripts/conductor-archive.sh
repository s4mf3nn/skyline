#!/usr/bin/env zsh
# Nettoie un workspace archivé : baux et, s'il y en a une, base dédiée.
WS_NAME=$(basename "$CONDUCTOR_WORKSPACE_PATH" | tr -c 'a-zA-Z0-9\n' '_' | tr 'A-Z' 'a-z')
PROJECT=$(node -p "require('./package.json').name.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()")
COMPOSE="$CONDUCTOR_ROOT_PATH/docker-compose.yml"
node scripts/lease.mjs release-workspace "$CONDUCTOR_WORKSPACE_PATH" || true
if [ -f "$COMPOSE" ]; then
  docker compose -f "$COMPOSE" exec -T postgres \
    psql -U postgres -c "DROP DATABASE IF EXISTS ${PROJECT}_${WS_NAME}" || true
fi
