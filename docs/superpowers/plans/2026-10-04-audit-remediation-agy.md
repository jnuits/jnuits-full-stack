# JnUITS audit remediation — AGY frontend plan

Approved2026-10-04. Base `68d8c3730d599b37b4bacb177bd48c0d28008958`; branch `codex/audit-frontend`.
Workspace: `C:\Users\redwan\.codex\worktrees\audit-frontend\jnuits-full-stack`.
Read the complete standalone handover at docs/operations/2026-10-04-agy-audit-remediation-handover.md. Codex implementation plan supplies backend dependencies.

## Scope

Keep JnUITS styling. Own frontend for F2/F4/F5/F7/F8/F10/F12 and custom-script nonce consumption; provide browser evidence for frontend and backend behaviors. Codex owns API/database/providers/backups/CI/final integration/PRs/merge/deployment.
No SQL, migrations, provider configuration, real approvals/roles, deployment or merge.

## Tasks

1. Read AGENTS.md, relevant installed Next.js docs, owner audit and shared contracts; run baseline checks; record exact base/branch.
2. F2: remove legacy email-only status lookup and all state/fetch handling; keep active intake discovery, invitation registration and support.
3. F4: neutral onboarding copy, CTAs /membership-form, /members/join redirect; report persisted CMS override to Codex.
4. F10/F12: truthful published summary and exactly one visible main landmark including loading/error/detail; keep skip/focus targets.
5. F5: dedicated subscription form with labeled email, unchecked explicit consent, privacy link, Turnstile, pending/validation/retry states; fix events anchor. Explicit-action /newsletter/confirm UI; no GET/load mutation; transient token; confirmed/preferences/invalid/expired/retry states.
6. F7: use archive contract; category-preserving pagination/category change=>page1; feature only first page; old posts reachable.
7. F8: notice/project detail metadata/canonical public-safe loader; preserve blog metadata.
8. CSP: use server x-nonce for dynamic root rendering and pass through a nonce provider to custom scripts and both Turnstile components. Never weaken headers.
9. Focused frontend checks and sanitized browser evidence at mobile/tablet/desktop in actual light/dark, keyboard/focus/overflow/error/pending states.
10. Return finding-to-commit matrix, branch/head, tests, screenshots, exact environment/revisions and backend blockers. Deliver commits, never merge/deploy.

## Dependencies and safety

Use subscribe/confirm and getPublishedBlogArchive contracts specified in handover. Independent tasks2–4 can begin immediately; API behavior is not complete until Codex publishes implementation.
All role-labeled credential-file entries are RBC test accounts; privately read Credentials.txt, separate role contexts, never record secrets or personal data. Production stays read-only except normal login/existing-factor verification. Disposable environments for mutations. Owner consenting mailbox required for real newsletter acceptance.
