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
#
# Windows note: the scratch project is created under the repository root and
# entered with cd, rather than passed as --workdir. Under Git Bash, MSYS
# rewrites POSIX-looking arguments before native binaries see them, so bash's
# /tmp and the CLI's view of that same string resolve to different directories.
# Inheriting the working directory from the process sidesteps the translation
# entirely. Argument conversion is also disabled around docker so container
# paths survive intact.
set -euo pipefail

generate_types=0
if [[ "$#" -eq 1 && "$1" == "--generate-types" ]]; then
  generate_types=1
elif [[ "$#" -ne 0 ]]; then
  printf 'Only --generate-types is accepted; remote database arguments are forbidden.\n' >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
bootstrap_helper="$repo_root/supabase/verification/baseline/20260608092959_restore_rls_auto_enable.sql"
config_helper="$repo_root/supabase/verification/configure-bootstrap-replay.mjs"
types_writer="$repo_root/supabase/verification/write-generated-db-types.sh"
bootstrap_version="20260608092959"
pinned_cli_version="2.109.1"
scratch_ack="${SCRATCH_ACK:-DISPOSABLE_SCRATCH}"
replay_db_port="${SUPABASE_REPLAY_DB_PORT:-}"
types_output="${DB_TYPES_OUTPUT:-$repo_root/src/lib/db/types.ts}"
scratch_root="$repo_root/.replay-scratch"
stack_started=0

# Converts a bash path to the form a native Windows binary expects. A no-op on
# Linux and macOS, where cygpath does not exist.
to_native() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1"
  else
    printf '%s' "$1"
  fi
}

# Container paths such as /tmp/jnuits-replay must reach docker untouched.
docker_run() {
  MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' docker "$@"
}

if [[ "$scratch_ack" != "DISPOSABLE_SCRATCH" ]]; then
  printf 'Refusing to run without SCRATCH_ACK=DISPOSABLE_SCRATCH.\n' >&2
  exit 1
fi

if [[ ! -f "$bootstrap_helper" ]]; then
  printf 'Bootstrap helper is missing: %s\n' "$bootstrap_helper" >&2
  exit 1
fi

if [[ ! -f "$config_helper" ]]; then
  printf 'Disposable configuration helper is missing: %s\n' "$config_helper" >&2
  exit 1
fi

if [[ "$generate_types" -eq 1 && ! -f "$types_writer" ]]; then
  printf 'Database type writer is missing: %s\n' "$types_writer" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  printf 'Docker is required but was not found on PATH.\n' >&2
  exit 1
fi

if ! docker_run info >/dev/null 2>&1; then
  printf 'Docker is installed but not running. Start Docker and retry.\n' >&2
  exit 1
fi

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

mkdir -p "$scratch_root"
scratch_dir="$(mktemp -d "$scratch_root/replay.XXXXXX")"

cleanup() {
  set +e
  if [[ "$stack_started" -eq 1 ]]; then
    (cd "$scratch_dir" && "${supabase_cli[@]}" stop --no-backup >/dev/null 2>&1)
  fi

  case "$scratch_dir" in
    "$scratch_root"/replay.*)
      rm -rf -- "$scratch_dir"
      rmdir "$scratch_root" 2>/dev/null
      ;;
    *)
      printf 'Refusing to remove unexpected scratch path: %s\n' "$scratch_dir" >&2
      ;;
  esac
}
trap cleanup EXIT

printf 'Scratch project: %s\n' "$scratch_dir"

# cd, rather than --workdir, so the CLI inherits its working directory from the
# process instead of from a string that MSYS may rewrite.
(cd "$scratch_dir" && "${supabase_cli[@]}" init)

# Locate config.toml rather than assuming where init placed it.
config_file=""
for candidate in \
  "$scratch_dir/supabase/config.toml" \
  "$scratch_dir/config.toml"; do
  if [[ -f "$candidate" ]]; then
    config_file="$candidate"
    break
  fi
done

if [[ -z "$config_file" ]]; then
  config_file="$(find "$scratch_dir" -name config.toml -type f 2>/dev/null | head -n 1)"
fi

if [[ -z "$config_file" || ! -f "$config_file" ]]; then
  printf 'Supabase init produced no config.toml inside %s\n' "$scratch_dir" >&2
  printf 'Scratch contents:\n' >&2
  find "$scratch_dir" -maxdepth 3 >&2 2>/dev/null || true
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  printf 'Node.js is required for disposable replay configuration.\n' >&2
  exit 1
