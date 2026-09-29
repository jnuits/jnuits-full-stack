# Member Intake, Catalog, and Import Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Membership DB the single, reliable intake workspace for manual member creation, CSV/XLSX/paste imports, and one-time public Google Sheet snapshots, with canonical department codes, exact two-digit batches, joining dates, actionable validation, and complete templates for every browser bulk-import surface.

**Architecture:** Pure catalog and field-normalization functions define one intake contract. All source adapters feed the existing persisted onboarding draft pipeline; only explicit draft publication mutates canonical members. Department aliases resolve to the existing internal foreign key, while generated templates and validation read the same active catalog. Remote Sheet capture is a bounded, allowlisted server-side adapter, not a synchronization service.

**Tech Stack:** Next.js 16 App Router and Route Handlers, React 19, TypeScript, Zod, Supabase/PostgreSQL, `csv-parse`, `read-excel-file`, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-29-membership-lifecycle-committee-finalization-design.md`

## Global Constraints

- Execute this plan before the renewal, committee-finalization, and photo plans dated 2026-09-29.
- Before changing any Route Handler, Server Action, cache, or form code, read the relevant local Next.js 16 guides in `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `09-revalidating.md`, `08-caching.md`, and `node_modules/next/dist/docs/01-app/02-guides/forms.md`.
- Keep `members` as the only canonical person/membership identity and keep `departments.code` as the internal foreign key.
- Do not create members from Committee administration. Do not delete the shared draft engine merely because the Committee entry point is removed later.
- Require full name, JnUITS ID unless an approved allocator supplies it, email, classification, department, two-digit batch, and official joining date for new manual/imported members.
- Accept batch text only as `01` through `99`; store `1` through `99`; export with a leading zero; display a correct English ordinal.
- Resolve department input case-insensitively through an unambiguous short code, full name, legacy slug, or reviewed alias. Never silently guess an ambiguous department.
- Accumulate safe row errors and never reveal another member's email, ID, phone, or other private conflict value.
- Treat a public Google Sheet as a one-time snapshot. Do not add OAuth, edit access, refresh, polling, arbitrary URL fetches, or remote image imports.
- Preserve the current theme and existing draft review/commit safety rules.
- Use the Supabase skill and refresh official Supabase guidance before DDL. Create migration files with the Supabase CLI when available and preserve the ordered filename specified below.

## Review Focus

- `CSE`, `Computer Science & Engineering`, and `computer-science-engineering` resolve to one internal department, while ambiguous aliases fail closed.
- `07` and `08` survive CSV/XLSX/paste/Google-Sheet import and export; `7`, `7th`, `00`, and `100` are rejected with a usable correction.
- Every rejected row reports row, field, safe received value, stable code, real cause, accepted format, and an example.
- Templates, instructions, sample rows, department downloads, and live validation are generated from the same field/catalog definitions.
- Google Sheet capture cannot become an SSRF primitive and produces the same normalized draft as equivalent uploaded CSV bytes.

---

### Task 1: Canonical department, batch, and joining-date domain

**Files:**
- Create: `src/lib/membership/intake-fields.ts`
- Create: `src/lib/membership/intake-fields.test.ts`
- Modify: `src/lib/committee/onboarding/field-catalog.ts`
- Create: `src/lib/committee/onboarding/field-catalog.test.ts`

**Interfaces:**
- Add `DepartmentCatalogEntry`, `DepartmentResolution`, and `IntakeFieldIssue` types.
- Add `resolveDepartmentInput(value, catalog)`, `parseBatchCode(value)`, `formatBatchCode(batchNo)`, `formatBatchOrdinal(batchNo)`, and `parseJoiningDate(value)`.
- Extend `OnboardingFieldDefinition` with required/optional status, accepted format, limits, and examples so templates and validation share one source.

- [ ] **Step 1: Write failing pure-domain tests**

  Cover short-code/full-name/slug/alias resolution, case and whitespace normalization, ambiguous/missing aliases, exact `01`-`99` batch parsing, preserved leading zero formatting, ordinal exceptions (`11th`, `12th`, `13th`, `21st`), strict `YYYY-MM-DD`, impossible dates, and no browser-timezone coercion.

- [ ] **Step 2: Run the tests and verify RED**

  Run: `npx vitest run --project node src/lib/membership/intake-fields.test.ts src/lib/committee/onboarding/field-catalog.test.ts`

  Expected: FAIL because the domain module and enriched catalog contract do not exist.

