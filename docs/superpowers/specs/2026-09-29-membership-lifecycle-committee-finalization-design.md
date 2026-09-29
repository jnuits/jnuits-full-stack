# Membership Intake, Renewal Lifecycle, and Committee Finalization Design

**Status:** Approved on 2026-09-29. This specification is ready for implementation planning; it does not authorize implementation by itself.

**Supersedes:** The conflicting intake, lifecycle, and committee-publication decisions in `2026-09-23-committee-member-onboarding-design.md`. That earlier specification remains authoritative for requirements not changed here, including identity matching, profile claiming, permissions, public-data minimization, historical URLs, and transactional draft publication.

## Goal

Give JnUITS administrators a low-friction way to maintain members, committee rosters, renewals, alumni transitions, and profile photos without creating duplicate identity systems or requiring people to claim accounts before their approved public committee history can appear.

The resulting system must:

- import members before assigning them to executive committees;
- make committee assignment a search-and-select workflow over canonical member identities;
- derive membership timing from each member's actual JnUITS joining date rather than global cycle windows;
- handle annual renewals, six-month grace periods, former-member access, voluntary departure, and appeals explicitly;
- convert eligible departing executive members to alumni only when an administrator finalizes the successor roster;
- use canonical, optimized Cloudinary photos for members and advisors; and
- preserve valid existing code and data while removing only obsolete or misleading UI.

## Superseded decisions

| Earlier decision | Replacement |
| --- | --- |
| Committee spreadsheets create or update roster members | Membership administration creates/imports members. Committee administration assigns existing members by JnUITS ID, name, or email. |
| Google Sheets are out of scope | Public "Anyone with the link" Google Sheets are accepted as one-time membership-import snapshots. There is no continuous synchronization or Google OAuth. |
| Historical committee service never changes lifecycle | Finalizing a successor EC automatically converts actual prior-EC members who are absent from the successor EC to alumni. |
| Administrators create annual membership-cycle windows | Each member has an authoritative joining date and an individual annual renewal anniversary. No global cycle window is required. |
| Downloadable blank templates are sufficient | Every browser-based admin bulk import supplies a blank template, fictional completed sample, field instructions, and accepted-code references. |

## Product principles

- `members` remains the canonical person and membership identity.
- A committee assignment never creates a second member profile.
- A member's authentication state, membership lifecycle, current-membership eligibility, public visibility, and committee history are separate controls.
- No irreversible lifecycle change occurs from a single accidental click.
- Server actions and database functions enforce the same rules as the UI.
- Existing shared import, invitation, profile, committee, audit, and avatar infrastructure is extended rather than rewritten.
- Missing historical facts are flagged for review; they are never fabricated.
- Public pages expose only approved public projections, never privileged member rows.

## Administrative information architecture

### Membership DB owns member intake

The Membership DB is the only browser workspace for creating and bulk-importing member identities. It supports:

- manual entry;
- CSV upload;
- `.xlsx` upload;
- pasted CSV or tab-separated spreadsheet cells; and
- a public Google Sheet link.

All sources enter the same persisted workflow:

**Capture source -> Parse -> Map fields -> Normalize -> Validate -> Review changes -> Save draft -> Commit profiles**

Saving or validating a draft does not modify canonical members. Only the explicit, permission-checked commit does.

### Committee owns appointments

The Committee workspace does not expose a roster spreadsheet, roster draft, or Google Sheet importer. Administrators:

1. select the committee term;
2. select a configured position and seat;
3. search the server-paginated member catalog by JnUITS ID, name, or email;
4. select the canonical member;
5. configure appointment status, dates, public visibility, and ordering; and
6. save the assignment.

The existing `committee_roster_import` database type and shared parsers may remain temporarily for migration compatibility, but no active Committee UI links to that flow. Shared member-import code must not be deleted merely because the Committee entry point is removed.

Every configured target seat must be either assigned or deliberately marked vacant before finalization. A vacancy requires an administrator-authored reason and is not a synthetic member or assignment.

### Advisors remain separate

