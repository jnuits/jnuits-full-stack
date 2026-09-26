# Committee Onboarding Phase 2: Intake, Drafts, and Administrative Editing

> Implement test-first in `codex/committee-onboarding-phase-2`. Do not apply production migrations or merge/push without explicit approval.

**Goal:** Give authorized committee and membership administrators one safe workflow for manual entry, pasted tables, CSV, and XLSX; keep every import as an editable draft; publish accepted profiles and committee assignments atomically.

**Architecture:** Source adapters produce one bounded table model. Canonical mapping and validation produce deterministic draft decisions without changing published data. Phase 1 bulk-operation tables store drafts. Authenticated Server Actions enforce operation-specific permissions; a narrowly granted PostgreSQL function locks, revalidates, audits, and commits a full draft transaction.

**Stack:** Next.js 16 Server Actions, React 19, TypeScript, Zod, `csv-parse`, pinned `read-excel-file`, Supabase/PostgreSQL, Vitest, React Testing Library.

## Guardrails and exit criteria

- At most 2 MiB and 1,000 data rows; preserve identifiers as text.
- Support quoted/multiline CSV, pasted TSV, workbook sheet choice, and English/Bengali headers.
- Require full name, JnUITS ID, email, and explicit current/former/alumni classification. Committee rows also require term and position.
- Match only normalized JnUITS ID/email, never name. Both identifiers must resolve consistently.
- Blank cells never erase data; omitted appointments never remove assignments; identical appointments are no-ops.
- Invalid/conflicting rows remain until corrected or explicitly excluded.
- Draft work cannot mutate members, assignments, or public output.
- Publish is permission-checked, stale-write protected, idempotent, short, atomic, and audited.
- Member imports never change directory privacy or create auth/admin accounts.
- Only approved existing media records may be referenced; never fetch spreadsheet URLs.
- Preserve the existing theme. Antigravity owns later visual polish and broad browser responsiveness.

## Task 1 — Bounded source adapters

**Files:** add `intake-contracts.ts`, `parse-delimited.ts`, `parse-xlsx.ts` and focused tests under `src/lib/committee/onboarding/`; update package manifests.

1. Write failing tests for both limits, quoted/multiline CSV, TSV, blank/duplicate headers, Bengali text, text IDs, workbook sheet discovery, and selected-sheet parsing.
2. Pin `read-excel-file@9.3.10`; keep `csv-parse` as the only delimited parser.
3. Return one table shape containing headers, source row numbers, sheet metadata, and normalized scalar text.
4. Run focused tests and typecheck.

## Task 2 — Canonical mapping and row decisions

**Files:** add `field-catalog.ts`, `normalize-draft.ts`, and focused tests; extend `contracts.ts`.

1. Write failing tests for English/Bengali aliases, user mappings, required fields, identity normalization, split-identity conflicts, no name matching, blank-cell patch behavior, assignment no-ops, and approved-media checks.
2. Define canonical fields and operation-specific schemas.
3. Produce deterministic errors, warnings, identity keys, and proposed patches without database writes.
4. Run focused tests and typecheck.

## Task 3 — Draft lifecycle and transactional publish migration

**Files:** create a CLI-generated Supabase migration, add a migration contract/replay test, update scripts, regenerate database types.

1. First test grants, revision guards, operation routing, deterministic locks, idempotent completion, absence of auth-account creation, and audit insertion.
2. Add narrowly scoped database functions for row edits/exclusions and `commit_onboarding_draft(operation_id, expected_revision, make_current)`.
3. Derive the actor from `auth.uid()`, verify the operation permission, lock/re-read deterministically, and reject stale, unvalidated, or invalid drafts.
4. Commit member patches and non-destructive assignments atomically; retries return the completed result and identical assignments are no-ops.
5. Revoke public/anonymous execution; grant only required authenticated/service-role access. Use explicit schemas and an empty `search_path` for definer functions.
6. Replay migrations in scratch Postgres, regenerate types, and run contract tests.

## Task 4 — Authenticated intake and draft actions

**Files:** add `src/app/admin/onboarding/actions.ts`, `draft-repository.ts`, and focused tests.

1. Test permission routing, payload validation, source hashing, draft persistence, edit/exclude/revalidate revisions, stale publish rejection, and member-search pagination.
2. Implement source inspection, mapping/validation, draft creation, row edit/exclusion, revalidation, paginated identity search, and publish actions.
3. Require `committee.manage` for rosters and the existing membership-management permission for member imports; never accept a client-selected permission.
4. Keep source bytes ephemeral; persist source metadata/hash, mappings, normalized decisions, and audit-safe errors only.

## Task 5 — Shared functional onboarding workspace

**Files:** add `src/components/admin/onboarding/intake-workspace.tsx`, DOM tests, and template helpers/tests.

1. Test manual/CSV/XLSX/paste selection, sheet selection, mapping, validation summaries, row correction, exclusion/reinclusion, and guarded publish confirmation.
2. Implement one accessible workspace parameterized by operation type and target term.
3. Add downloadable CSV/XLSX templates without member data.
4. Preserve current admin theme and keyboard semantics; do not redesign.

## Task 6 — Committee integration

**Files:** update committee page/actions/workspace; add a position editor and tests.

1. Test paginated member search, term-scoped position validation, priority ordering, and draft handoff.
2. Replace the legacy direct CSV commit surface with the shared draft workspace.
3. Replace the fixed 500-member dependency with server-side search.
4. Add audited per-term position editing for labels, group, priority, visibility, minimum, maximum, and target.

## Task 7 — Membership integration

**Files:** update membership page/client; add a reusable member-profile editor and tests.

1. Test that member-profile imports share the pipeline and do not alter directory privacy, portal access, or admin roles.
2. Embed the workspace for `member_profile_import`.
3. Add an audited profile editor using canonical validation and blank-cell semantics.

## Task 8 — Phase 2 verification and handoff

1. Run focused tests continuously, then typecheck, lint, DOM and Node suites, migration replay/contract tests, access/UI audits, and a production build.
2. Review the complete diff for security, data-loss risk, permission drift, secrets/PII, and accidental theme changes.
3. Confirm only intended Phase 2 changes remain.
4. Report evidence and Phases 3–5. Ask before merge/push, production migration, or deployment.