- [ ] **Step 3: Implement the smallest pure contract**

  Keep database keys and display codes separate. Return structured issues rather than preformatted generic strings. Do not normalize `7`, `7th`, or `Batch 07` into valid values.

- [ ] **Step 4: Run focused tests and typecheck**

  Run: `npx vitest run --project node src/lib/membership/intake-fields.test.ts src/lib/committee/onboarding/field-catalog.test.ts`

  Run: `npm run typecheck`

  Expected: PASS with exact field behavior and zero type errors.

- [ ] **Step 5: Commit**

  Commit: `feat(membership): define canonical intake fields`

### Task 2: Department catalog and member joining-date migration

**Files:**
- Create: `supabase/migrations/20260929110000_member_intake_catalog.sql`
- Create: `src/lib/membership/intake-catalog-migration.test.ts`
- Modify: `src/lib/db/types.ts` (generated only)
- Modify: `src/lib/committee/onboarding/generated-db-types.test.ts`

**Database contract:**
- Add `departments.short_code` with uppercase-format and case-insensitive uniqueness enforcement after reviewed backfill.
- Add `department_aliases(department_code, alias, normalized_alias, alias_kind, is_active, timestamps)` with one globally unique normalized alias and operator-only writes.
- Add `members.joined_on date` without inventing legacy dates.
- Tighten `members.batch_no` to `1 <= batch_no <= 99` after a preflight that reports invalid existing values.
- Extend `bulk_operations.source_kind` to include `google_sheet` and leave existing source kinds valid.

- [ ] **Step 1: Write a failing migration contract test**

  Assert additive columns/table/indexes, uppercase/uniqueness checks, alias non-ambiguity, batch range, RLS/grants, Google source-kind compatibility, no cycle-table deletion, and no fabricated `joined_on` backfill.

- [ ] **Step 2: Run the contract test and verify RED**

  Run: `npx vitest run --project node src/lib/membership/intake-catalog-migration.test.ts`

  Expected: FAIL because the migration is absent.

- [ ] **Step 3: Add the reviewed catalog migration**

  Build the 38-row active short-code mapping from official Jagannath University naming evidence and a reviewed project fixture. Seed short code, full name, legacy slug, and approved historical aliases; abort before `NOT NULL` if an active department is unmapped or two aliases normalize identically. Use no generated UUID literals and do not rewrite foreign keys.

- [ ] **Step 4: Replay migrations and regenerate canonical types**

  Run: `npm run db:replay-bootstrap`

  Run: `npm run db:types:generate`

  Expected: clean scratch replay; `src/lib/db/types.ts` changes only through generation.

- [ ] **Step 5: Run contract/type tests**

  Run: `npx vitest run --project node src/lib/membership/intake-catalog-migration.test.ts src/lib/committee/onboarding/generated-db-types.test.ts`

  Run: `npm run typecheck`

  Expected: PASS, including typed access to `departments.short_code`, `department_aliases`, and `members.joined_on`.

- [ ] **Step 6: Commit**

  Commit: `feat(db): add member intake catalog fields`

### Task 3: Actionable normalization and conflict diagnostics

**Files:**
- Modify: `src/lib/committee/onboarding/contracts.ts`
- Modify: `src/lib/committee/onboarding/normalize-draft.ts`
- Modify: `src/lib/committee/onboarding/draft-repository.ts`
- Modify: `src/app/admin/onboarding/actions.ts`
- Modify: `src/lib/committee/onboarding/normalize-draft.test.ts`
- Modify: `src/lib/committee/onboarding/draft-repository.test.ts`
- Modify: `src/app/admin/onboarding/actions.test.ts`
- Create: `src/lib/committee/onboarding/error-report.ts`
- Create: `src/lib/committee/onboarding/error-report.test.ts`

**Interfaces:**
- Enrich `OnboardingRowIssue` with `sourceRow`, `field`, `code`, `receivedValue`, `explanation`, `acceptedFormat`, and `example`.
- Add `ExistingDepartmentSnapshot` and load the active department/alias catalog once per draft validation.
- Add `createOnboardingErrorReport(rows)` for a spreadsheet-safe downloadable CSV.
- Extend member-profile draft patches with `joined_on` and canonical numeric `batch_no`.

