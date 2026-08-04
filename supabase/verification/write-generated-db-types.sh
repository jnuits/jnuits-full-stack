#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 2 ]]; then
  printf 'Usage: %s <generated-input> <canonical-output>\n' "$0" >&2
  exit 1
fi

input_file="$1"
output_file="$2"

if [[ ! -f "$input_file" ]]; then
  printf 'Generated database types input is missing: %s\n' "$input_file" >&2
  exit 1
fi

required_sentinels=(
  'export type Database'
  'form_definitions'
  'form_versions'
  'form_submissions'
  'form_submission_assets'
  'form_export_jobs'
  'form_archive_jobs'
  'alumni_onboarding_cases'
)

missing_sentinels=()
for sentinel in "${required_sentinels[@]}"; do
  if ! grep -Fq "$sentinel" "$input_file"; then
    missing_sentinels+=("$sentinel")
  fi
done

if [[ "${#missing_sentinels[@]}" -gt 0 ]]; then
  printf 'Generated database types are missing required schema sentinels: %s\n' \
    "${missing_sentinels[*]}" >&2
  exit 1
fi

output_dir="$(dirname "$output_file")"
mkdir -p "$output_dir"
temporary_output="$(mktemp "$output_dir/.database-types.XXXXXX")"

cleanup() {
  rm -f -- "$temporary_output"
}
trap cleanup EXIT

# Supabase emits text. Canonicalise CRLF/CR to LF, remove trailing blank lines,
# and keep exactly one final newline so Windows and Linux produce equal bytes.
awk '
  {
    sub(/\r$/, "")
    lines[NR] = $0
  }
  END {
    last = NR
    while (last > 0 && lines[last] == "") {
      last -= 1
    }
    for (line = 1; line <= last; line += 1) {
      print lines[line]
    }
  }
' "$input_file" >"$temporary_output"

mv -f -- "$temporary_output" "$output_file"
trap - EXIT

printf 'Generated canonical database types: %s\n' "$output_file"