fi
# Replay tests ordered migration files, not declarative schema diffs. Disable
# the CLI's experimental catalog-cache export, which can hang after application.
# This does not skip a migration, SQL assertion, type generation or database lint.
node "$config_helper" "$(to_native "$config_file")" "$(to_native "$scratch_root")" "$replay_db_port"
if [[ -n "$replay_db_port" ]]; then
  printf 'Disposable database port override: %s\n' "$replay_db_port"
fi

project_dir="$(cd "$(dirname "$config_file")/.." && pwd)"
scratch_migrations="$(dirname "$config_file")/migrations"
mkdir -p "$scratch_migrations"
printf 'Using project directory: %s\n' "$project_dir"

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
if ! (cd "$project_dir" && "${supabase_cli[@]}" start \
  --exclude edge-runtime,gotrue,imgproxy,kong,logflare,mailpit,postgres-meta,postgrest,realtime,storage-api,studio,supavisor,vector \
  --yes) >"$start_log" 2>&1; then
  printf 'Clean replay FAILED while applying the migration chain.\n' >&2
  # The start log contains local container output only. It carries no project
  # ref, no access token, and no remote connection string.
  cat "$start_log" >&2
  exit 1
fi

# `supabase start` exiting zero means the stack booted. It is NOT proof that
# the migration chain applied. Only the assertions below establish that, so no
# success is claimed here.
printf 'Disposable stack started. Verifying that the chain actually applied.\n'

if grep -qiE 'skipping migration|already applied|no migrations' "$start_log"; then
  printf 'The start log suggests migrations were skipped rather than applied:\n' >&2
  grep -iE 'skipping migration|already applied|no migrations' "$start_log" >&2
  exit 1
fi

project_id="$(
  sed -n 's/^project_id = "\(.*\)"/\1/p' "$config_file" | tr -d '\r'
)"
if [[ -z "$project_id" ]]; then
  printf 'Could not resolve the disposable Supabase project ID from %s\n' "$config_file" >&2
  exit 1
fi
db_container="supabase_db_${project_id}"

if ! docker_run inspect "$db_container" >/dev/null 2>&1; then
  printf 'Expected database container %s was not found.\n' "$db_container" >&2
  printf 'Running containers:\n' >&2
  docker_run ps --format '{{.Names}}' >&2
  exit 1
fi

if docker_run exec "$db_container" \
  psql -X -U postgres -d postgres -Atqc \
  "select id from auth.users order by created_at limit 1" | grep -q .; then
  printf 'Using an existing disposable auth.users row.\n'
else
  docker_run exec "$db_container" \
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

docker_run exec "$db_container" \
  psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c \
  "drop table if exists public._jnuits_replay_expectations;
   create table public._jnuits_replay_expectations (version text primary key);
   insert into public._jnuits_replay_expectations (version) values ${expected_values};"

docker_run exec "$db_container" mkdir -p /tmp/jnuits-replay
docker_run cp \
  "$(to_native "$repo_root/supabase/verification/assert-bootstrap-replay.sql")" \
  "$db_container:/tmp/jnuits-replay/assert-bootstrap-replay.sql"

docker_run exec "$db_container" \
  psql -X -U postgres -d postgres \
  -v ON_ERROR_STOP=1 \
  -f /tmp/jnuits-replay/assert-bootstrap-replay.sql

docker_run cp \
  "$(to_native "$repo_root/supabase/verification/assert-member-intake-publish.sql")" \
  "$db_container:/tmp/jnuits-replay/assert-member-intake-publish.sql"
docker_run exec "$db_container" \
  psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -f /tmp/jnuits-replay/assert-member-intake-publish.sql

docker_run cp \
  "$(to_native "$repo_root/supabase/verification/assert-membership-anniversary.sql")" \
  "$db_container:/tmp/jnuits-replay/assert-membership-anniversary.sql"
docker_run exec "$db_container" \
  psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -f /tmp/jnuits-replay/assert-membership-anniversary.sql

docker_run cp \
  "$(to_native "$repo_root/supabase/verification/assert-membership-snapshot.sql")" \
  "$db_container:/tmp/jnuits-replay/assert-membership-snapshot.sql"
docker_run exec "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -f /tmp/jnuits-replay/assert-membership-snapshot.sql

docker_run cp \
  "$(to_native "$repo_root/supabase/verification/assert-membership-admin-queue.sql")" \
  "$db_container:/tmp/jnuits-replay/assert-membership-admin-queue.sql"
docker_run exec "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -f /tmp/jnuits-replay/assert-membership-admin-queue.sql

docker_run cp \
  "$(to_native "$repo_root/supabase/verification/assert-cycle-free-approval.sql")" \
  "$db_container:/tmp/jnuits-replay/assert-cycle-free-approval.sql"
