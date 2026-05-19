#!/bin/sh
# Pull the moderation model into rento-ollama (run from repo root after compose up).
set -e

COMPOSE_FILE="${1:-deploy/docker-compose.yml}"
MODEL="${MODERATION_LLM_MODEL:-llama3.1:8b}"

echo "Waiting for Ollama (compose: ${COMPOSE_FILE})..."
i=0
while [ "$i" -lt 60 ]; do
  if docker compose -f "${COMPOSE_FILE}" exec -T ollama ollama list >/dev/null 2>&1; then
    break
  fi
  i=$((i + 1))
  sleep 2
done

if ! docker compose -f "${COMPOSE_FILE}" exec -T ollama ollama list >/dev/null 2>&1; then
  echo "Ollama is not responding" >&2
  exit 1
fi

echo "Pulling model: ${MODEL} (this can take several minutes)..."
docker compose -f "${COMPOSE_FILE}" exec -T ollama ollama pull "${MODEL}"

echo "Installed models:"
docker compose -f "${COMPOSE_FILE}" exec -T ollama ollama list