Teacher and honorary advisors do not need member records or membership-renewal rows. Their established profile workflow remains separate while adopting the same secure photo-upload quality rules.

## Bulk-import guidance contract

Every browser-based admin bulk-import surface must provide:

- a blank CSV template;
- a blank XLSX template;
- a completed fictional CSV sample;
- a completed fictional XLSX sample;
- concise field definitions, required/optional markers, accepted formats, and limits; and
- downloadable reference data for constrained codes used by that import.

CLI-only seed, repair, and migration scripts are excluded because they are operator tooling rather than admin-facing bulk-import surfaces.

An XLSX sample contains at least these sheets:

1. **Member profiles** - importable fictional rows;
2. **Instructions** - column meanings, required values, limits, and examples; and
3. **Department codes** - current accepted short codes and department names.

CSV downloads remain separate files because CSV cannot contain multiple sheets. Sample data uses clearly fictional JnUITS identities and must never include production member data or credentials.

Templates and samples are generated from the same field catalog and active department catalog used by validation. This prevents documentation drift.

## Membership import fields and normalization

### Required fields

New imported or manually created members require:

- full name;
- JnUITS ID, unless the approved workflow is explicitly allocating one;
- email;
- classification (`current`, `former`, or `alumni`);
- department code;
- two-digit batch number; and
- official JnUITS joining date.

The existing identity matching rules continue to apply: ID and email must resolve consistently, names never merge people, and conflicts block the row.

### Department catalog

The existing slug-valued `departments.code` remains the internal foreign-key identity during this change. Rewriting all foreign keys solely to improve an import label is unnecessary risk.

Add a unique, uppercase, user-facing `departments.short_code`. `CSE` is the canonical short code for Computer Science & Engineering. Existing active departments must receive a non-null, unique short code before the constraint becomes mandatory.

Add a normalized alias mapping for:

- the short code;
- the internal legacy slug;
- the full department name; and
- explicitly approved historical spellings.

Import matching is case-insensitive but stores the internal department key. Ambiguous aliases are forbidden. The downloadable department-code file is generated from active catalog rows and includes short code plus full name; users do not need to know internal slugs.

The official Jagannath University catalog is the naming reference. For example, the university identifies Computer Science & Engineering as CSE and Accounting & Information Systems as AIS. Catalog changes are versioned through reviewed migrations or an audited catalog-management action.

### Batch

Admin forms and imports accept exactly two decimal digits, `10` through `99`. Free-text ordinals such as `12th`, `12 th`, or `Batch 12` are rejected with a correction message rather than silently normalized.

The database stores the numeric value with a check constraint of `10 <= batch_no <= 99`. Presentation derives the English ordinal correctly, including the `11th`, `12th`, and `13th` exceptions, and displays values such as `12th Batch`.

The same validation applies to manual entry, member editing, CSV, XLSX, pasted cells, Google Sheets, and public application intake where batch is collected.

### Joining date and derived intake year

Add an authoritative `members.joined_on date`. This is the official JnUITS membership start date, not the database row creation timestamp.

- New manual and imported members require `joined_on`.
- Approved membership applications default `joined_on` to the Dhaka calendar date of approval unless an administrator records an earlier official date.
- Existing members without a trustworthy date retain `null` and appear in an explicit correction queue.
- No renewal deadline is generated until a trustworthy joining date exists.
- The displayed intake or "membership cycle" is `extract(year from joined_on)`; no cycle row is created.
- When the system allocates a new JnUITS ID, its year block comes from `joined_on`.

## Public Google Sheet intake

A Google Sheet is accepted only when it is publicly readable through an "Anyone with the link" URL. The system:

- accepts only validated `https://docs.google.com/spreadsheets/` document URLs;
- extracts the spreadsheet identifier and selected sheet identifier without accepting an arbitrary fetch URL;
- performs a server-side CSV export fetch with a strict timeout, redirect policy, content-type checks, a 2 MiB response limit, and a 1,000-row data limit;
- stores source type, sanitized document identifier, selected sheet identifier, fetch time, and content digest as draft provenance;
- parses the fetched bytes through the same importer used by file upload; and
- treats every fetch as a one-time snapshot.

