# Committee Onboarding Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the typed contracts and migration foundation for safe committee/member draft onboarding without changing public committee behavior or production data.

**Architecture:** Keep `committee_roles` as the global dictionary and add `committee_term_positions` as a per-term overlay. Extend existing bulk-operation staging with provenance, revision, target-term, and row-exclusion state, then route access by operation type through existing RBAC permissions. Preserve current terms and appointments, and prove the migration through static tests and the disposable PostgreSQL 17 replay.

**Tech Stack:** Next.js 16, TypeScript, Zod, Vitest, Supabase/PostgreSQL 17, Supabase CLI 2.109.1, existing RBAC and migration replay harness.

**Spec:** `docs/superpowers/specs/2026-09-23-committee-member-onboarding-design.md`

## Global Constraints

- Preserve the theme, header, committee tabs, historical URLs, advisor workflow, and current public rendering during Phase 1.
- Work only on `codex/committee-onboarding` in the isolated committee-onboarding worktree.
- Keep `committee_roles` global; model term-specific behavior in `committee_term_positions`.
- Preserve every existing term and assignment, including hidden legacy and display-only records.
- Add no authentication account, password, invitation, role assignment, or public `members` grant.
- `committee_roster_import` requires `admin.committee.manage`; `member_profile_import` requires `admin.membership.manage`; existing bulk types continue to require `admin.bulk.manage`.
- Enable RLS on every new public-schema table and use explicit least-privilege grants.
- Reuse `set_current_timestamp_updated_at()` and `has_permission(text)`; do not create a parallel authorization system.
- Use Supabase CLI 2.109.1 and the disposable replay harness; never point replay commands at a linked or production project.
- Preserve the approved intake ceilings of 1,000 data rows and 2 MiB for Phase 2; Phase 1 contracts must not make those limits impossible to enforce.
- Do not fabricate roster data, delete legacy records, apply an unreviewed migration to production, remove the backup branch, edit historical migration bytes, or run `git add --renormalize` on migrations.

## Review Focus

- A hidden legacy term may share committee number 1, while a second public executive term with number 1 must fail; Task 3 exercises both outcomes.
- Display-only assignments must backfill position configuration without a member link; Tasks 2 and 3 verify every existing `(term_id, role_id)` pair.
- Content Admin must not gain committee, membership, or legacy bulk access, while Admin retains all three; Task 3 exercises the router with both roles.
- The new table must not inherit `anon` access, and authenticated writes must remain behind RLS; Tasks 2 and 3 assert grants and policies.
- File/paste metadata without a digest and committee drafts without a target term must fail; Task 1 pins both conditions.

---

## File Structure

### New files

- `src/lib/committee/onboarding/contracts.ts` — runtime contract for operation type, source provenance, mapping, and target term.
- `src/lib/committee/onboarding/contracts.test.ts` — focused metadata validation tests.
- `src/lib/committee/onboarding/foundation-migration.test.ts` — static migration safety and authorization assertions.
- `src/lib/committee/onboarding/generated-db-types.test.ts` — generated-type sentinel for downstream repositories.
- `supabase/migrations/20260927014347_committee_onboarding_foundation.sql` — additive schema, constraints, RLS, grants, and permission router.

### Modified files

- `supabase/verification/assert-bootstrap-replay.sql` — executable schema, uniqueness, backfill, grant, and RBAC assertions.
- `src/lib/db/types.ts` — regenerated through the supported local replay command.

### Explicitly unchanged in Phase 1

- `src/lib/committee/public.ts`
- `src/app/admin/committee/actions.ts`
- `src/components/admin/committee-workspace-client.tsx`
- `src/app/admin/bulk-operations/actions.ts`
- `supabase/schema.sql`, because it is a linked-production snapshot refreshed only after a reviewed production migration.

## Task 1: Lock the onboarding metadata contract

**Files:**

- Create: `src/lib/committee/onboarding/contracts.test.ts`
- Create: `src/lib/committee/onboarding/contracts.ts`

**Interfaces:**

- Consumes: Zod already pinned in `package.json`.
- Produces: operation/source constants and types, `CommitteeDraftMetadata`, `committeeDraftMetadataSchema`, and `parseCommitteeDraftMetadata(value)`.

- [ ] **Step 1: Write the failing contract tests**

