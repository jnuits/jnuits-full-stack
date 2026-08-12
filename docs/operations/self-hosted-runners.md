# GitHub Actions runners

## Current state

As of 2026-08-12, the automatically triggered Quality Gate and Diff Check
workflows run on `ubuntu-latest`.

The repository used three persistent self-hosted runners from 2026-07-27 while
the account's included GitHub-hosted minutes were exhausted. The included
minutes reset on 2026-08-01. On 2026-08-12 the self-hosted pool stopped
accepting jobs; required checks remained queued for hours. The documented
fallback was therefore activated and issue #78 records the decision.

## Current workflow behavior

- Every required job uses a fresh GitHub-hosted VM.
- The two Supabase Docker jobs can run in parallel because their containers and
  fixed ports are isolated on different VMs.
- Preflight and post-run Docker cleanup remains in both jobs. It is redundant
  on a fresh VM but useful defense in depth and keeps local failure diagnostics.
- The Playwright browser directory is restored with the pinned
  `actions/cache` action. Ephemeral runners cannot rely on a prior browser
  installation.
- The repository's verified Supabase CLI and Gitleaks installers remain.
  Their pinned digest checks authenticate downloaded executables and are useful
  independently of runner persistence.
- CI variables remain non-production placeholders. Migration verification
  remains local-only and never links to the production Supabase project.

## Historical self-hosted pool

The temporary pool contained:

| Name | Labels | Spec |
| --- | --- | --- |
| `jnuits-full-stack-1` | `self-hosted`, `Linux`, `X64` | 8 GB / 160 GB, Ubuntu 24.04 LTS, SGP1, +4 GB swap |
| `jnuits-full-stack-2` | same | same |
| `jnuits-full-stack-3` | same | same |

The pool required dedicated hosts, no production credentials, restricted
repository access, Docker-group membership, and authenticated cached tools.
Those conditions are no longer part of the active workflow contract because no
required workflow targets the self-hosted labels.

## Retirement checklist

Changing `runs-on` stops new repository jobs from targeting the pool; it does
not unregister or destroy the hosts. An organization owner should separately:

1. Remove or disable the three runners in GitHub if they are not needed.
2. Revoke their registration tokens and remove the runner services.
3. Destroy or repurpose the VPS hosts only after confirming they contain no
   needed artifacts.
4. Close issue #78 after the runner inventory confirms no active required
   workflow still targets the pool.

If included minutes become insufficient again, do not silently re-enable the
persistent pool. Record a new owner decision and prefer ephemeral runners.