No refresh, OAuth token, edit access, background synchronization, or arbitrary remote-image fetch is added. Making the source sheet private after capture does not affect the persisted draft.

## Individual membership and renewal model

### Canonical fields

Add these member-level concepts:

- `joined_on`: official membership start date;
- `renewal_due_on`: the next unfulfilled anniversary date;
- `current_membership_path_status`: `open`, `departure_requested`, `closed_appealable`, or `closed_final`;
- departure closure metadata identifying effective date, actor, and reason when applicable.

`renewal_due_on` is stored for indexed queues and updated only through transactional membership functions. Its initial value is one calendar year after `joined_on`.

For a 29 February joining date, the anniversary is 28 February in non-leap years and 29 February in leap years. All policy dates are evaluated using the `Asia/Dhaka` calendar date, not the browser timezone.

### Renewal ledger

Create an append-oriented `membership_renewals` ledger keyed uniquely by `(member_id, due_on)`. A confirmed row records:

- the anniversary being satisfied;
- confirmation date and resolution (`paid` or `waived`);
- resulting next due date;
- an optional non-sensitive reference and administrator note;
- the confirming administrator; and
- creation timestamps.

Do not store payment card, mobile-wallet secret, or other sensitive financial data. This release records administrative confirmation; it does not pretend to implement an online payment gateway.

One confirmation advances exactly one anniversary. If several annual periods are outstanding, an administrator confirms or waives each period explicitly. A member is reactivated as current only when the resulting `renewal_due_on` is in the future.

Every renewal transaction also appends a concise `membership_lifecycle_events` record. The ledger provides idempotency and renewal history; the existing lifecycle table provides the cross-feature audit timeline.

### Date-based states

For a current member with an open current-membership path:

1. **Current / paid:** Dhaka `current_date < renewal_due_on`.
2. **Current / overdue grace:** `renewal_due_on <= current_date < renewal_due_on + 6 months`.
3. **Former:** at the start of the Dhaka calendar date `renewal_due_on + 6 months`, when the anniversary remains unfulfilled.

The grace state does not silently freeze authentication, directory visibility, or portal access. It adds an overdue warning and renewal action while the lifecycle remains `current`.

The six-month transition updates `lifecycle_status` to `former` while keeping the authentication account and active portal sign-in available. Former is not treated as current through a fallback to `member_type`; the existing fallback that can make a former/current combination mutable must be removed.

### Former-member portal

A former member with active security access can authenticate but receives a dedicated, limited membership screen. It shows:

- the outstanding anniversary and fee guidance;
- a renewal or reactivation request;
- an alumni-conversion request; and
- a voluntary "Leave JnUITS" action.

Normal current-member mutations are unavailable until reactivation. The product must not imply that clicking a button confirms payment. An authorized administrator confirms the applicable renewal ledger entry; a successful catch-up transaction restores `lifecycle_status = current`, `member_type = current`, and the normal portal when the next due date is in the future.

## Voluntary departure and appeal

Voluntary departure is distinct from security suspension, deletion, and alumni conversion.

Use the existing `profile_update_requests` review system with new request types for membership departure and departure appeal. The member-level path status is the enforcement source of truth.

1. A former member chooses **Leave JnUITS** after a strong confirmation and submits a departure request.
2. The path becomes `departure_requested`; renewal/reactivation is temporarily blocked, but no identity or history is deleted.
3. The member may withdraw a still-pending request before administrator resolution.
4. Administrator approval closes the current-membership path as `closed_appealable`. The member keeps a read-only signed-in surface and may submit one appeal.
5. An approved appeal restores the path to `open`; the member remains former until outstanding renewals are confirmed.
6. A rejected appeal sets `closed_final`. Current-membership renewal is permanently unavailable, while alumni eligibility remains available.

The "profile frozen" outcome is a membership-content freeze, not an automatic security freeze. `portal_access_status` remains reserved for active, frozen, suspended, deletion-requested, or deactivated security access. A voluntarily departed member with otherwise active security access can still authenticate to the limited screen and submit an alumni request.

