# Opt-in pre-commit secret scanning

CI runs a full-history gitleaks scan on every push and PR (see
`.github/workflows/quality-gate.yml`), but by then the commit already exists on
the remote. This optional local hook scans staged content **before** a commit
is created, catching accidental secrets earlier.

## Install

```bash
git config core.hooksPath scripts/git-hooks
```

The hook requires the `gitleaks` binary:

- macOS: `brew install gitleaks`
- Windows: `scoop install gitleaks` or download from
  <https://github.com/gitleaks/gitleaks/releases>
- Linux: see the gitleaks releases page

If gitleaks is missing, the hook fails closed with instructions rather than
letting a commit through unscanned.

## Uninstall

```bash
git config --unset core.hooksPath
```

## Behavior

- Runs `gitleaks git --staged --redact=100 --verbose` on every commit.
- Uses the repo-root `.gitleaks.toml` configuration (default rules plus the
  narrow allowlist for known-public Fest slugs).
- Blocks the commit when a candidate secret is detected; remove the staged
  secret or, for verified false positives, refine the allowlist in
  `.gitleaks.toml`.