Create `src/lib/committee/onboarding/contracts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { committeeDraftMetadataSchema, parseCommitteeDraftMetadata } from "./contracts";

const digest = "a".repeat(64);

describe("committee onboarding draft metadata", () => {
  it("accepts an XLSX committee draft with Bengali mappings", () => {
    const metadata = parseCommitteeDraftMetadata({
      columnMapping: { "ইমেইল": "email", "নাম": "fullName" },
      operationType: "committee_roster_import",
      originalFilename: "committee-6.xlsx",
      schemaVersion: 1,
      sheetName: "Committee 6",
      sourceKind: "xlsx",
      sourceSha256: digest,
      targetTermId: "a53b45fc-c338-42a5-adec-db5350f580a3",
    });
    expect(metadata.sourceKind).toBe("xlsx");
    expect(metadata.columnMapping["নাম"]).toBe("fullName");
  });

  it("rejects a file or pasted source without a SHA-256 digest", () => {
    for (const sourceKind of ["csv", "xlsx", "pasted_tsv"] as const) {
      expect(committeeDraftMetadataSchema.safeParse({
        columnMapping: {}, operationType: "member_profile_import",
        schemaVersion: 1, sourceKind, targetTermId: null,
      }).success).toBe(false);
    }
  });

  it("requires a target term only for committee roster imports", () => {
    expect(committeeDraftMetadataSchema.safeParse({
      columnMapping: {}, operationType: "committee_roster_import",
      schemaVersion: 1, sourceKind: "manual", targetTermId: null,
    }).success).toBe(false);
    expect(committeeDraftMetadataSchema.safeParse({
      columnMapping: {}, operationType: "member_profile_import",
      schemaVersion: 1, sourceKind: "manual",
      targetTermId: "a53b45fc-c338-42a5-adec-db5350f580a3",
    }).success).toBe(false);
  });

  it("rejects unsupported operation and source kinds", () => {
    expect(committeeDraftMetadataSchema.safeParse({
      columnMapping: {}, operationType: "content_publish", schemaVersion: 1,
      sourceKind: "google_sheet_sync", targetTermId: null,
    }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Verify RED**

Run `npx vitest run --project node src/lib/committee/onboarding/contracts.test.ts`.

Expected: FAIL because `./contracts` does not exist.

- [ ] **Step 3: Implement the runtime contract**

Create `src/lib/committee/onboarding/contracts.ts`:

```ts
import { z } from "zod";

export const COMMITTEE_ONBOARDING_OPERATION_TYPES = [
  "committee_roster_import", "member_profile_import",
] as const;
export const COMMITTEE_INTAKE_SOURCE_KINDS = [
  "manual", "csv", "xlsx", "pasted_tsv",
] as const;
export type CommitteeOnboardingOperationType =
  (typeof COMMITTEE_ONBOARDING_OPERATION_TYPES)[number];
export type CommitteeIntakeSourceKind =
  (typeof COMMITTEE_INTAKE_SOURCE_KINDS)[number];

const sourceDigestSchema = z.string().regex(
  /^[a-f0-9]{64}$/,
  "Source digest must be a lowercase SHA-256 value."
);

export const committeeDraftMetadataSchema = z.object({
  columnMapping: z.record(z.string(), z.string()),
  operationType: z.enum(COMMITTEE_ONBOARDING_OPERATION_TYPES),
  originalFilename: z.string().trim().min(1).max(180).optional(),
  schemaVersion: z.literal(1),
  sheetName: z.string().trim().min(1).max(120).optional(),
  sourceKind: z.enum(COMMITTEE_INTAKE_SOURCE_KINDS),
  sourceSha256: sourceDigestSchema.optional(),
  targetTermId: z.string().uuid().nullable(),
}).superRefine((value, context) => {
  if (value.sourceKind !== "manual" && !value.sourceSha256) {
    context.addIssue({ code: "custom", message: "File and pasted sources require a SHA-256 digest.", path: ["sourceSha256"] });
  }
  if (value.operationType === "committee_roster_import" && !value.targetTermId) {
    context.addIssue({ code: "custom", message: "Committee roster drafts require a target term.", path: ["targetTermId"] });
  }
  if (value.operationType === "member_profile_import" && value.targetTermId) {
    context.addIssue({ code: "custom", message: "Member profile drafts cannot target a committee term.", path: ["targetTermId"] });
  }
});

export type CommitteeDraftMetadata = z.infer<typeof committeeDraftMetadataSchema>;
export function parseCommitteeDraftMetadata(value: unknown): CommitteeDraftMetadata {
  return committeeDraftMetadataSchema.parse(value);
}
```

- [ ] **Step 4: Verify GREEN**

Run `npx vitest run --project node src/lib/committee/onboarding/contracts.test.ts` and `npm run typecheck`.

Expected: 4 tests PASS and 0 type errors.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/committee/onboarding/contracts.ts src/lib/committee/onboarding/contracts.test.ts
git commit -m "feat(committee): define onboarding draft contracts"
```