docker_run exec "$db_container" \
  psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -f /tmp/jnuits-replay/assert-cycle-free-approval.sql

docker_run cp \
  "$(to_native "$repo_root/supabase/verification/assert-membership-review-regressions.sql")" \
  "$db_container:/tmp/jnuits-replay/assert-membership-review-regressions.sql"
docker_run exec "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -f /tmp/jnuits-replay/assert-membership-review-regressions.sql

docker_run cp \
  "$(to_native "$repo_root/supabase/verification/assert-membership-bulk-review.sql")" \
  "$db_container:/tmp/jnuits-replay/assert-membership-bulk-review.sql"
docker_run exec "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -f /tmp/jnuits-replay/assert-membership-bulk-review.sql

docker_run cp \
  "$(to_native "$repo_root/supabase/verification/assert-admin-verification.sql")" \
  "$db_container:/tmp/jnuits-replay/assert-admin-verification.sql"
docker_run exec "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -f /tmp/jnuits-replay/assert-admin-verification.sql

SCRATCH_ACK=DISPOSABLE_SCRATCH node "$repo_root/supabase/verification/run-admin-verification-concurrency.mjs" "$db_container"

docker_run cp \
  "$(to_native "$repo_root/supabase/verification/assert-admin-operation-guards.sql")" \
  "$db_container:/tmp/jnuits-replay/assert-admin-operation-guards.sql"
docker_run exec "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -f /tmp/jnuits-replay/assert-admin-operation-guards.sql

docker_run exec "$db_container" \
  psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c \
  "drop table if exists public._jnuits_replay_expectations;"

# Only these read-only CLI operations may retry a registry pull failure. Never
# retry migration application or SQL assertions, and never publish partial types.
run_local_read_with_pull_retry() {
  local output_file="$1"
  shift
  local attempt=1 status=0 delay=5
  local attempt_output="$scratch_dir/read-attempt.stdout"
  local attempt_error="$scratch_dir/read-attempt.stderr"
  while true; do
    if (cd "$project_dir" && "${supabase_cli[@]}" "$@") \
      >"$attempt_output" 2>"$attempt_error"; then
      cat "$attempt_error" >&2
      cp "$attempt_output" "$output_file"
      return 0
    else
      status=$?
    fi
    cat "$attempt_output" >&2
    cat "$attempt_error" >&2
    if [[ "$attempt" -ge 3 ]] \
      || ! grep -qiE '(docker|error pulling image|failed to pull image)' "$attempt_error" \
      || ! grep -qiE 'toomanyrequests|rate exceeded' "$attempt_error"; then
      return "$status"
    fi
    printf 'Registry image pull was rate-limited; retrying read-only CLI operation (%s/3) in %ss.\n' \
      "$((attempt + 1))" "$delay" >&2
    sleep "$delay"
    attempt=$((attempt + 1))
    delay=15
  done
}

docker_run cp \
  "$(to_native "$repo_root/supabase/verification/assert-audit-security.sql")" \
  "$db_container:/tmp/jnuits-replay/assert-audit-security.sql"
docker_run exec "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -f /tmp/jnuits-replay/assert-audit-security.sql

docker_run cp \
  "$(to_native "$repo_root/supabase/verification/assert-content-query-summaries.sql")" \
  "$db_container:/tmp/jnuits-replay/assert-content-query-summaries.sql"
docker_run exec "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -f /tmp/jnuits-replay/assert-content-query-summaries.sql

docker_run cp \
  "$(to_native "$repo_root/supabase/verification/assert-newsletter-consent.sql")" \
  "$db_container:/tmp/jnuits-replay/assert-newsletter-consent.sql"
docker_run exec "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -f /tmp/jnuits-replay/assert-newsletter-consent.sql

SCRATCH_ACK=DISPOSABLE_SCRATCH node "$repo_root/supabase/verification/run-newsletter-concurrency.mjs" "$db_container"

if [[ "$generate_types" -eq 1 ]]; then
  generated_types="$scratch_dir/generated-db-types.ts"
  printf 'Generating TypeScript types from the disposable local stack.\n'
  run_local_read_with_pull_retry "$generated_types" \
    gen types --local --lang typescript --schema public
  bash "$types_writer" "$generated_types" "$types_output"
fi

printf 'Checking public/private database functions for compile-time errors.\n'
lint_output="$scratch_dir/database-lint.stdout"
run_local_read_with_pull_retry "$lint_output" \
  db lint --local --schema public,private --level error --fail-on error
cat "$lint_output"

printf 'BOOTSTRAP REPLAY COMPLETE\n'
