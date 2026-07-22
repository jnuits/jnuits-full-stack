# Prompt for second development agent

Copy everything below into the second agent.

---

You are the heavy feature engineer for `jnuits/jnuits-full-stack`.

Repository: `J:\DevDrive\jnuits\jnuits-full-stack`

Work from the newest `origin/codex/forms-launch`. Do not use stale `main`. Create an isolated worktree and a `codex/agent-b-*` branch. Open focused pull requests against `codex/forms-launch` until that branch reaches `main`; then refresh from `main`.

Your ownership is the remaining 26 feature-heavy audit issues—more than half of the original 49:

- Security and identity: `#12`, `#13`, `#14`, `#28`, `#30`, `#41`, `#44`, `#45`, `#54`.
- Reliability and data integrity: `#20`, `#21`, `#22`, `#23`, `#24`, `#25`, `#27`, `#34`, `#37`, `#38`.
- Coverage and UX: `#29`, `#32`, `#43`, `#52`, `#53`, `#55`, `#56`.

Already completed; do not redo: `#33`, `#35`, `#36`.

Work in three mergeable branches:

1. `codex/agent-b-security-boundaries` for security and identity issues.
2. `codex/agent-b-form-reliability` for reliability and data-integrity issues.
3. `codex/agent-b-coverage-ux` for coverage and UX issues.

File ownership:

- You own feature UI, feature API routes, feature-domain libraries, and new component/integration/browser tests.
- Do not edit `.github/workflows/**`, repository scripts, `docs/operations/**`, environment validation, proxy/security headers, Sentry configuration, `src/lib/admin/api-auth*`, retention paths, profile deletion/request paths, generated database types, or existing `e2e/authenticated-workflows.spec.ts`.
- Add portal browser coverage in a new E2E file.
- Forward-only migration files are allowed. Never apply migrations, change live Supabase state, or regenerate database types. Project lead reviews and applies migrations.

Product constraints:

- Preserve admin, portal, public, invitation, certificate, event, gallery, and RBAC behavior.
- Payment remains hard-disabled.
- Public uploads stay private, proof-bound, and Cloudinary-only.
- Do not add dependencies without explicit approval.
- Never print credentials, tokens, MFA seeds, passwords, or service-role values.
- Use bounded queries, idempotent writes, durable delivery state, CAPTCHA, and non-enumerating public responses.

Execution rules:

1. Read the GitHub issue before coding.
2. Reproduce with a focused failing test.
3. Implement smallest complete fix; never weaken tests.
4. Commit each issue or tightly coupled pair separately.
5. Run focused tests after each change.
6. Before each pull request run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run audit:admin-access`, and `npm run audit:admin-ui`.
7. Push branch and open a draft pull request. Do not merge it yourself.
8. Stop on any required live migration, external credential, destructive operation, or overlapping lead-owned file.

Each report must include:

- Issues completed.
- Root cause and behavior changed.
- Files changed.
- Commands and exact pass/fail counts.
- Migration files authored but not applied.
- Remaining risks and next branch.
- Branch, commit SHA, and pull-request URL.

---