- [ ] **Step 1: Write failing normalization and privacy tests**

  Cover all accepted department forms; `07`/`08`; malformed batch/date/classification; multiple safe issues on one row; split-identity conflicts without echoing the existing member's private value; parser failures with source and expected format; blank-cell semantics; and idempotent identical-member rows.

- [ ] **Step 2: Run focused tests and verify RED**

  Run: `npx vitest run --project node src/lib/committee/onboarding/normalize-draft.test.ts src/lib/committee/onboarding/draft-repository.test.ts src/lib/committee/onboarding/error-report.test.ts src/app/admin/onboarding/actions.test.ts`

  Expected: FAIL on the old `{ code, field, message }` issue shape and missing catalog fields.

- [ ] **Step 3: Implement structured issues end to end**

  Resolve aliases before proposing the internal department key, parse batch/date with Task 1 helpers, keep issue data structured in persisted drafts, and format human text only at presentation/export boundaries. Preserve existing identity-matching and stale-draft protections.

- [ ] **Step 4: Run focused tests and typecheck**

  Run: `npx vitest run --project node src/lib/committee/onboarding/normalize-draft.test.ts src/lib/committee/onboarding/draft-repository.test.ts src/lib/committee/onboarding/error-report.test.ts src/app/admin/onboarding/actions.test.ts`

  Run: `npm run typecheck`

  Expected: PASS; no error exposes a conflicting database email or JnUITS ID.

- [ ] **Step 5: Commit**

  Commit: `feat(membership): return actionable intake errors`

### Task 4: Generated blank templates, samples, and reference sheets

**Files:**
- Modify: `src/lib/exports/xlsx.ts`
- Modify: `src/lib/committee/onboarding/templates.ts`
- Modify: `src/lib/committee/onboarding/templates.test.ts`
- Modify: `src/app/api/admin/onboarding/template/route.ts`
- Modify: `src/app/api/admin/onboarding/template/route.test.ts`
- Create: `src/lib/membership/department-catalog.ts`
- Create: `src/lib/membership/department-catalog.test.ts`

**Interfaces:**
- Add `XlsxWorksheet` and `createXlsxWorkbookFromSheets(sheets)` while preserving `createXlsxWorkbook(table, sheetName)` as a one-sheet wrapper.
- Extend the template route with `kind=blank|sample|department-codes` and `format=csv|xlsx`.
- Generate fictional sample identities only; the sample XLSX sheets are `Member profiles`, `Instructions`, and `Department codes`.
- Load active departments through a server-only `getActiveDepartmentCatalog()` with explicit columns and deterministic ordering.

- [ ] **Step 1: Write failing workbook/template tests**

  Assert valid multi-sheet relationships, sanitized sheet names, shared field ordering, no formula injection, no production-looking emails/IDs, exact two-digit sample batches including `08`, matching instruction text, and a department download containing CSE plus its official name but no internal-only columns.

- [ ] **Step 2: Run focused tests and verify RED**

  Run: `npx vitest run --project node src/lib/committee/onboarding/templates.test.ts src/lib/membership/department-catalog.test.ts src/app/api/admin/onboarding/template/route.test.ts`

  Expected: FAIL because only blank single-sheet output exists.

- [ ] **Step 3: Implement generated guidance artifacts**

  Build every artifact from the field catalog and active department DTO. Keep CSV artifacts separate; include instructions and catalog worksheets in XLSX samples. Apply the same permission and content-disposition safety as the current route.

- [ ] **Step 4: Run focused tests and typecheck**

  Run: `npx vitest run --project node src/lib/committee/onboarding/templates.test.ts src/lib/membership/department-catalog.test.ts src/app/api/admin/onboarding/template/route.test.ts`

  Run: `npm run typecheck`

  Expected: PASS for blank CSV/XLSX, sample CSV/XLSX, and department-code CSV.

- [ ] **Step 5: Commit**

  Commit: `feat(membership): generate import samples and references`

### Task 5: Bounded public Google Sheet snapshot adapter

**Files:**
- Create: `src/lib/committee/onboarding/google-sheet.ts`
- Create: `src/lib/committee/onboarding/google-sheet.test.ts`
- Modify: `src/lib/committee/onboarding/contracts.ts`
- Modify: `src/lib/committee/onboarding/draft-repository.ts`
- Modify: `src/app/admin/onboarding/actions.ts`
- Modify: `src/app/admin/onboarding/actions.test.ts`

