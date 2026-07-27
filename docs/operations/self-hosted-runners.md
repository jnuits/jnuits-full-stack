# Self-Hosted Runners

The `jnuits` account exhausted its 2,000 included GitHub Actions minutes on
2026-07-27, six days before the 1 August reset. Every job in Quality Gate runs
350 and 352 was refused before starting: jobs reported failure in 2-3 seconds
with no step logs and no artifacts. No code was at fault.

The Quality Gate now runs on three dedicated self-hosted runners.

**This is a temporary measure with an expiry date.** Reassessment after the
2026-08-01 reset is tracked in issue #78.

## Runners

| Name | Labels | Spec |
| --- | --- | --- |
| `jnuits-full-stack-1` | `self-hosted`, `Linux`, `X64` | 8 GB / 160 GB, Ubuntu 24.04 LTS, SGP1, +4 GB swap |
| `jnuits-full-stack-2` | same | same |
| `jnuits-full-stack-3` | same | same |

Three runners, nine jobs. Jobs queue in dependency order rather than all
starting at once. A full green run takes roughly three waves.

## Standing conditions

These are not optional. They are what makes self-hosted execution acceptable
for this repository, and every one of them must hold for as long as the
runners are attached.

- **The repository stays private.** On a public repository, any fork pull
  request can execute arbitrary code on the runner host.
- **The runner group is restricted to this repository only.** The reap steps
  match `name=supabase_` and would destroy an unrelated Supabase stack sharing
  a host.
- **Only trusted collaborators may trigger workflows.** `secret_scan` already
  refuses fork pull requests; set *Settings → Actions → Require approval for
  all outside collaborators* as the backstop.
- **Hosts stay dedicated and hold no production credentials.** CI environment
  variables are placeholders, and both migration harnesses are local-only with
  no `--linked` and no `--db-url` path.
- **Cached executable integrity is re-verified every run.**
  `.github/actions/setup-supabase-cli` authenticates the release archive
  against a SHA-256 digest committed to this repository, then rebuilds the
  extraction directory from that verified archive. `$HOME` on a persistent
  runner is writable by every job that lands on the host, so a previously
  extracted binary that still runs proves nothing about its authenticity.
- **Reassess after 2026-08-01.** See §Reverting and issue #78.

## Required host setup

Self-hosted runners have **no pre-installed tooling**. Run this once on each of
the three VPS hosts. Do not run it as the runner service user's job; run it as
an administrator.

```bash
# Docker, for the two migration jobs
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$(whoami)"          # or the runner service user

# Playwright system libraries, for the browser smoke job
sudo apt-get update
sudo apt-get install -y \
  libnss3 libnspr4 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libasound2t64 libpango-1.0-0 libcairo2

# Verify, as the runner user
docker info >/dev/null && echo "docker ok"
```

Restart the runner service after adding the Docker group, or the runner keeps
its old group membership and every Docker call fails with a permission error.

Node is **not** installed manually. `actions/setup-node` downloads and caches
pinned Node 24.14.1 per runner.

## Behaviour differences that affect these workflows

### State persists between jobs

`actions/checkout` runs `git clean -ffdx`, so the workspace itself is reset,
including `node_modules` and `.replay-scratch`. Anything **outside** the
workspace is not.

Consequences already handled in `quality-gate.yml`:

- **Orphaned Supabase containers.** A cancelled run skips the harness EXIT
  trap, leaving containers holding the fixed local ports. The next replay then
  fails with a misleading error. Both Docker jobs reap `supabase_*` containers
  and volumes before and after they run.
- **Playwright browsers.** `PLAYWRIGHT_BROWSERS_PATH` points outside the
  workspace so the download survives `git clean`. `actions/cache` was removed
  from that job; on a persistent host it is pure overhead.
- **Cached tool archives.** See the Supabase CLI note under Standing
  conditions. Anything cached under `$HOME` is re-verified, never trusted.

### Reaping is repository-scoped by assumption

The reap steps match `name=supabase_`, which would also remove an unrelated
Supabase stack on the same host. These runners are dedicated to this
repository, so that is acceptable. **Do not** attach these runners to another
project that runs Supabase locally without narrowing the filter.

### Known risk: the two Docker jobs can collide

`migration_runtime` and `migration_bootstrap_replay` both reap every
`supabase_*` container and volume on their host, before and after, with
`if: always()`. They have no ordering between them, both bind fixed local
ports, and both are inside `Required CI`.

Three runners, nine jobs. When those two land on the same host concurrently,
the later job's preflight reap kills the earlier job's live stack and the
failure reads like a code defect. Expect intermittent red on unrelated pull
requests until they are serialised (`needs: migration_runtime` on the replay
job is the cheapest fix) or given a dedicated runner label. Tracked in #78.

### Disk

160 GB per host. Docker images, npm caches, Supabase CLI archives, and
Playwright browsers accumulate. If a runner starts failing on disk pressure:

```bash
docker system prune -af --volumes
```

Schedule that monthly, or when the replay job begins failing at image pull.

## Security

This repository is **private**, which is what makes self-hosted runners safe
here. On a public repository, any fork pull request can execute arbitrary code
on the runner host.

- `secret_scan` already refuses to run for fork pull requests.
- Do not make this repository public while these runners are attached without
  first restricting workflow execution for outside contributors.
- Runner hosts hold no production credentials. CI env vars are placeholders,
  and the migration harnesses are local-only with no `--linked` path.

### Residual risk of persistent runners

These runners are **persistent, not ephemeral**. `npm ci` runs dependency
lifecycle scripts, and the Supabase CLI archive is cached under `$HOME` and
reused across runs. Anything a workflow writes to `$HOME` is available to
every later run on that host.

That is acceptable on a private repository with trusted collaborators. It
stops being acceptable the moment fork pull requests can trigger workflows.
The archive digest check exists precisely because a cached executable on a
shared, long-lived filesystem is not self-authenticating. If these runners
outlive the billing reset, move to **ephemeral** runners.

## Reverting to GitHub-hosted runners

The included minutes reset on **2026-08-01**. A decision is due then: revert,
adopt a paid plan, or keep self-hosted deliberately and make the runners
ephemeral. Tracked in issue #78.

To revert, replace every `runs-on: [self-hosted, Linux, X64]` with
`runs-on: ubuntu-latest`.

The reap steps and `PLAYWRIGHT_BROWSERS_PATH` become unnecessary but remain
harmless: a GitHub-hosted runner is a fresh VM, so the reaps find nothing.
The `actions/cache` step for Playwright should be restored at that point,
since an ephemeral runner has no persistent browser directory. The Supabase
CLI digest check should be kept regardless; it costs nothing and it is the
only thing authenticating that binary on any runner.

Running on both simultaneously is also possible by making the label set a
workflow input, but that adds a knob nobody will remember. Prefer a single
deliberate switch.

## Workflows still on GitHub-hosted runners

These were left alone on purpose, but they are **not usable until the reset**.
Dispatching any of them before 2026-08-01 will produce the same instant,
logless refusal.

| Workflow | Trigger | Why it was left |
| --- | --- | --- |
| `e2e-matrix.yml` | Weekly cron, Sundays 20:00 UTC | Next fire is 2 August, after the reset |
| `production-readiness.yml` | `workflow_dispatch` | Manual, and it links a remote project |
| `preproduction-verify.yml` | `workflow_dispatch` | Manual, and it links a remote project |
| `preproduction-alumni.yml` | `workflow_dispatch` | Manual |

Practical consequence: **there is no working release-verification path before
2026-08-01.** Do not plan a production release inside that window.
