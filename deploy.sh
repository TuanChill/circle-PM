#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/circle/be"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
DEPLOY_REF="${1:-origin/main}"

cd "$APP_DIR"
deployment_state_dir="/opt/circle/deploy-state"
deployment_ref_file="$deployment_state_dir/project-service-last-deployed-sha"
previous_ref="$(cat "$deployment_ref_file" 2>/dev/null || true)"

exec 9>/run/lock/circle-be-deploy.lock
if ! flock -w 600 9; then
  echo "Timed out waiting for another backend deployment to finish." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env; refusing to deploy without production configuration." >&2
  exit 1
fi

# Reclaim space before fetching the new revision. The fetch itself writes a
# temporary pack under .git, so cleanup that only runs after checkout cannot
# recover from a full production disk. Keep running containers and named
# volumes (including PostgreSQL data) intact.
echo "Reclaiming unused Docker build cache before fetch..."
# Remove all unused Docker objects, but preserve named volumes so
# PostgreSQL/Redis state survives the deploy.
docker system prune -af
git gc --prune=now

echo "Fetching the requested revision..."
git fetch --prune origin main
git rev-parse --verify "${DEPLOY_REF}^{commit}" >/dev/null
git reset --hard "$DEPLOY_REF"
echo "Deploying revision $(git rev-parse --short HEAD)..."

if [[ ! -f docker-compose.prod.yml ]]; then
  echo "Missing docker-compose.prod.yml after checkout." >&2
  exit 1
fi

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export CIRCLE_BUILD_REVISION="$DEPLOY_REF"
# The production host currently runs Docker 20.10 without buildx. Serializing
# Compose builds avoids the daemon's concurrent BuildKit connection deadlock.
export COMPOSE_PARALLEL_LIMIT=1

echo "Validating Compose configuration..."
"${COMPOSE[@]}" config >/dev/null

echo "Starting stateful dependencies..."
"${COMPOSE[@]}" up -d db redis etcd

echo "Waiting for PostgreSQL..."
for attempt in {1..60}; do
  if "${COMPOSE[@]}" exec -T db pg_isready >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == 60 ]]; then
    echo "PostgreSQL did not become ready in time." >&2
    "${COMPOSE[@]}" logs --tail=80 db >&2 || true
    exit 1
  fi
  sleep 2
done

changed_files="$(git diff --name-only "${DEPLOY_REF}^" "${DEPLOY_REF}" || true)"
build_targets=()
build_all=false

add_build_target() {
  local target="$1"
  local existing
  for existing in "${build_targets[@]}"; do
    [[ "$existing" == "$target" ]] && return
  done
  build_targets+=("$target")
}

while IFS= read -r changed_file; do
  case "$changed_file" in
    apps/auth-service/*) add_build_target auth-service ;;
    apps/user-service/*) add_build_target user-service ;;
    apps/notification-service/*) add_build_target notification-service ;;
    apps/project-service/*) add_build_target project-service ;;
    apps/web/*|deploy.sh) add_build_target web ;;
    .docker/compose/nodejs/*|libs/common/*|libs/core/*|package.json|pnpm-lock.yaml|pnpm-workspace.yaml|turbo.json)
      build_all=true
      ;;
    .docker/compose/apisix/*|docker-compose.yml|docker-compose.prod.yml)
      add_build_target apisix
      add_build_target adc
      ;;
  esac
done <<< "$changed_files"

migration_dir="apps/project-service/src/database/migrations"
if [[ "$previous_ref" =~ ^[0-9a-fA-F]{40}$ ]] && git cat-file -e "${previous_ref}^{commit}" 2>/dev/null; then
  migration_changes="$(git diff --name-status "$previous_ref" "$DEPLOY_REF" -- "$migration_dir")"
else
  echo "Missing a valid last-deployed revision; refusing to infer which project-service migrations are safe to run." >&2
  exit 1
fi

new_migrations=()
while IFS=$'\t' read -r change_type migration_path; do
  [[ -n "$change_type" ]] || continue
  if [[ "$change_type" != A ]]; then
    echo "Project-service migration files are immutable after creation; refusing to deploy changed file: $migration_path" >&2
    exit 1
  fi

  migration_file="${migration_path##*/}"
  if [[ ! "$migration_file" =~ ^Migration[0-9]{14}\.ts$ ]]; then
    echo "Unexpected project-service migration filename: $migration_file" >&2
    exit 1
  fi
  new_migrations+=("${migration_file%.ts}")
done <<< "$migration_changes"

if [[ "$build_all" == true ]]; then
  build_targets=(auth-service user-service notification-service project-service web apisix adc)
fi

if [[ "${#build_targets[@]}" -gt 0 ]]; then
  echo "Building backend images: ${build_targets[*]}"
  "${COMPOSE[@]}" build "${build_targets[@]}"