**Interfaces:**
- Add `parsePublicGoogleSheetUrl(input)` returning only a sanitized document ID and selected `gid`.
- Add `fetchPublicGoogleSheetSnapshot(source, options)` returning bounded bytes, content type, fetch time, SHA-256 digest, document ID, and sheet ID.
- Accept only `https://docs.google.com/spreadsheets/d/{id}/...`; construct the export URL internally.

- [ ] **Step 1: Write failing URL/fetch-policy tests**

  Cover wrong scheme/host/path, encoded host confusion, credentials/ports/fragments, valid edit/share URLs, default and explicit `gid`, private/unavailable sheets, abort timeout, non-CSV content, oversized streaming response, excessive rows, allowed Google redirect chain, redirect loop, and redirect to a non-allowlisted host.

- [ ] **Step 2: Run focused tests and verify RED**

  Run: `npx vitest run --project node src/lib/committee/onboarding/google-sheet.test.ts src/app/admin/onboarding/actions.test.ts`

  Expected: FAIL because `google_sheet` capture is not implemented.

- [ ] **Step 3: Implement one-time capture**

  Use an injected `fetch` in tests, `AbortController`, manual bounded redirects, a strict Google-host allowlist, streamed byte accounting, content-type validation, and the existing CSV row limit. Persist only sanitized provenance and digest; pass bytes to the existing delimited parser.

- [ ] **Step 4: Prove source equivalence**

  Add a repository test showing uploaded CSV, pasted rows, and a fetched Sheet snapshot create equal mapped/normalized member draft decisions for equal bytes.

- [ ] **Step 5: Run focused tests and typecheck**

  Run: `npx vitest run --project node src/lib/committee/onboarding/google-sheet.test.ts src/lib/committee/onboarding/draft-repository.test.ts src/app/admin/onboarding/actions.test.ts`

  Run: `npm run typecheck`

  Expected: PASS without reflecting remote response bodies or network internals in user errors.

- [ ] **Step 6: Commit**

  Commit: `feat(membership): import public sheet snapshots`

### Task 6: Membership DB intake UX and manual editor parity

**Files:**
- Modify: `src/components/admin/onboarding/intake-workspace.tsx`
- Modify: `src/components/admin/onboarding/intake-workspace.dom.test.tsx`
- Modify: `src/components/admin/membership-db-client.tsx`
- Modify: `src/components/admin/member-profile-editor.tsx`
- Modify: `src/app/admin/membership/profile-actions.ts`
- Modify: `src/app/admin/membership/profile-actions.test.ts`
- Modify: `src/app/admin/membership/page.tsx`

**Interfaces:**
- Add a Sheet-link capture mode alongside manual/file/paste.
- Show blank/sample/reference downloads, concise field instructions, inline structured row issues, and a downloadable error report.
- Add required `joined_on`, short-code department selection, and exact two-digit batch entry to manual create/edit paths.

- [ ] **Step 1: Write failing DOM/action tests**

  Assert all source modes, all guidance links, accessible labels/descriptions, row-specific corrective errors, Sheet privacy guidance, no Committee-import wording, department reference access, two-digit batch display, and manual/profile action parity with import normalization.

- [ ] **Step 2: Run focused tests and verify RED**

  Run: `npm run test:dom -- src/components/admin/onboarding/intake-workspace.dom.test.tsx`

  Run: `npx vitest run --project node src/app/admin/membership/profile-actions.test.ts`

  Expected: FAIL on the missing controls and fields.

- [ ] **Step 3: Implement the intake UI without redesigning it**

  Use existing admin panels/buttons, disclose consequences before commit, keep parsing/validation server-authoritative, and render issue data without `dangerouslySetInnerHTML`.

- [ ] **Step 4: Run focused tests, responsive audit, and typecheck**

  Run: `npm run test:dom -- src/components/admin/onboarding/intake-workspace.dom.test.tsx`

  Run: `npx vitest run --project node src/app/admin/membership/profile-actions.test.ts`

  Run: `npm run audit:admin-ui`

  Run: `npm run typecheck`

  Expected: PASS with keyboard-accessible controls and no risky layout pattern.

- [ ] **Step 5: Commit**

  Commit: `feat(admin): complete membership intake guidance`

### Task 7: Bring remaining browser bulk imports under the guidance contract

