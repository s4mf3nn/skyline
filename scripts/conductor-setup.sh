#!/usr/bin/env zsh
# Prépare un workspace Conductor : dépendances, env et, si le projet a un docker-compose.yml à sa racine
# (service `postgres`), une base Postgres dédiée au workspace.
set -e

WS_NAME=$(basename "$CONDUCTOR_WORKSPACE_PATH" | tr -c 'a-zA-Z0-9\n' '_' | tr 'A-Z' 'a-z')
PROJECT=$(node -p "require('./package.json').name.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()")
DB_NAME="${PROJECT}_${WS_NAME}"
COMPOSE="$CONDUCTOR_ROOT_PATH/docker-compose.yml"

# pnpm n'est pas fourni avec Node (corepack absent des Node récents) : on l'installe
# à la version épinglée dans package.json si besoin.
if ! command -v pnpm >/dev/null 2>&1; then
  PNPM_VERSION=$(node -p "require('./package.json').packageManager.split('@')[1]")
  npm install -g "pnpm@${PNPM_VERSION}"
fi

pnpm install --frozen-lockfile || pnpm install

# .env partagé depuis la racine du repo (secrets hors git)
[ -f "$CONDUCTOR_ROOT_PATH/.env" ] && ln -sf "$CONDUCTOR_ROOT_PATH/.env" .env

# Postgres partagé entre workspaces, une base par workspace
if [ -f "$COMPOSE" ]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker introuvable : installe Docker Desktop, OrbStack ou Colima, puis relance le setup." >&2
    exit 1
  fi
  docker compose -f "$COMPOSE" up -d --wait postgres
  docker compose -f "$COMPOSE" exec -T postgres \
    psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  docker compose -f "$COMPOSE" exec -T postgres \
    psql -U postgres -c "CREATE DATABASE ${DB_NAME}"

  cat > .env.local <<ENV
DATABASE_URL=postgres://postgres:postgres@localhost:5432/${DB_NAME}
ENV
fi

# Ressource de données d'un autre fournisseur (branche de base hébergée, instance locale...) :
# le projet fournit scripts/workspace-data.sh, appelé avec « setup » (voir docs/adr/0001-stack.md)
if [ -x scripts/workspace-data.sh ]; then
  WORKSPACE_NAME="$WS_NAME" PROJECT_NAME="$PROJECT" ./scripts/workspace-data.sh setup
fi

# Migrations et fichiers générés (tolérant tant que le bootstrap n'est pas fait)
pnpm run --if-present db:migrate
pnpm run --if-present gen

echo "Workspace prêt : port ${CONDUCTOR_PORT}$([ -f "$COMPOSE" ] && echo ", base ${DB_NAME}")"