## Task 2: Add the additive database foundation

**Files:**

- Create: `src/lib/committee/onboarding/foundation-migration.test.ts`
- Create: `supabase/migrations/20260927014347_committee_onboarding_foundation.sql`

**Interfaces:**

- Consumes: committee terms, roles, assignments, bulk staging tables, `has_permission(text)`, and `set_current_timestamp_updated_at()`.
- Produces: `committee_term_positions`, two new operation types, draft provenance/revisions, row exclusion state, uniqueness indexes, and `can_manage_bulk_operation_type(text)`.

- [ ] **Step 1: Write the failing migration contract test**

Create `src/lib/committee/onboarding/foundation-migration.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(
  process.cwd(),
  "supabase/migrations/20260927014347_committee_onboarding_foundation.sql"
), "utf8");

describe("committee onboarding foundation migration", () => {
  it("adds and backfills a per-term position overlay", () => {
    expect(migration).toContain("create table public.committee_term_positions");
    expect(migration).toContain("unique (term_id, role_id)");
    expect(migration).toContain("from public.committee_assignments as assignments");
    expect(migration).toContain("committee_term_positions_slot_range_check");
  });

  it("adds non-destructive uniqueness guards", () => {
    expect(migration).toContain("committee_terms_one_public_executive_number_idx");
    expect(migration).toContain("committee_assignments_linked_appointment_unique_idx");
    expect(migration).not.toMatch(/delete\s+from\s+public\.(committee_terms|committee_assignments|members)/i);
    expect(migration).not.toMatch(/update\s+public\.(committee_terms|committee_assignments|members)/i);
  });

  it("adds provenance, revisions, targeting, and exclusions", () => {
    for (const fragment of [
      "'committee_roster_import'", "'member_profile_import'",
      "source_kind text", "source_sha256 text", "target_term_id uuid",
      "draft_revision integer", "validated_revision integer",
      "is_excluded boolean", "excluded_by_user_id uuid",
    ]) expect(migration).toContain(fragment);
  });

  it("routes access through existing scoped permissions", () => {
    expect(migration).toContain("public.can_manage_bulk_operation_type(text)");
    expect(migration).toContain("admin.committee.manage");
    expect(migration).toContain("admin.membership.manage");
    expect(migration).toContain("admin.bulk.manage");
    expect(migration).toContain("bulk operation rows scoped manage");
  });

  it("enables RLS and explicitly withholds the new table from anon", () => {
    expect(migration).toContain("alter table public.committee_term_positions enable row level security");
    expect(migration).toContain("revoke all privileges on table public.committee_term_positions");
    expect(migration).toContain("grant select, insert, update, delete on table public.committee_term_positions");
    expect(migration).not.toContain("grant select on table public.committee_term_positions to anon");
  });
});
```

- [ ] **Step 2: Verify RED**

Run `npx vitest run --project node src/lib/committee/onboarding/foundation-migration.test.ts`.

Expected: FAIL with `ENOENT` for the new migration.

- [ ] **Step 3: Create the migration through the CLI and verify its target path**

```powershell
supabase --version
supabase migration new --help
supabase migration new committee_onboarding_foundation
$generated = @(Get-ChildItem -LiteralPath 'supabase/migrations' -Filter '*_committee_onboarding_foundation.sql')
if ($generated.Count -ne 1) { throw "Expected exactly one generated migration." }
$root = [IO.Path]::GetFullPath((Join-Path (Get-Location) 'supabase/migrations')) + [IO.Path]::DirectorySeparatorChar
$destination = [IO.Path]::GetFullPath((Join-Path (Get-Location) 'supabase/migrations/20260927014347_committee_onboarding_foundation.sql'))
if (-not $destination.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { throw "Migration destination escaped the repository." }
Move-Item -LiteralPath $generated[0].FullName -Destination $destination
```

Expected: CLI 2.109.1; one generated file; final path matches the Files block.

- [ ] **Step 4: Implement the additive migration**

Write `supabase/migrations/20260927014347_committee_onboarding_foundation.sql`:

```sql
begin;

do $preflight$
begin
  if exists (
    select 1 from public.committee_terms
    where term_kind = 'executive' and is_public and term_number is not null
    group by term_number having count(*) > 1
  ) then
    raise exception 'At most one public executive term is allowed per term number.';
  end if;

  if exists (
    select 1 from public.committee_assignments where member_id is not null
    group by term_id, role_id, member_id having count(*) > 1
  ) then
    raise exception 'Duplicate linked committee appointments must be resolved.';
  end if;
end
$preflight$;

create table public.committee_term_positions (
  id uuid primary key default extensions.gen_random_uuid(),
  term_id uuid not null references public.committee_terms(id) on delete cascade,
  role_id uuid not null references public.committee_roles(id) on delete restrict,
  public_label text not null,
  public_label_bn text,
  role_group text not null default 'executive',
  priority integer not null default 100,
  is_public boolean not null default true,
  min_slots integer not null default 0,
  max_slots integer not null default 1,
  target_slots integer not null default 1,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint committee_term_positions_term_role_unique unique (term_id, role_id),
  constraint committee_term_positions_public_label_check check (btrim(public_label) <> ''),
  constraint committee_term_positions_role_group_check check (
    role_group = any (array['executive', 'advisor', 'sub_executive'])
  ),
  constraint committee_term_positions_priority_check check (priority between 0 and 9999),
  constraint committee_term_positions_slot_range_check check (
    min_slots between 0 and 60
    and max_slots between min_slots and 60
    and target_slots between min_slots and max_slots
  )
);

create index committee_term_positions_public_order_idx
  on public.committee_term_positions (term_id, is_public, priority, role_id);
create index committee_term_positions_role_idx
  on public.committee_term_positions (role_id);
create index committee_term_positions_created_by_idx
  on public.committee_term_positions (created_by_user_id)
  where created_by_user_id is not null;
create index committee_term_positions_updated_by_idx
  on public.committee_term_positions (updated_by_user_id)
  where updated_by_user_id is not null;

create trigger committee_term_positions_set_updated_at
before update on public.committee_term_positions
for each row execute function public.set_current_timestamp_updated_at();

insert into public.committee_term_positions (
  term_id, role_id, public_label, public_label_bn, role_group, priority,
  is_public, min_slots, max_slots, target_slots
)
select distinct
  assignments.term_id, assignments.role_id, roles.title, roles.title_bn,
  roles.role_group, roles.sort_order, roles.is_public,
  roles.min_slots, roles.max_slots, roles.default_slots
from public.committee_assignments as assignments
join public.committee_roles as roles on roles.id = assignments.role_id
on conflict (term_id, role_id) do nothing;

create unique index committee_terms_one_public_executive_number_idx
  on public.committee_terms (term_number)
  where term_kind = 'executive' and is_public and term_number is not null;

create unique index committee_assignments_linked_appointment_unique_idx
  on public.committee_assignments (term_id, role_id, member_id)
  where member_id is not null;

alter table public.bulk_operations
  add column if not exists source_kind text,
  add column if not exists source_sha256 text,
  add column if not exists target_term_id uuid references public.committee_terms(id) on delete restrict,
  add column if not exists draft_revision integer not null default 1,
  add column if not exists validated_revision integer,
  add column if not exists validated_at timestamptz;

alter table public.bulk_operations
  drop constraint if exists bulk_operations_operation_type_check,
  add constraint bulk_operations_operation_type_check check (
    operation_type = any (array[
      'legacy_member_import', 'member_invite', 'alumni_invite',
      'lifecycle_update', 'role_update', 'alumni_conversion',
      'account_deletion_review', 'committee_roster_import',
      'member_profile_import'
    ])
  ),
  add constraint bulk_operations_source_kind_check check (
    source_kind is null
    or source_kind = any (array['manual', 'csv', 'xlsx', 'pasted_tsv'])
  ),
  add constraint bulk_operations_source_sha256_check check (
    source_sha256 is null or source_sha256 ~ '^[a-f0-9]{64}$'
  ),
  add constraint bulk_operations_new_import_source_check check (
    operation_type <> all (array['committee_roster_import', 'member_profile_import'])
    or source_kind is not null
  ),
  add constraint bulk_operations_digest_required_check check (
    source_kind is null or source_kind = 'manual' or source_sha256 is not null
  ),
  add constraint bulk_operations_target_term_check check (
    (operation_type = 'committee_roster_import' and target_term_id is not null)
    or (operation_type <> 'committee_roster_import' and target_term_id is null)
  ),
  add constraint bulk_operations_revision_check check (
    draft_revision > 0
    and (validated_revision is null
      or (validated_revision > 0 and validated_revision <= draft_revision))
  );

create index bulk_operations_type_status_created_idx
  on public.bulk_operations (operation_type, status, created_at desc);
create index bulk_operations_target_term_status_idx
  on public.bulk_operations (target_term_id, status, created_at desc)
  where target_term_id is not null;

alter table public.bulk_operation_rows
  add column if not exists is_excluded boolean not null default false,
  add column if not exists excluded_at timestamptz,
  add column if not exists excluded_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists exclusion_reason text;

alter table public.bulk_operation_rows
  add constraint bulk_operation_rows_exclusion_state_check check (
    (not is_excluded and excluded_at is null
      and excluded_by_user_id is null and exclusion_reason is null)
    or (is_excluded and excluded_at is not null
      and excluded_by_user_id is not null
      and btrim(coalesce(exclusion_reason, '')) <> '')
  );

create index bulk_operation_rows_excluded_by_idx
  on public.bulk_operation_rows (excluded_by_user_id)
  where excluded_by_user_id is not null;

create or replace function public.can_manage_bulk_operation_type(
  target_operation_type text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when target_operation_type = 'committee_roster_import'
      then (select public.has_permission('admin.committee.manage'))
    when target_operation_type = 'member_profile_import'
      then (select public.has_permission('admin.membership.manage'))
    else (select public.has_permission('admin.bulk.manage'))
  end;
$$;

revoke all on function public.can_manage_bulk_operation_type(text)
  from public, anon, authenticated;
grant execute on function public.can_manage_bulk_operation_type(text)
  to authenticated, service_role;

alter table public.committee_term_positions enable row level security;

create policy "committee term positions scoped manage"
on public.committee_term_positions for all to authenticated
using ((select public.has_permission('admin.committee.manage')))
with check ((select public.has_permission('admin.committee.manage')));

drop policy if exists "bulk operations membership admins"
  on public.bulk_operations;
create policy "bulk operations scoped manage"
on public.bulk_operations for all to authenticated
using ((select public.can_manage_bulk_operation_type(operation_type)))
with check ((select public.can_manage_bulk_operation_type(operation_type)));

drop policy if exists "bulk operation rows membership admins"
  on public.bulk_operation_rows;
create policy "bulk operation rows scoped manage"
on public.bulk_operation_rows for all to authenticated
using (exists (
  select 1 from public.bulk_operations as operation
  where operation.id = bulk_operation_rows.operation_id
    and public.can_manage_bulk_operation_type(operation.operation_type)
))
with check (exists (
  select 1 from public.bulk_operations as operation
  where operation.id = bulk_operation_rows.operation_id
    and public.can_manage_bulk_operation_type(operation.operation_type)
));

revoke all privileges on table public.committee_term_positions
  from public, anon, authenticated;
grant select, insert, update, delete on table public.committee_term_positions
  to authenticated;
grant all privileges on table public.committee_term_positions to service_role;

notify pgrst, 'reload schema';
commit;
```

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
npx vitest run --project node src/lib/committee/onboarding/foundation-migration.test.ts
npm run migration:check-order:strict
```

Expected: 5 tests PASS and the migration dependency checker reports no findings.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/committee/onboarding/foundation-migration.test.ts supabase/migrations/20260927014347_committee_onboarding_foundation.sql
git commit -m "feat(db): add committee onboarding foundation"
```