**Files:**
- Create: `src/lib/admin/bulk-operation-templates.ts`
- Create: `src/lib/admin/bulk-operation-templates.test.ts`
- Create: `src/app/api/admin/bulk-operations/template/route.ts`
- Create: `src/app/api/admin/bulk-operations/template/route.test.ts`
- Modify: `src/app/admin/bulk-operations/page.tsx`
- Modify: `src/app/admin/bulk-operations/actions.ts`
- Modify: `src/lib/certificates/admin-import.ts`
- Modify: `src/lib/certificates/admin-import.test.ts`
- Modify: `src/components/admin/certificate-csv-import-panel.tsx`
- Create: `src/app/api/admin/certificates/import-template/route.ts`
- Create: `src/app/api/admin/certificates/import-template/route.test.ts`
- Remove: `public/templates/jnuits-certificate-import-template.csv` only after generated replacements are linked and tested

**Interfaces:**
- Provide blank and fictional sample CSV/XLSX artifacts plus field instructions for each still-visible legacy bulk operation and certificate import.
- Reuse `IntakeFieldIssue` shape or a shared equivalent for row, field, received value, cause, accepted format, and example.

- [ ] **Step 1: Inventory visible operations in tests**

  Add a table-driven test that fails unless every operation rendered by `/admin/bulk-operations` has blank/sample artifacts and instructions. Add certificate tests for separate blank/sample files and all-row diagnostics.

- [ ] **Step 2: Run focused tests and verify RED**

  Run: `npx vitest run --project node src/lib/admin/bulk-operation-templates.test.ts src/lib/certificates/admin-import.test.ts src/app/api/admin/bulk-operations/template/route.test.ts src/app/api/admin/certificates/import-template/route.test.ts`

  Expected: FAIL because the remaining surfaces do not satisfy the contract.

- [ ] **Step 3: Implement generated artifacts and actionable errors**

  Use fictional data, spreadsheet-cell protection, operation permissions, and the same accepted-value definitions as validation. Do not broaden old bulk-operation privileges or change operation semantics.

- [ ] **Step 4: Run focused and DOM suites**

  Run: `npx vitest run --project node src/lib/admin/bulk-operation-templates.test.ts src/lib/certificates/admin-import.test.ts src/app/api/admin/bulk-operations/template/route.test.ts src/app/api/admin/certificates/import-template/route.test.ts`

  Run: `npm run test:dom`

  Run: `npm run typecheck`

  Expected: PASS and no static link remains to the old combined certificate sample.

- [ ] **Step 5: Commit**

  Commit: `feat(admin): standardize bulk import guidance`

### Task 8: Intake plan integration verification

**Files:**
- Modify only tests/docs/scripts if a verified gap is found; do not mix in renewal or committee-finalization implementation.

- [ ] **Step 1: Run focused intake and migration suites**

  Run: `npx vitest run --project node src/lib/membership src/lib/committee/onboarding src/lib/certificates/admin-import.test.ts src/lib/admin/bulk-operation-templates.test.ts src/app/admin/onboarding/actions.test.ts src/app/admin/membership/profile-actions.test.ts`

  Run: `npm run db:verify-committee-onboarding`

- [ ] **Step 2: Run repository quality gates**

  Run: `npm run typecheck`

  Run: `npm run lint`

  Run: `npm run test:node`

  Run: `npm run test:dom`

  Run: `npm run build`

  Run: `npm run audit:admin-access`

  Run: `npm run audit:admin-ui`

- [ ] **Step 3: Run clean schema replay and secret/credential checks**

  Run: `npm run db:replay-bootstrap`

  Run the repository's migration integrity/order/runtime checks and committed credential-material checks from `package.json`/CI.

- [ ] **Step 4: Perform browser verification**

  Verify Membership DB manual, file, paste, and Sheet flows plus downloads at 375, 768, 1024, and 1440 CSS pixels in light/dark themes. Confirm keyboard operation, focus visibility, screen-reader names, actionable errors, and zero horizontal overflow. Use only fictional test data.

- [ ] **Step 5: Review the complete diff**

  Confirm no Committee roster importer was added, no member data or credentials entered samples, no arbitrary URL fetch is possible, and the pre-existing untracked Phase 4–5 plan remains untouched.

- [ ] **Step 6: Commit verification-only corrections**

  Commit: `test(membership): verify intake and catalog workflow`
