# Self-Hosted Runners

The `jnuits` account exhausted its 2,000 included GitHub Actions minutes on
2026-07-27, six days before the 1 August reset. Every job in Quality Gate runs
350 and 352 was refused before starting: jobs reported failure in 2-3 seconds
with no step logs and no artifacts. No code was at fault.

The Quality Gate now runs on three dedicated self-hosted runners.

## Runners

| Name | Labels | Spec |
| --- | --- | --- |
| `jnuits-full-stack-1` | `self-hosted`, `Linux`, `X64` | 8 GB / 160 GB, Ubuntu 24.04 LTS, SGP1, +4 GB swap |
| `jnuits-full-stack-2` | same | same |
| `jnuits-full-stack-3` | same | same |

Three runners, eight jobs. Jobs queue in dependency order rather than all
starting at once. A full green run takes roughly three waves.

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

### Reaping is repository-scoped by assumption

The reap steps match `name=supabase_`, which would also remove an unrelated
Supabase stack on the same host. These runners are dedicated to this
repository, so that is acceptable. **Do not** attach these runners to another
project that runs Supabase locally without narrowing the filter.

### Disk

160 GB per host. Docker images, npm caches, and Playwright browsers accumulate.
If a runner starts failing on disk pressure:

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

## Reverting to GitHub-hosted runners

After the 1 August reset, or if a paid plan is adopted, replace every
`runs-on: [self-hosted, Linux, X64]` with `runs-on: ubuntu-latest`.

The reap steps and `PLAYWRIGHT_BROWSERS_PATH` become unnecessary but remain
harmless: a GitHub-hosted runner is a fresh VM, so the reaps find nothing.
The `actions/cache` step for Playwright should be restored at that point,
since an ephemeral runner has no persistent browser directory.

Running on both simultaneously is also possible by making the label set a
workflow input, but that adds a knob nobody will remember. Prefer a single
deliberate switch.