Until alumni approval, authorized and permitted public surfaces label the person as Former Member. Existing public-visibility and privacy settings still determine whether a public profile is shown. Alumni approval replaces the former label with alumni status.

Every request, withdrawal, approval, rejection, appeal, and final closure records actor, reason, prior state, resulting state, and timestamps.

## Alumni transitions

### Ordinary former members

Ordinary former members use the established alumni conversion/onboarding review. Approval atomically sets the alumni lifecycle and role state while preserving the permanent JnUITS identity. Rejection leaves the former state intact.

An approved alumni transition closes the current-membership path with an `alumni_conversion` reason and stops renewal reconciliation for that person. The last due date and renewal ledger remain available for audit; conversion does not erase membership history. This closure is not a voluntary-departure appeal case.

### Executive committee members

Executive members do not submit the ordinary alumni choice when they leave office. Finalizing the successor EC automatically converts eligible prior-EC members who are absent from the successor EC to alumni.

Eligibility is calculated as follows:

- compare the term being finalized with its immediately preceding published executive term;
- include distinct linked member IDs whose preceding assignments represent actual service (`active` or `completed`), whether or not a particular card was public;
- exclude drafts, cancelled/withdrawn assignments, display-only legacy people without a member ID, and advisor profiles;
- subtract members with an actual-service assignment in the successor term; and
- treat already-alumni members as idempotent no-ops.

The effective `alumni_since` date is the successor term's `starts_on`. The transition changes membership lifecycle/type but preserves `portal_access_status`; a frozen or suspended person does not become active merely because they became alumni.

Historical rosters known to be incomplete are not mass-converted speculatively. The implementation includes only explicit, evidence-backed corrections, including JnUITS-2023001 using the start date of the committee immediately following that member's last verified EC service.

## Committee roster finalization

### Readiness and preview

A term cannot be finalized until:

- every visible configured target seat is assigned or deliberately marked vacant;
- assignment counts respect minimum, target, and maximum constraints;
- every public actual-service assignment links to one canonical member;
- no duplicate seat or conflicting member assignment exists;
- term start date and successor relationship are valid; and
- the administrator can review the complete roster and lifecycle impact.

The preview lists:

- assigned and intentionally vacant seats by position;
- validation warnings and blocking errors;
- previous-EC members continuing into the successor term;
- previous-EC members proposed for automatic alumni conversion; and
- preserved security restrictions for impacted people.

Previewing writes nothing.

### Atomic finalization

A permission-checked database function performs finalization in one transaction. It:

1. locks and re-reads the term, position configuration, assignments, and impacted members;
2. verifies the preview revision or digest is still current;
3. reruns readiness and seat validation;
4. records the finalized roster revision and attribution;
5. transitions eligible absent prior-EC members to alumni;
6. appends lifecycle and operator audit events; and
7. returns stable counts and affected identifiers.

The function is idempotent: retrying an identical finalization returns the existing result without duplicate lifecycle events. Concurrent roster changes make a stale finalization fail safely.

Add finalization metadata to the committee term and vacancy counts/reasons to the per-term position configuration rather than creating fake assignments.

A finalized roster is locked against ordinary edits. A separately permission-checked reopen action requires a reason and creates an audit event. Reopening does not reverse alumni transitions. Any lifecycle correction is an explicit, separate, audited administrator action.

## Photos

### Members

Mount the existing signed Cloudinary avatar uploader in the admin member profile editor. Membership administrators may upload for claimed or unclaimed members under the existing membership permission.

- Use the stable public ID `jnuits/member-avatars/{memberId}/avatar`.
- Preserve the existing type, byte, authorization, signature, transformation, and completion checks.
- Store only the validated 400x400 optimized asset metadata.
- Replace through overwrite plus cache invalidation.
- Revalidate the member profile, public directory projection, and every affected committee page.

Committee assignments do not store a duplicate photo URL. Admin and public committee queries select the linked member's canonical `avatar_secure_url`. Initials remain the accessible fallback.

