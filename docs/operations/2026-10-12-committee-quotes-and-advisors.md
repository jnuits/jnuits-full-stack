# Committee quotes and advisor management — 12 October 2026

This release integrates AGY's public committee presentation (0d2131f) and adds the admin/database support in PR #179.

## Operator use

Open /admin/committee. Edit the appointment for President or General Secretary and enter Leadership speech / quote (maximum 160 characters). The quote belongs to that committee tenure; leaving it blank hides the quote. Internal assignment notes remain private. Other appointments retain their normal editing controls.

Manage Chief Advisor, Moderator / Mentor and Honorable Advisor records in the advisor section. Name/honorific, designation, department, public biography, speech, status note, portrait URL, faculty link, dates/current status, visibility and display order remain editable. A saved advisor speech takes precedence over biography in featured quotes. Order zero remains valid. Date changes recompute tenure display.

Archive advisor asks for confirmation and removes publication from the board and public history. It preserves the profile, historical data and linked portal account. Restore publication by editing visibility/current status. To show a former advisor in history, leave publication enabled and current status disabled.

Existing committee-management permissions, session/MFA policy and public eligibility rules remain enforced. No real profiles, appointments, roles or Auth accounts were modified to test these controls.

## Verification and release evidence

- Full local suite: 2,090 tests across 316 files passed; lint/typecheck, production build, access/UI/dependency audits, immutable SQL integrity and strict migration order passed.
- Clean SQL replay passed with permission/RLS, concurrency and generated-type checks; actual speech constraint accepts null and 160 Latin/Bengali characters and rejects 161.
- Canonical regeneration also includes three already-deployed profile RPCs previously missing from committed types. Their SQL was not reapplied.
- Read-only synthetic committee fixtures are confined to explicit flags and the reserved example.supabase.co endpoint. No Auth, mail or CAPTCHA fixtures are introduced.
- Keyboard term selection now moves focus; every dialog close returns focus to the card.
- Chromium and WebKit passed six local production-build scenarios. Settled Axe: zero WCAG A/AA violations and no overflow at 360/768/1280 in light and dark. No public card CSS classes changed.
- Local Firefox lacks Windows runtime DLLs. Required Linux release smoke supplies Firefox evidence before merge.
- Screenshot/trace evidence stays ignored locally; CI preserves committee screenshots in release artifacts. Public production smoke includes committee interactions.

## Database receipt

Only the new nullable speech column/check/comment migration is applied. Existing records, privileges and RLS policies are compared before/after using metadata and digests, without exposing personal records. Rollback of application code can leave the nullable column safely in place; do not drop live data for rollback.

Applied version, committed SQL hash, CI run links, pre/post comparison and production outcome are recorded below after verification.

- Supabase assigned version: `20261012090254`; reconciled from `20261012080601` without changing SQL.
- Canonical Git SQL SHA-256: `d6073983009444598eb87c149ed0ad26d67296d43fdbae96fce5672953d08fae`; Git blob: `b0f56892aaa5ee4ca5530616f12f627d15980c9a`.
- Hosted stored statement exactly equals the canonical Git payload. Constraint validated; maximum char_length 160. REST schema-only verification returned zero rows successfully.
- Pre/post: 28 assignments, 10 advisors, 24 members; their digests, public ACL digest and RLS policy digest all unchanged. Both committee tables retain RLS.
- Pre-migration required CI: [38225176989](https://github.com/jnuits/jnuits-full-stack/actions/runs/38225176989), success on retry. All 168 browser scenarios passed on the first attempt. Only the external ECR-limited type-generator download required retry.
- The final application rollout is tracked in [PR #179](https://github.com/jnuits/jnuits-full-stack/pull/179). Final required checks, hosted parity and production deployment/browser results are preserved in its checks and the ignored execution ledger `.superpowers/sdd/2026-10-12-committee-admin-handover/progress.md`.
