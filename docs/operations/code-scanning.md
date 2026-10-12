# Code scanning operations

JnUITS runs GitHub's default CodeQL setup and a complementary free Semgrep Community Edition workflow. This change configures scanning and evidence collection; findings await triage before any application fixes.

## Semgrep configuration

- Workflow: `.github/workflows/semgrep.yml`, on every pull request, main push, manual dispatch and Monday at 09:37 Asia/Dhaka (03:37 UTC).
- Semgrep CE 1.180.0, pinned by immutable container digest. Checkout, SARIF upload and artifact actions are pinned to full commit SHAs.
- Community rule packs: `p/security-audit`, `p/nodejs`, `p/typescript`, `p/github-actions`. Registry packs are fetched at scan time and may evolve; JSON/SARIF preserve the rules/results used for each revision.
- Scan first-party code, configuration, scripts and tests. `.semgrepignore` excludes generated evidence/dependencies/private local settings. No application credentials, Semgrep account/token, product build, autofix or subscription is needed; metrics and version checks are disabled.
- Findings are informational while the initial baseline is triaged. Scanner/configuration failures, other engine errors, and failed artifact/SARIF uploads fail the workflow. No exit-code suppression or `continue-on-error` is used.
- Known CE partial-parser warnings for otherwise valid JSX, TypeScript generics and templated Bash are surfaced in job summaries, warning annotations and full JSON/SARIF evidence. No affected source file is excluded to hide a warning. All other reported engine errors fail the job. CodeQL remains enabled and provides complementary analysis; CE does not provide paid inter-file analysis.
- Same-repository trusted PRs and main publish to GitHub Security → Code scanning under category `semgrep-ce`. Fork/Dependabot PRs retain scan artifacts without attempting privileged SARIF upload.
- Artifacts `semgrep-ce-results` retain JSON and SARIF for 14 days. Local reports remain in ignored `artifacts/reports/`. A green scan means successful execution, not absence of confirmed vulnerabilities.

## Triage after the merges

Wait for both scanners on the final main SHA. Record rule/tool, file/line, severity, first/last analysis revision and any coverage limitation. Separate production code from development operators, fixtures and tests. Validate exploitability, existing sanitizers and permission boundaries before calling a scanner alert a vulnerability. Deduplicate overlapping findings. Do not automatically dismiss findings, mutate real user records or apply broad fixes just to silence a scanner.

No new database migration or provider configuration is required.

## Existing branch inventory

PR #177 updates pinned GitHub Actions and merged only after its non-Vercel checks passed. The committee release PRs #179/#180 and all remote release branches were already merged. The quota-blocked main Required CI run passed when retried through the JnUITS GitHub connection after the repository became public.

Older local branches are preserved, not blindly re-merged: AI/IT Fest, audit frontend/follow-up, audit acceptance and footer patches are patch-equivalent to main. Telemetry fixtures, theme integration and CSP diagnostics match the released source; the older interaction spec is superseded by the released CSP diagnostics. PR #155 already delivered the old audit-v2 hardening; its event-export correction matches main and subsequent main dependency/security updates supersede the old package snapshot. Original theme screenshot artifacts remain historical evidence rather than publication inputs.

Preserve `backup/pre-ai-it-fest-2026`, the owner files, existing worktrees and execution ledgers. Their presence does not mean unmerged release work remains.

## References

- [Semgrep CE workflow configuration](https://semgrep.dev/docs/semgrep-ci/sample-ci-configs)
- [Semgrep CLI exit codes and parser warnings](https://semgrep.dev/docs/cli-reference/)
- [Semgrep metrics controls](https://semgrep.dev/docs/metrics)
- [GitHub SARIF integration](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/integrate-with-existing-tools/upload-sarif-file)