### Advisors

Extend the signed upload target model with an advisor target protected by `admin.committee.manage`. An advisor must be saved before uploading a photo so a stable ID exists.

- Use `jnuits/advisor-avatars/{advisorId}/avatar`.
- Add the same validated avatar metadata columns and constraints used for members.
- Replace the raw arbitrary URL field in the ordinary admin flow with the signed uploader.
- Revalidate advisor portal and public committee projections after completion.

No import fetches arbitrary remote image URLs. Approved media references may be linked only through existing trusted media contracts.

## Membership-cycle deprecation

Remove the manual "Create membership cycle windows" UI, active-cycle requirement, renewal-open/close controls, and cycle-bound renewal queue from normal administration.

Membership application approval no longer requires `membership_cycle_id`; it uses the approved `joined_on` and personal anniversary model. Invitation batches may still group outreach and monitor delivery, but they do not require a cycle link.

Because production currently contains zero `membership_cycles` and zero `membership_cycle_memberships`, the old tables and nullable foreign keys can remain dormant for one rollback-compatible release. Do not reuse them for new writes. A later dedicated cleanup may remove them only after repository and production dependency checks prove they are unused.

## Automation

Create one idempotent database function that reconciles renewal lifecycle using an explicit Dhaka effective date. It processes bounded batches of open-path current members with known `renewal_due_on`, transitions only newly eligible rows, and records one lifecycle event per effective transition.

Schedule the function daily with Supabase Cron (`pg_cron`) shortly after midnight Asia/Dhaka. Job creation is migration-managed and idempotent. The portal and relevant admin loaders also call a narrowly scoped reconciliation for the current member or queue as a safety fallback, so a delayed cron run cannot expose stale permissions indefinitely.

The cron job and fallback use the same function; business rules are not duplicated in TypeScript.

## Permissions and security

- `admin.membership.manage` controls member imports, member profile/photo administration, renewal confirmation, departure/appeal decisions, and explicit lifecycle correction.
- `admin.committee.manage` controls committee positions, member assignment, vacancies, finalization/reopen, and advisor photos.
- Content Admin receives neither permission implicitly.
- Member-facing departure, appeal, renewal, and alumni requests require the authenticated user to own the target member record.
- Security-definer functions set an empty search path, qualify all relations, derive the actor from `auth.uid()`, verify permission in the transaction, and do not trust caller-supplied actor IDs.
- Direct table grants and RLS do not permit members to confirm renewals, approve requests, finalize rosters, or alter lifecycle/security fields.
- Public and browser DTOs omit email, phone, student ID, fee references, request payloads, administrative notes, and security state.
- Public Google Sheet errors never reflect fetched spreadsheet contents or internal network details.

## UX requirements

- Preserve the current JnUITS theme and established admin/portal shells.
- Use plain-language labels: Joining date, Renewal due, Grace period, Former member, Apply for Alumni, and Leave JnUITS.
- Explain consequences before departure, roster finalization, roster reopening, or lifecycle correction.
- Keep destructive and non-destructive actions visually distinct.
- Do not show a member editable profile forms before access rules permit editing.
- Show row-level import errors beside the affected value and provide a downloadable error report.
- Make department code references available beside manual and bulk intake.
- Display canonical member/advisor photos with stable dimensions and no duplicate initials.
- Verify touched screens at 375, 768, 1024, and 1440 CSS pixels in light and dark themes, with keyboard navigation, visible focus, screen-reader names, and no horizontal overflow.

## Migration and backfill policy

Migrations are additive and evidence-driven:

1. add department short codes/aliases, member date/path fields, renewal ledger, committee finalization metadata, vacancy metadata, advisor avatar metadata, constraints, indexes, RLS, and functions;
2. populate the approved department short-code catalog before enforcing non-null uniqueness;
3. derive `renewal_due_on` only where `joined_on` is trustworthy;
4. leave unknown legacy joining dates null and report them for correction;
5. make evidence-backed lifecycle corrections in guarded, rerunnable data migrations; and
6. leave dormant cycle tables intact for the rollback-compatible release.

