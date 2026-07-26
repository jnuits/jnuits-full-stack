#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
baseline_version="20260723233000"
supabase_bin="${SUPABASE_BIN:-supabase}"
scratch_parent="${TMPDIR:-/tmp}"
scratch_dir="$(mktemp -d "${scratch_parent%/}/jnuits-migration-verify.XXXXXX")"
stack_started=0

cleanup() {
  set +e
  if [[ "$stack_started" -eq 1 ]]; then
    "$supabase_bin" stop --workdir "$scratch_dir" --no-backup >/dev/null 2>&1
  fi

  case "$scratch_dir" in
    "${scratch_parent%/}"/jnuits-migration-verify.*)
      rm -rf -- "$scratch_dir"
      ;;
    *)
      printf 'Refusing to remove unexpected scratch path: %s\n' "$scratch_dir" >&2
      ;;
  esac
}
trap cleanup EXIT

"$supabase_bin" init --workdir "$scratch_dir"
scratch_migrations="$scratch_dir/supabase/migrations"
mkdir -p "$scratch_migrations"

for migration in "$repo_root"/supabase/migrations/*.sql; do
  migration_name="${migration##*/}"
  migration_version="${migration_name%%_*}"
  if [[ "$migration_version" > "$baseline_version" ]]; then
    continue
  fi
  cp "$migration" "$scratch_migrations/"
done

cp \
  "$repo_root/supabase/verification/baseline/20260608092959_restore_rls_auto_enable.sql" \
  "$scratch_migrations/"

stack_started=1
start_log="$scratch_dir/supabase-start.log"
if ! "$supabase_bin" start \
  --workdir "$scratch_dir" \
  --exclude edge-runtime,gotrue,imgproxy,kong,logflare,mailpit,postgres-meta,postgrest,realtime,storage-api,studio,supavisor,vector \
  --yes >"$start_log" 2>&1; then
  cat "$start_log" >&2
  exit 1
fi
printf 'Disposable Supabase baseline started through %s.\n' "$baseline_version"

project_id="$(
  sed -n 's/^project_id = "\(.*\)"/\1/p' "$scratch_dir/supabase/config.toml"
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
    "begin; set local session_replication_role = replica; insert into auth.users (id, email, created_at, updated_at) values ('00000000-0000-4000-8000-000000000001', 'migration-harness@local.invalid', now(), now()); commit;"
  printf 'Seeded one disposable auth.users row.\n'
fi

docker exec "$db_container" mkdir -p /tmp/jnuits-verification
docker cp \
  "$repo_root/supabase/." \
  "$db_container:/tmp/jnuits-verification/supabase"

docker exec --workdir /tmp/jnuits-verification "$db_container" \
  psql -X -U postgres -d postgres \
  -v ON_ERROR_STOP=1 \
  -v scratch_ack=DISPOSABLE_SCRATCH \
  -v expected_database=postgres \
  -f supabase/verification/verify-unapplied-migrations.sql
