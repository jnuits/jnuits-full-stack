#!/usr/bin/env bash
# CLI 2.109.1's type generator pulls postgres-meta directly from ECR, ignoring
# its registry override. Prepare the identical official GHCR image locally.
# When changing the CLI pin, reverify its actual image tag and registry digests.
set -euo pipefail

if [[ "$#" -ne 1 || "$1" != "2.109.1" ]]; then
  printf 'No verified postgres-meta image mapping for this Supabase CLI version.\n' >&2
  exit 1
fi

image_digest="sha256:a84cc713585eea7b401e4a2561ec4a1e48c87083d1c7ecb4502f204bb4391300"
cli_repository="public.ecr.aws/supabase/postgres-meta"
mirror_repository="ghcr.io/supabase/postgres-meta"
cli_image="$cli_repository:v0.96.6"
mirror_image="$mirror_repository@$image_digest"

docker_run() {
  MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' docker "$@"
}

has_verified_digest() {
  local image="$1" allow_cli_repository="$2" digest
  local digests
  digests="$(docker_run image inspect "$image" --format '{{range .RepoDigests}}{{println .}}{{end}}')" || return 1
  while IFS= read -r digest; do
    if [[ "$digest" == "$mirror_repository@$image_digest" ]] \
      || [[ "$allow_cli_repository" == 1 && "$digest" == "$cli_repository@$image_digest" ]]; then
      return 0
    fi
  done <<<"$digests"
  return 1
}

if docker_run image inspect "$cli_image" >/dev/null 2>&1; then
  if ! has_verified_digest "$cli_image" 1; then
    printf 'Cached postgres-meta image does not match the verified official digest.\n' >&2
    exit 1
  fi
  printf 'Using verified cached postgres-meta image.\n'
  exit 0
fi

printf 'Preparing official postgres-meta image from GHCR by immutable digest.\n'
docker_run pull "$mirror_image"
if ! has_verified_digest "$mirror_image" 0; then
  printf 'Downloaded postgres-meta image has unexpected provenance.\n' >&2
  exit 1
fi
source_id="$(docker_run image inspect "$mirror_image" --format '{{.Id}}')"
docker_run tag "$mirror_image" "$cli_image"
target_id="$(docker_run image inspect "$cli_image" --format '{{.Id}}')"
if [[ -z "$source_id" || "$source_id" != "$target_id" ]]; then
  printf 'CLI postgres-meta image does not match the verified mirror image.\n' >&2
  exit 1
fi
printf 'Verified postgres-meta image is ready under the pinned CLI name.\n'