No migration hardcodes generated UUIDs, invents historical dates, reactivates security access, or rewrites unrelated member records.

## Verification requirements

### Import and catalog

- Prove blank and fictional sample downloads for every browser-based bulk-import surface.
- Prove XLSX instructions and department-code sheets match live validation rules.
- Accept CSE, its approved full name, and its legacy slug as the same department without ambiguous matching.
- Reject unknown/ambiguous department values and batch values outside the exact two-digit contract.
- Verify file, paste, and Google Sheet sources create equivalent normalized drafts.
- Verify Google Sheet host validation, redirect limits, timeouts, byte/row limits, digest provenance, and private/unavailable-sheet errors.
- Preserve identity conflict detection and idempotent draft commit.

### Renewal and departure

- Test ordinary anniversaries, month/year boundaries, 29 February, Dhaka date boundaries, exact due date, and exact six-month transition date.
- Prove cron and login fallback are idempotent and cannot duplicate events.
- Prove overdue grace members remain current and former members remain authenticated but non-mutable.
- Prove renewal confirmation advances one anniversary, catches up deterministically, and reactivates only when paid through a future due date.
- Prove departure request, withdrawal, closure, single appeal, appeal approval, appeal rejection, final closure, and later alumni eligibility.
- Prove voluntary departure does not masquerade as security suspension and security restrictions remain authoritative.

### Committee and photos

- Prove assignment searches the full member catalog rather than a capped client list.
- Reject missing/duplicate seats, over-capacity roles, stale previews, unauthorized finalization, and concurrent roster changes.
- Prove an absent actual-service prior-EC member becomes alumni once, a continuing member remains current, advisors are excluded, and frozen/suspended access is preserved.
- Prove finalization retry is a no-op and reopening does not reverse lifecycle history.
- Prove member-photo replacement updates all committee appearances without copying URLs into assignments.
- Prove advisor upload authorization, stable replacement, metadata constraints, and projection refresh.

### Repository and release

- Use test-driven implementation for each behavior change.
- Run focused unit, DOM, integration, SQL contract, clean migration replay, rollback-only production-schema, and browser tests.
- Run full lint, typecheck, Node/DOM suites, production build, admin access audit, migration integrity/order/runtime checks, static/secret checks, and credential-material checks.
- Verify Supabase security and performance advisors after DDL.
- Apply reviewed migrations before deploying code that depends on them.
- Merge only after required GitHub checks pass, then verify the production Supabase migration list, production commit, committee pages, member portal states, imports, and photo rendering.

## Live baseline recorded on 2026-09-29

Read-only production inspection found:

- 8 member rows;
- 1 member with a department value;
- 0 members with a batch value;
- 0 membership-cycle rows; and
- 0 membership-cycle-membership rows.

The department catalog currently contains 38 active rows whose internal keys are long slugs, including `computer-science-engineering`. The local importer already uppercases incoming department values but does not yet resolve a complete short-code catalog. Existing member import templates are downloadable but intentionally contain no sample rows, which this specification changes.

These counts are observations, not fixtures. Implementations must query current data and must not assume the counts remain unchanged.

## Delivery boundaries

This specification does not include:

- a new online payment gateway;
- Google OAuth or continuous Sheet synchronization;
- automatic fetching of arbitrary spreadsheet image URLs;
- speculative reconstruction of incomplete historical rosters;
- deletion of dormant cycle tables in the same release;
- redesign of the site theme; or
- expansion of Content Admin privileges.

Implementation starts only after a separate, user-approved execution plan identifies test-first tasks, migration order, affected files, rollout checkpoints, and recovery procedures.

## Authoritative references

- [Jagannath University — Department of Computer Science & Engineering](https://jnu.ac.bd/department/portal/cse)
- [Jagannath University — Department of Accounting & Information Systems](https://jnu.ac.bd/department/portal/accounting_information_system)
- [Supabase Cron documentation](https://supabase.com/docs/guides/cron)
