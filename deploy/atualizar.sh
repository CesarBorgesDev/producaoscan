#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

cd "$ROOT"

if [[ ! -d .git ]]; then
  echo "Erro: $ROOT nao e um repositorio git."
  echo "Clone o projeto antes de atualizar: https://github.com/CesarBorgesDev/producaoscan.git"
  exit 1
fi

echo "==> Atualizando arquivos do GitHub..."
git fetch origin
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git pull --ff-only origin "$BRANCH"

if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
  cp "$SCRIPT_DIR/env.example" "$SCRIPT_DIR/.env"
  echo "==> Criado deploy/.env a partir de env.example"
fi

echo "==> Recriando containers Docker..."
if [[ -f "$ROOT/docker-compose.yml" ]]; then
  docker compose -f "$ROOT/docker-compose.yml" down --remove-orphans >/dev/null 2>&1 || true
fi
docker compose -f "$COMPOSE_FILE" --project-directory "$SCRIPT_DIR" up --build -d --remove-orphans

echo "==> Containers"
docker compose -f "$COMPOSE_FILE" --project-directory "$SCRIPT_DIR" ps
echo
echo "Frontend: http://localhost:3001"
echo "Backend:  http://localhost:3000/docs"
echo "API:      http://localhost:3000/api/health"
