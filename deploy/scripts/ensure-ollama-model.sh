#!/bin/sh
# Pull the moderation model into rento-ollama (run from repo root after compose up).
set -e

COMPOSE_FILE="${1:-deploy/docker-compose.yml}"
MODEL="${MODERATION_LLM_MODEL:-llama3.1:8b}"

if [ -f deploy/.env ]; then
  ENV_MODEL=$(grep -E '^MODERATION_LLM_MODEL=' deploy/.env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  if [ -n "${ENV_MODEL}" ]; then
    MODEL="${ENV_MODEL}"
  fi
fi

COMPOSE="docker compose -f ${COMPOSE_FILE}"

echo "Waiting for Ollama (compose: ${COMPOSE_FILE})..."
i=0
while [ "$i" -lt 60 ]; do
  if ${COMPOSE} exec -T ollama ollama list >/dev/null 2>&1; then
    break
  fi
  i=$((i + 1))
  sleep 2
done

if ! ${COMPOSE} exec -T ollama ollama list >/dev/null 2>&1; then
  echo "Ollama is not responding" >&2
  exit 1
fi

if ${COMPOSE} exec -T ollama ollama list 2>/dev/null | grep -qF "${MODEL}"; then
  echo "Model already installed: ${MODEL}"
  ${COMPOSE} exec -T ollama ollama list
  exit 0
fi

connect_ollama_to_web() {
  WEB_NET=$(${COMPOSE} network ls --format '{{.Name}}' 2>/dev/null | grep '_web$' | head -1)
  if [ -z "${WEB_NET}" ]; then
    WEB_NET=$(docker network ls --format '{{.Name}}' | grep 'rento_web$' | head -1)
  fi
  if [ -n "${WEB_NET}" ]; then
    echo "Connecting rento-ollama to ${WEB_NET} for registry access..."
    docker network connect "${WEB_NET}" rento-ollama 2>/dev/null || true
  fi
}

pull_via_running_container() {
  ${COMPOSE} exec -T ollama ollama pull "${MODEL}"
}

pull_via_host_into_volume() {
  VOL=$(docker volume ls -q | grep 'ollama' | head -1)
  if [ -z "${VOL}" ]; then
    echo "Ollama volume not found" >&2
    return 1
  fi
  echo "Pulling via host network into volume ${VOL}..."
  docker run --rm \
    -v "${VOL}:/root/.ollama" \
    --network host \
    --entrypoint /bin/sh \
    ollama/ollama:latest \
    -c "ollama serve & sleep 5 && ollama pull ${MODEL} && ollama list"
}

echo "Pulling model: ${MODEL} (this can take several minutes)..."
connect_ollama_to_web

if pull_via_running_container; then
  :
elif pull_via_host_into_volume; then
  :
else
  echo "Failed to pull model ${MODEL}" >&2
  exit 1
fi

echo "Installed models:"
${COMPOSE} exec -T ollama ollama list