## Task 3: Prove the migration against disposable PostgreSQL

**Files:**

- Modify: `src/lib/committee/onboarding/foundation-migration.test.ts`
- Modify: `supabase/verification/assert-bootstrap-replay.sql`

**Interfaces:**

- Consumes: the Phase 1 migration and the replay harness’s synthetic auth user.
- Produces: an `ENFORCED 7` gate for schema shape, backfill, uniqueness, grants, and role routing.

- [ ] **Step 1: Add a failing static sentinel for the runtime gate**

Append inside the existing `describe` block:

```ts
it("registers executable bootstrap assertions", () => {
  const replay = readFileSync(resolve(
    process.cwd(), "supabase/verification/assert-bootstrap-replay.sql"
  ), "utf8");
  expect(replay).toContain("ENFORCED 7 committee onboarding foundation");
  expect(replay).toContain("content_admin cannot manage onboarding operations");
  expect(replay).toContain("hidden legacy duplicate term number remains allowed");
});
```

- [ ] **Step 2: Verify RED**

Run `npx vitest run --project node src/lib/committee/onboarding/foundation-migration.test.ts`.

Expected: FAIL because the replay file has no `ENFORCED 7` block.

- [ ] **Step 3: Add executable Phase 1 assertions**

Insert immediately before the installed-extensions evidence section in `supabase/verification/assert-bootstrap-replay.sql`:

```sql
-- ---------------------------------------------------------------------------
-- ENFORCED 7: committee onboarding foundation.
-- ---------------------------------------------------------------------------
do $committee_onboarding_shape$
declare
  permission_function text;
begin
  if to_regclass('public.committee_term_positions') is null then
    raise exception 'ENFORCED 7 failed: committee_term_positions is absent.';
  end if;

  if not (select relrowsecurity from pg_class
          where oid = 'public.committee_term_positions'::regclass) then
    raise exception 'ENFORCED 7 failed: committee_term_positions RLS is disabled.';
  end if;

  if exists (
    select 1 from public.committee_assignments as assignment
    where not exists (
      select 1 from public.committee_term_positions as position
      where position.term_id = assignment.term_id
        and position.role_id = assignment.role_id
    )
  ) then
    raise exception 'ENFORCED 7 failed: assignment lacks position backfill.';
  end if;

  if not exists (
    select 1 from pg_indexes where schemaname = 'public'
      and indexname = 'committee_terms_one_public_executive_number_idx'
      and indexdef ilike 'create unique index%term_number%where%is_public%'
  ) then
    raise exception 'ENFORCED 7 failed: public term-number uniqueness is absent.';
  end if;

  if not exists (
    select 1 from pg_indexes where schemaname = 'public'
      and indexname = 'committee_assignments_linked_appointment_unique_idx'
      and indexdef ilike 'create unique index%term_id%role_id%member_id%'
  ) then
    raise exception 'ENFORCED 7 failed: appointment uniqueness is absent.';
  end if;

  if has_table_privilege('anon', 'public.committee_term_positions', 'SELECT')
     or has_table_privilege('anon', 'public.committee_term_positions', 'INSERT')
     or has_table_privilege('anon', 'public.committee_term_positions', 'UPDATE')
     or has_table_privilege('anon', 'public.committee_term_positions', 'DELETE') then
    raise exception 'ENFORCED 7 failed: anon can access term positions.';
  end if;

  if not has_table_privilege('authenticated', 'public.committee_term_positions', 'SELECT')
     or not has_table_privilege('authenticated', 'public.committee_term_positions', 'INSERT')
     or not has_table_privilege('authenticated', 'public.committee_term_positions', 'UPDATE')
     or not has_table_privilege('authenticated', 'public.committee_term_positions', 'DELETE') then
    raise exception 'ENFORCED 7 failed: authenticated grants are incomplete.';
  end if;

  if has_function_privilege(
    'anon', 'public.can_manage_bulk_operation_type(text)', 'EXECUTE'
  ) then
    raise exception 'ENFORCED 7 failed: anon can execute permission routing.';
  end if;

  select pg_get_functiondef(
    'public.can_manage_bulk_operation_type(text)'::regprocedure
  ) into permission_function;

  if permission_function not ilike '%security invoker%'
     or permission_function not ilike '%admin.committee.manage%'
     or permission_function not ilike '%admin.membership.manage%'
     or permission_function not ilike '%admin.bulk.manage%' then
    raise exception 'ENFORCED 7 failed: permission routing is incomplete.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bulk_operations'
      and policyname = 'bulk operations scoped manage'
      and coalesce(qual, '') ilike '%can_manage_bulk_operation_type%'
      and coalesce(with_check, '') ilike '%can_manage_bulk_operation_type%'
  ) then
    raise exception 'ENFORCED 7 failed: parent staging policy is not scoped.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bulk_operation_rows'
      and policyname = 'bulk operation rows scoped manage'
      and coalesce(qual, '') ilike '%can_manage_bulk_operation_type%'
      and coalesce(with_check, '') ilike '%can_manage_bulk_operation_type%'
  ) then
    raise exception 'ENFORCED 7 failed: row staging policy is not scoped.';
  end if;

  raise notice 'ENFORCED 7 committee onboarding foundation shape passed.';
end
$committee_onboarding_shape$;

do $committee_onboarding_term_uniqueness$
declare
  public_term_id constant uuid := '00000000-0000-4000-8000-000000009901';
  hidden_term_id constant uuid := '00000000-0000-4000-8000-000000009902';
begin
  insert into public.committee_terms (
    id, slug, title, starts_on, status, is_public,
    term_number, term_kind, is_current
  ) values (
    public_term_id, 'replay-public-committee-999',
    'Replay Public Committee 999', date '2099-01-01', 'archived',
    true, 999, 'executive', false
  );

  insert into public.committee_terms (
    id, slug, title, starts_on, status, is_public,
    term_number, term_kind, is_current
  ) values (
    hidden_term_id, 'replay-hidden-committee-999',
    'Replay Hidden Committee 999', date '2098-01-01', 'archived',
    false, 999, 'executive', false
  );

  raise notice 'ENFORCED 7 hidden legacy duplicate term number remains allowed.';

  begin
    insert into public.committee_terms (
      slug, title, starts_on, status, is_public,
      term_number, term_kind, is_current
    ) values (
      'replay-second-public-committee-999',
      'Replay Second Public Committee 999', date '2097-01-01', 'archived',
      true, 999, 'executive', false
    );
    raise exception 'ENFORCED 7 failed: duplicate public term was accepted.';
  exception when unique_violation then
    raise notice 'ENFORCED 7 duplicate public term number rejected.';
  end;

  delete from public.committee_terms
  where id in (public_term_id, hidden_term_id);
end
$committee_onboarding_term_uniqueness$;

do $committee_onboarding_permissions$
declare
  actor_id uuid;
  admin_role_id uuid;
  content_admin_role_id uuid;
begin
  select id into actor_id from auth.users order by created_at limit 1;
  select id into admin_role_id from public.rbac_platform_roles
    where code = 'admin' and scope = 'admin';
  select id into content_admin_role_id from public.rbac_platform_roles
    where code = 'content_admin' and scope = 'admin';

  if actor_id is null or admin_role_id is null or content_admin_role_id is null then
    raise exception 'ENFORCED 7 failed: permission fixtures are unavailable.';
  end if;

  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  insert into public.rbac_user_platform_roles (user_id, role_id, scope, note)
  values (
    actor_id, content_admin_role_id, 'admin',
    'committee onboarding replay content-admin fixture'
  );

  if public.can_manage_bulk_operation_type('committee_roster_import')
     or public.can_manage_bulk_operation_type('member_profile_import')
     or public.can_manage_bulk_operation_type('legacy_member_import') then
    raise exception 'ENFORCED 7 failed: content_admin can manage onboarding operations.';
  end if;
  raise notice 'ENFORCED 7 content_admin cannot manage onboarding operations.';

  delete from public.rbac_user_platform_roles
  where user_id = actor_id
    and note = 'committee onboarding replay content-admin fixture';

  insert into public.rbac_user_platform_roles (user_id, role_id, scope, note)
  values (
    actor_id, admin_role_id, 'admin',
    'committee onboarding replay admin fixture'
  );

  if not public.can_manage_bulk_operation_type('committee_roster_import')
     or not public.can_manage_bulk_operation_type('member_profile_import')
     or not public.can_manage_bulk_operation_type('legacy_member_import') then
    raise exception 'ENFORCED 7 failed: admin operation routing is incomplete.';
  end if;

  delete from public.rbac_user_platform_roles
  where user_id = actor_id
    and note = 'committee onboarding replay admin fixture';
  raise notice 'ENFORCED 7 committee onboarding permission routing passed.';
end
$committee_onboarding_permissions$;
```