else
  echo "No backend image changes detected; reusing existing images."
fi

backup_required=false
if [[ ! "$previous_ref" =~ ^[0-9a-fA-F]{40}$ ]] || \
  ! git cat-file -e "${previous_ref}^{commit}" 2>/dev/null || \
  ! git diff --quiet "$previous_ref" "$DEPLOY_REF" -- apps/project-service/src/database/migrations; then
  backup_required=true
fi

if [[ "$backup_required" == true ]]; then
  backup_dir="/opt/circle/db-backups"
  backup_stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  backup_prefix="project-service-${backup_stamp}-$(git rev-parse --short "$DEPLOY_REF")"
  backup_dump="$backup_dir/$backup_prefix.dump"
  backup_schema="$backup_dir/$backup_prefix.schema.sql"
  dump_tmp="$backup_dump.partial"
  schema_tmp="$backup_schema.partial"
  container_dump="/tmp/$backup_prefix.dump"

  mkdir -p "$backup_dir"
  chmod 700 "$backup_dir"
  trap 'rm -f "$dump_tmp" "$schema_tmp"; docker exec nest_turbo_db rm -f "$container_dump" "/tmp/verify-$backup_prefix.dump" >/dev/null 2>&1 || true' EXIT

  database_bytes="$("${COMPOSE[@]}" exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc "SELECT pg_database_size(current_database())"')"
  available_bytes="$(df -Pk "$backup_dir" | awk 'NR == 2 { printf "%.0f", $4 * 1024 }')"
  if [[ ! "$database_bytes" =~ ^[0-9]+$ || ! "$available_bytes" =~ ^[0-9]+$ ]]; then
    echo "Could not verify database size and backup disk capacity; refusing to migrate." >&2
    exit 1
  fi
  if (( available_bytes < database_bytes + 1073741824 )); then
    echo "Insufficient disk space for a verified database backup; refusing to migrate." >&2
    exit 1
  fi

  echo "Creating pre-migration database backup..."
  "${COMPOSE[@]}" exec -T db sh -c \
    "pg_dump -Fc -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -f '$container_dump' && pg_restore --list '$container_dump' >/dev/null"
  docker cp "nest_turbo_db:$container_dump" "$dump_tmp" >/dev/null
  docker cp "$dump_tmp" "nest_turbo_db:/tmp/verify-$backup_prefix.dump" >/dev/null
  docker exec nest_turbo_db pg_restore --list "/tmp/verify-$backup_prefix.dump" >/dev/null
  test -s "$dump_tmp"
  mv "$dump_tmp" "$backup_dump"

  "${COMPOSE[@]}" exec -T db sh -c \
    'pg_dump --schema-only -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$schema_tmp"
  test -s "$schema_tmp"
  mv "$schema_tmp" "$backup_schema"
  chmod 600 "$backup_dump" "$backup_schema"
  echo "Verified pre-migration backup: $backup_dump"
  sha256sum "$backup_dump" "$backup_schema"
  trap - EXIT
  docker exec nest_turbo_db rm -f "$container_dump" "/tmp/verify-$backup_prefix.dump"
else
  echo "No new project-service migrations detected; skipping database backup."
fi

if [[ "${#new_migrations[@]}" -gt 0 ]]; then
  migration_filter="$(IFS=,; printf '%s' "${new_migrations[*]}")"
  echo "Applying newly added project-service migrations: ${new_migrations[*]}"
  "${COMPOSE[@]}" run --rm --no-deps -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 project-service pnpm --filter=project-service migration:up --only "$migration_filter"
else
  echo "No new project-service migration files; skipping migration runner."
fi

echo "Starting backend services and API gateway..."
"${COMPOSE[@]}" up -d --remove-orphans auth-service user-service notification-service project-service web apisix apisix-homepage

apisix_profile="$(awk -F= '$1 == "APISIX_PROFILE" { value=$2 } END { print value }' .env)"
apisix_profile="${apisix_profile:-dev}"

echo "Synchronizing API gateway routes..."
for attempt in {1..30}; do
  if "${COMPOSE[@]}" run --rm --no-deps adc adc sync -f "conf/apisix-${apisix_profile}.yaml"; then
    break
  fi
  if [[ "$attempt" == 30 ]]; then
    echo "API gateway configuration did not become ready in time." >&2
    "${COMPOSE[@]}" logs --tail=80 apisix >&2 || true
    exit 1
  fi
  sleep 2
done

echo "Deployment completed. Runtime smoke tests are intentionally local-only."
"${COMPOSE[@]}" ps

mkdir -p "$deployment_state_dir"
chmod 700 "$deployment_state_dir"
printf '%s\n' "$(git rev-parse "$DEPLOY_REF")" > "$deployment_ref_file.partial"
chmod 600 "$deployment_ref_file.partial"
mv "$deployment_ref_file.partial" "$deployment_ref_file"
