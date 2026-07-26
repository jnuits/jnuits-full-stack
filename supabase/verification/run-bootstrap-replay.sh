#!/usr/bin/env bash
#
# Supported clean migration replay (issue #18).
#
# Replays EVERY migration in supabase/migrations from the supported bootstrap
# point through the latest file, against a throwaway local Supabase stack.
#
# This is a SUPPORTED BASELINE REPLAY, not a full historical replay from zero.
# See docs/operations/migration-bootstrap-and-integrity.md for why a true
# from-zero replay is impossible without rewriting applied production history.
#
# Never point this at a linked or production project. There is no --linked and
# no --db-url path, by design.
#
# CLI resolution, first match wins:
#   SUPABASE_CLI_COMMAND   multi-word, e.g. "npx --yes supabase@2.109.1"
#   SUPABASE_BIN           path to a single binary
#   supabase               on PATH
# If none resolve, falls back to npx with the same version CI pins.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
bootstrap_helper="$repo_root/supabase/verification/baseline/20260608092959_restore_rls_auto_enable.sql"
bootstrap_version="20260608092959"
pinned_cli_version="2.109.1"
scratch_ack="${SCRATCH_ACK:-DISPOSABLE_SCRATCH}"
scratch_parent="${TMPDIR:-/tmp}"
stack_started=0

if [[ "$scratch_ack" != "DISPOSABLE_SCRATCH" ]]; then
  printf 'Refusing to run without SCRATCH_ACK=DISPOSABLE_SCRATCH.\n' >&2
  exit 1
fi

if [[ ! -f "$bootstrap_helper" ]]; then
  printf 'Bootstrap helper is missing: %s\n' "$bootstrap_helper" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  printf 'Docker is required but was not found on PATH.\n' >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  printf 'Docker is installed but not running. Start Docker and retry.\n' >&2
  exit 1
fi

# Resolve the CLI into an array so a multi-word command works.
if [[ -n "${SUPABASE_CLI_COMMAND:-}" ]]; then
  read -r -a supabase_cli <<<"$SUPABASE_CLI_COMMAND"
elif [[ -n "${SUPABASE_BIN:-}" ]]; then
  supabase_cli=("$SUPABASE_BIN")
elif command -v supabase >/dev/null 2>&1; then
  supabase_cli=(supabase)
elif command -v npx >/dev/null 2>&1; then
  supabase_cli=(npx --yes "supabase@${pinned_cli_version}")
  printf 'Supabase CLI not on PATH. Using npx with pinned %s.\n' "$pinned_cli_version"
else
  printf 'No Supabase CLI available. Install it, or set SUPABASE_CLI_COMMAND or SUPABASE_BIN.\n' >&2
  exit 1
fi

if ! "${supabase_cli[@]}" --version >/dev/null 2>&1; then
  printf 'The resolved Supabase CLI could not be executed: %s\n' "${supabase_cli[*]}" >&2
  exit 1
fi
printf 'Supabase CLI: %s (%s)\n' "${supabase_cli[*]}" "$("${supabase_cli[@]}" --version 2>/dev/null | tr -d '\r')"

scratch_dir="$(mktemp -d "${scratch_parent%/}/jnuits-bootstrap-replay.XXXXXX")"

cleanup() {
  set +e
  if [[ "$stack_started" -eq 1 ]]; then
    "${supabase_cli[@]}" stop --workdir "$scratch_dir" --no-backup >/dev/null 2>&1
  fi

  case "$scratch_dir" in
    "${scratch_parent%/}"/jnuits-bootstrap-replay.*)
      rm -rf -- "$scratch_dir"
      ;;
    *)
      printf 'Refusing to remove unexpected scratch path: %s\n' "$scratch_dir" >&2
      ;;
  esac
}
trap cleanup EXIT

"${supabase_cli[@]}" init --workdir "$scratch_dir"
scratch_migrations="$scratch_dir/supabase/migrations"
mkdir -p "$scratch_migrations"

# The bootstrap helper reconstructs public.rls_auto_enable(), which an old
# applied migration depends on but which no migration in the chain creates.
# It is verification-only and must never move into supabase/migrations.
cp "$bootstrap_helper" "$scratch_migrations/"

# Unlike run-unapplied-migrations.sh there is NO version ceiling here. The
# entire chain replays, including the two most recent migrations.
migration_count=0
for migration in "$repo_root"/supabase/migrations/*.sql; do
  cp "$migration" "$scratch_migrations/"
  migration_count=$((migration_count + 1))
done

if [[ "$migration_count" -eq 0 ]]; then
  printf 'No migrations were found to replay.\n' >&2
  exit 1
fi

printf 'Replaying %s repository migrations plus the bootstrap helper.\n' "$migration_count"

stack_started=1
start_log="$scratch_dir/supabase-start.log"
if ! "${supabase_cli[@]}" start \
  --workdir "$scratch_dir" \
  --exclude edge-runtime,gotrue,imgproxy,kong,logflare,mailpit,postgres-meta,postgrest,realtime,storage-api,studio,supavisor,vector \
  --yes >"$start_log" 2>&1; then
  printf 'Clean replay FAILED while applying the migration chain.\n' >&2
  # The start log contains local container output only. It carries no project
  # ref, no access token, and no remote connection string.
  cat "$start_log" >&2
  exit 1
fi
printf 'Clean replay applied every migration through the latest file.\n'

project_id="$(
  sed -n 's/^project_id = "\(.*\)"/\1/p' "$scratch_dir/supabase/config.toml" | tr -d '\r'
)"
if [[ -z "$project_id" ]]; then
  printf 'Could not resolve the disposable Supabase project ID.\n' >&2
  exit 1
fi
db_container="supabase_db_${project_id}"

if docker exec "$db_container" \
  psql -X -U postgres -d postgres -Atqc \
  "select id from auth.users order by created_at limit 1" | grep -q .; then
  printf 'Using an existing disposable auth.users row.\n'
else
  docker exec "$db_container" \
    psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c \
    "begin; set local session_replication_role = replica; insert into auth.users (id, email, created_at, updated_at) values ('00000000-0000-4000-8000-000000000002', 'replay-harness@local.invalid', now(), now()); commit;"
  printf 'Seeded one disposable auth.users row.\n'
fi

# Expected versions are handed to SQL through a table rather than psql
# variables, because psql does not interpolate inside dollar-quoted blocks.
expected_values="('${bootstrap_version}')"
for migration in "$scratch_migrations"/*.sql; do
  name="${migration##*/}"
  version="${name%%_*}"
  if [[ "$version" == "$bootstrap_version" ]]; then
    continue
  fi
  expected_values+=",('${version}')"
done

docker exec "$db_container" \
  psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c \
  "drop table if exists public._jnuits_replay_expectations;
   create table public._jnuits_replay_expectations (version text primary key);
   insert into public._jnuits_replay_expectations (version) values ${expected_values};"

docker exec "$db_container" mkdir -p /tmp/jnuits-replay
docker cp \
  "$repo_root/supabase/verification/assert-bootstrap-replay.sql" \
  "$db_container:/tmp/jnuits-replay/assert-bootstrap-replay.sql"

docker exec "$db_container" \
  psql -X -U postgres -d postgres \
  -v ON_ERROR_STOP=1 \
  -f /tmp/jnuits-replay/assert-bootstrap-replay.sql

docker exec "$db_container" \
  psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c \
  "drop table if exists public._jnuits_replay_expectations;"

printf 'BOOTSTRAP REPLAY COMPLETE\n'