- [ ] **Step 4: Run static tests and the disposable replay**

```powershell
npx vitest run --project node src/lib/committee/onboarding/foundation-migration.test.ts
npm run db:replay-bootstrap
```

Expected: 6 focused tests PASS; replay prints the final `ENFORCED 7` permission notice and `BOOTSTRAP REPLAY ASSERTIONS COMPLETE`; its scratch stack is removed.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/committee/onboarding/foundation-migration.test.ts supabase/verification/assert-bootstrap-replay.sql
git commit -m "test(db): verify committee onboarding foundation"
```

## Task 4: Regenerate and pin the database type surface

**Files:**

- Create: `src/lib/committee/onboarding/generated-db-types.test.ts`
- Modify: `src/lib/db/types.ts`

**Interfaces:**

- Consumes: replayed `committee_term_positions` and extended bulk tables.
- Produces: generated table support and typed sentinels for Phase 2.

- [ ] **Step 1: Write the failing generated-type sentinel**

Create `src/lib/committee/onboarding/generated-db-types.test.ts`:

```ts
import { describe, expectTypeOf, it } from "vitest";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/db/types";

describe("generated committee onboarding database types", () => {
  it("exposes per-term positions", () => {
    expectTypeOf<Tables<"committee_term_positions">["public_label"]>()
      .toEqualTypeOf<string>();
    expectTypeOf<Tables<"committee_term_positions">["target_slots"]>()
      .toEqualTypeOf<number>();
    expectTypeOf<TablesInsert<"committee_term_positions">["term_id"]>()
      .toEqualTypeOf<string>();
    expectTypeOf<TablesUpdate<"committee_term_positions">["priority"]>()
      .toEqualTypeOf<number | undefined>();
  });

  it("exposes draft provenance and exclusion state", () => {
    expectTypeOf<Tables<"bulk_operations">["source_kind"]>()
      .toEqualTypeOf<string | null>();
    expectTypeOf<Tables<"bulk_operations">["draft_revision"]>()
      .toEqualTypeOf<number>();
    expectTypeOf<Tables<"bulk_operations">["target_term_id"]>()
      .toEqualTypeOf<string | null>();
    expectTypeOf<Tables<"bulk_operation_rows">["is_excluded"]>()
      .toEqualTypeOf<boolean>();
  });
});
```

- [ ] **Step 2: Verify RED**

Run `npx vitest run --project node src/lib/committee/onboarding/generated-db-types.test.ts`.

Expected: FAIL because the generated types do not yet know the new table and columns.

- [ ] **Step 3: Generate types through the supported disposable replay**

Run `npm run db:types:generate`.

Expected: replay succeeds and deterministically replaces `src/lib/db/types.ts`; no remote target is accepted or used.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
npx vitest run --project node src/lib/committee/onboarding/generated-db-types.test.ts
npm run typecheck
```

