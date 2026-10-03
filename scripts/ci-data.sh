#!/usr/bin/env bash
# Ressource de données d'un run de CI : appelle scripts/workspace-data.sh, le même script que le setup Conductor, avec
# un nom propre au run. La CI teste ainsi avec le fournisseur et le pilote de la production (ex. branche d'une base
# hébergée). Les variables écrites dans .env.local passent aux étapes suivantes du job, masquées dans les logs.
# Usage : scripts/ci-data.sh setup [suffixe] | archive
# Sans scripts/workspace-data.sh exécutable, ne fait rien. Variables lues : GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, GITHUB_ENV.
set -euo pipefail

if [ ! -x scripts/workspace-data.sh ]; then
  echo "Aucun scripts/workspace-data.sh : pas de ressource de données pour ce run."
  exit 0
fi

case "${1:-}" in
  setup)
    # Mêmes identifiants que scripts/conductor-setup.sh : minuscules, chiffres et underscores (ex. suffixe « node22.x »).
    SUFFIX=$(printf '%s' "${2:-}" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9' '_')
    WORKSPACE_NAME="ci_${GITHUB_RUN_ID}_${GITHUB_RUN_ATTEMPT}${SUFFIX:+_$SUFFIX}"
    PROJECT_NAME=$(node -p "require('./package.json').name.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()")
    export WORKSPACE_NAME PROJECT_NAME
    # Écrits avant la création : l'étape de suppression les retrouve même si la création échoue à mi-chemin.
    printf 'WORKSPACE_NAME=%s\nPROJECT_NAME=%s\n' "$WORKSPACE_NAME" "$PROJECT_NAME" >> "$GITHUB_ENV"
    ./scripts/workspace-data.sh setup
    [ -f .env.local ] || exit 0
    while IFS= read -r line || [ -n "$line" ]; do
      case "$line" in '' | '#'*) continue ;; esac
      echo "::add-mask::${line#*=}"
      echo "$line" >> "$GITHUB_ENV"
    done < .env.local
    ;;
  archive)
    # Rien à supprimer si setup n'a pas tourné ; code de retour ignoré, comme à l'archivage d'un workspace.
    [ -n "${WORKSPACE_NAME:-}" ] || exit 0
    ./scripts/workspace-data.sh archive || true
    ;;
  *)
    echo "Usage : scripts/ci-data.sh setup [suffixe] | archive" >&2
    exit 2
    ;;
esac