Expected: 2 tests PASS and 0 type errors.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/db/types.ts src/lib/committee/onboarding/generated-db-types.test.ts
git commit -m "chore(db): regenerate committee onboarding types"
```

## Task 5: Run the Phase 1 release gate and record a clean handoff

**Files:**

- Verify only; no additional product file is expected.

**Interfaces:**

- Consumes: all Phase 1 commits.
- Produces: a clean branch ready for the separate Phase 2 intake/drafts plan.

- [ ] **Step 1: Verify migration ordering and deterministic replay**

```powershell
npm run migration:check-order:strict
npm run db:replay-bootstrap
npm run db:types:generate
git diff --exit-code -- src/lib/db/types.ts
```

Expected: no dependency findings; replay passes; a second generation produces no type diff.

- [ ] **Step 2: Run focused and full repository gates**

```powershell
npx vitest run --project node src/lib/committee/onboarding
npm run typecheck
npm run lint
npm run audit:admin-access
npm test
```

Expected: onboarding tests pass, TypeScript and ESLint report 0 errors, the access audit reports no drift, and the full suite passes at or above the 1,178-test clean baseline.

- [ ] **Step 3: Inspect scope and secret safety**

```powershell
git status --short
git diff --check main...HEAD
git diff --stat main...HEAD
git diff --name-only main...HEAD
```

Expected: only planned files and the two planning documents changed; no credentials, production data, public-page code, admin UI code, or historical migration rewrites appear.

- [ ] **Step 4: Confirm production remains untouched**

Using the Supabase plugin, perform read-only checks that project `fsirdkjgrcocowxqjhjg` is `ACTIVE_HEALTHY`, the newest production migration remains `20260825010200_member_directory_facets`, and `committee_term_positions` is absent.

Expected: production remains unchanged during Phase 1 branch implementation.

- [ ] **Step 5: Close any verification correction with its regression test**

If a gate fails, repeat its RED/GREEN cycle, stage only the correction and test, rerun all gates, then commit:

```powershell
git commit -m "fix(committee): close phase one verification gap"
```

If the tree is clean, do not create an empty commit.

## Phase Boundary

This plan stops before parser implementation, XLSX dependency installation, identity matching, draft actions, transactional publication, public committee queries, claim changes, or UI work. Those receive separate implementation plans:

1. Phase 2A — bounded CSV/XLSX/pasted parsing and normalized validation.
2. Phase 2B — persisted draft editing, matching, preview, and atomic committee/member commit functions.
3. Phase 3 — server-only public projection, ordering, safe executive fallback, and revalidation.
4. Phase 4 — invitations, identity-review enforcement, and immediate freeze checks.
5. Phase 5 — integrated browser verification, reviewed production migration, GitHub Actions, Vercel deployment, and smoke tests.

No production migration is applied and no user-visible behavior changes when Phase 1 is complete.
