# Committee & Member Onboarding Design

**Status:** Approved master specification, transferred into the repository on 2026-09-23.

**Source:** The user-approved “Committee & Member Onboarding — Master Plan.” The attached document supplied project context; this repository copy is the implementation authority.

## Goal

Create a straightforward workflow where administrators can import and publish complete executive profiles without requiring those people to register first. Executives are the first release priority. The same onboarding foundation will later support ordinary members and alumni.

## Product decisions

- Preserve the existing theme, header, committee tabs, and historical committee URLs.
- Show executive committees 6 through 1, with the current committee selected by default.
- Allow each committee to configure its own positions, labels, groupings, priority, visibility, and seat limits.
- Accept `.xlsx`, CSV, and tab-separated pasted spreadsheet cells. Google Sheets links, OAuth, and continuous synchronization are outside this release.
- Require full name, a valid JnUITS ID, and email. Never fabricate placeholder identities.
- Save imports as drafts and require a separate publish or commit action.
- Keep public committee history independent of profile claiming, login state, and dashboard access state.
- Let claimed members update permitted ordinary details. Official identity changes require administrator review.
- Extend the existing committee, membership, bulk-operation, invitation, and media systems instead of introducing parallel systems.

## Public committee experience

### Navigation and presentation

- Retain the current tabs and existing committee URLs, including historical aliases.
- Display the current committee first, followed by previous committees in descending committee-number order.
- Order people by that term’s configured position priority and then the administrator-defined assignment order.
- Remove hardcoded role exclusions. A position appears when the selected committee’s approved configuration permits it.
- Display actual published roster totals and configured seat counts. Do not assume every committee has 21 members.
- Preserve advisor sections and their separate management workflow.
- Keep estimated historical dates explicitly labelled as estimated until authoritative dates are supplied.

### Executive profiles

Every published executive shows the approved name, photo or initials fallback, position, department when supplied, and committee information, whether the profile is claimed or unclaimed.

Use one member identity across multiple committee appointments. A person who served on several committees has one profile and one published committee history.

Extend `/members/[jnuitsId]` with a restricted committee-profile fallback:

- A published executive remains accessible when the ordinary member-directory profile is unavailable.
- Only explicitly approved committee-profile fields are returned.
- Ordinary member-directory visibility rules remain unchanged.
- Email, phone, student ID, administrative notes, invitation state, claim state, and dashboard access state remain private.

The public surface uses a dedicated server-only projection. The `members` table must not become publicly readable, and privileged rows must not be serialized to browser code.

### Accessibility and performance

- Reuse established components and visual tokens.
- Make tabs, cards, dialogs, and profile links usable by keyboard, touch, and screen readers.
- Prevent horizontal overflow at mobile widths.
- Use stable image dimensions, appropriate image sizes, and deferred loading for off-screen media.
- Batch roster reads; do not issue one query per person or silently truncate results.
- Revalidate affected committee pages and member profiles after publication, approved identity edits, or photo changes.

## Administrator experience

### Committee workspace

Organize the existing `/admin/committee` workspace as:

**Overview · Roster · Import & Drafts · Positions & Ordering · History**

Rollover and archival operations remain available as advanced actions.

The workspace provides:

- Committee selection, publication state, actual roster totals, configured seat counts, and validation warnings.
- Searchable, paginated member selection instead of a capped member list.
- One “Add person” workflow that creates or selects a member and adds an appointment.
- A reusable profile editor shared with membership administration.
- Separate, clearly labelled controls for public visibility and dashboard access.

### Shared intake pipeline

Every source follows the same stages:

**Upload or paste → Map columns → Validate → Review changes → Save draft → Publish or commit**

- Reuse `csv-parse` for CSV input.
- Use a pinned `read-excel-file` release for server-side `.xlsx` parsing.
- Let administrators choose a workbook sheet and map English or Bengali headers.
- Preserve identifiers as text and parse quoted CSV cells, including multiline cells, correctly.
- Limit each intake to 1,000 data rows and 2 MiB, with clear rejection messages and bounded workbook parsing.
- Provide downloadable templates and row-level validation results.

Required identity fields are full name, JnUITS ID, and email. Executive rows also require committee and position, either in mapped columns or in the selected import context.

Optional fields include department, batch, contact details, approved social links, approved media references, and appointment dates.

Current, former, or alumni classification is always explicit. Historical committee service never automatically converts a member to alumni.

### Matching and conflicts

- Normalize JnUITS ID and email before matching.
- Reuse an existing member only when both identifiers are mutually consistent.
- Block a row when the ID and email resolve to different people.
- Never match or merge people by name.
- Permit one person in several committee rows and several committee terms.
- Treat an identical repeated appointment as a no-op.
- Show proposed changes alongside existing values before approval.
- Blank cells do not erase existing values.
- Deleted or conflicting identities require explicit administrator resolution.
- Omitting a person from an import never removes an existing appointment.
- Invalid rows stay in the draft until corrected or explicitly excluded.

### Drafts and publication

Persist staging in `bulk_operations` and `bulk_operation_rows`. Saving a draft must not modify published names, photos, positions, appointments, or member details.

Extend the data model with:

- Per-committee position configuration: label, Bengali label, grouping, priority, visibility, and minimum, maximum, and target seats.
- Appointment uniqueness that prevents duplicate reruns without preventing one person from serving in multiple terms or positions.
- Draft source provenance, mapping metadata, validation revision, explicit row exclusion, and publication attribution.
- At most one public executive term for each committee number, while preserving hidden legacy term records.

Publish through permission-checked transactional database functions that:

- Lock and re-read the operation and target rows.
- Revalidate normalized identities, position configuration, seat limits, and target record versions immediately before writing.
- Reject a draft when its validated revision is stale or a referenced target changed.
- Apply approved member and assignment changes atomically.
- Make an identical retry return the prior result without creating duplicates.
- Record the authenticated administrator, source operation, and resulting changes.
- Switch the current committee atomically when publication requests it.

Ordinary member and alumni intake uses the same workflow with **Commit profiles**. It does not publish a committee roster or change directory privacy automatically.

### Photos

- Reuse the existing upload and media system.
- Accept individual uploads or references to approved existing media.
- Validate and normalize images through existing avatar rules.
- Never fetch arbitrary spreadsheet URLs.
- Keep draft photo changes out of the published profile until publication succeeds.
- Missing photos never block otherwise valid onboarding.

## Claiming, ownership, and access control

### Claiming imported profiles

Importing creates member records, not passwords, authentication accounts, sessions, or administrative privileges.

- Administrators explicitly choose when to issue invitations.
- Use the existing Resend-backed invitation flow when delivery is available.
- Preserve the existing authorized manual link or code fallback when email delivery is unavailable.
- Show delivery failures and permit controlled retries.
- Preserve recipient binding, expiry, single use, CAPTCHA, rate limiting, and password validation.
- Claim the existing member record instead of creating a duplicate.
- Never reset an existing authentication account solely because its email matches an import.
- A committee appointment never grants Admin or Content Admin permissions.

### Profile ownership

After claiming:

- Members may update permitted ordinary details such as phone, approved social links, and photo through existing controls.
- Name, JnUITS ID, email, department, and other official identity corrections require administrator review.
- Committee positions, ordering, visibility, and appointment history remain administrator-controlled.
- Identity fields must be removed from the direct-edit API and its interface; a UI-only restriction is insufficient.
- Administrators may edit claimed and unclaimed profiles, with audited changes.

### Dashboard access and publication

- Dashboard access and public publication are independent controls.
- Freezing immediately prevents protected dashboard and API use, including from an existing session.
- Claiming a profile never reactivates a frozen account.
- Reactivating dashboard access never changes committee history or public visibility.
- Removing a public appointment never deletes the underlying member or authentication account.
- Every action and relevant database boundary enforces the existing committee or membership permission.
- Content Admin access is not expanded implicitly.

## Data architecture

### Existing tables retained

- `committee_terms` remains the committee-term authority.
- `committee_roles` remains the global canonical role dictionary and alias registry.
- `committee_assignments` remains the appointment authority.
- `members` remains the identity authority.
- `bulk_operations` and `bulk_operation_rows` remain the persisted draft and review mechanism.
- `member_invitations` and the existing claim functions remain the authentication onboarding mechanism.

### Per-term position overlay

Add `committee_term_positions` keyed by `(term_id, role_id)`. It overrides the global role’s public label, Bengali label, group, priority, visibility, and seat limits for one committee without duplicating the global role dictionary or rewriting existing appointments.

Existing assignments retain their `term_id` and `role_id`. The foundation migration backfills an overlay only for existing term-role pairs, using current role metadata. It does not invent missing historical positions or roster members.

### Bulk-operation routing

Add two operation types:

- `committee_roster_import`, managed by `admin.committee.manage`.
- `member_profile_import`, managed by `admin.membership.manage`.

Existing operation types remain managed by `admin.bulk.manage`. Parent and row policies derive authorization from the operation type; Content Admin receives no new permission.

### Public projection

The public projection is implemented in a later phase as server-only code or a least-privilege database interface. If a database view is used on PostgreSQL 17, it must be `security_invoker = true`; it must expose only the approved fields and receive explicit grants. No browser role receives general `members` access.

## Delivery phases

| Phase | Deliverable | Exit requirement |
| --- | --- | --- |
| 1 | Baseline, runtime contracts, and migrations | Existing data preserved; clean replay succeeds; generated types and permission assertions pass |
| 2 | Shared intake, drafts, and administrative editing | Manual entry, `.xlsx`, CSV, and pasted cells use the same validation and draft pipeline |
| 3 | Public committee integration | Correct ordering and safe profiles for claimed, unclaimed, and frozen executives |
| 4 | Claiming and access controls | Invitations, identity review, and immediate freeze enforcement are verified |
| 5 | UI verification and production rollout | Browser checks, CI, Supabase verification, and deployed smoke tests pass |

Each phase receives its own implementation plan and review gate. Later phases consume, but do not silently redefine, the contracts established by earlier phases.

## Verification requirements

- Import new people, update consistently matched records, and rerun an import without duplicates.
- Reject missing IDs or emails, split-identity conflicts, unknown positions, and exceeded seat limits.
- Preserve leading zeros, Bengali text, quoted multiline cells, and existing values when cells are blank.
- Support one person across several committees and distinct position structures per term.
- Prove saved drafts leave public data unchanged.
- Verify transaction rollback, interrupted retries, idempotent replay, and stale-draft rejection.
- Keep unclaimed and frozen executives publicly visible without exposing private fields.
- Reject unauthorized and Content Admin mutations.
- Verify invitation expiry, reuse, recipient mismatch, existing-account conflicts, and email failure.
- Prove claiming preserves frozen status and direct edits cannot bypass official-identity review.
- Test mobile, tablet, and desktop layouts, keyboard navigation, dialogs, and long names.
- Run lint, type checks, unit and integration tests, admin access audits, migration checks, production build, and browser tests.
- Use synthetic fixtures outside production.
- Apply reviewed migrations before deploying code that depends on them, then verify schema/type parity, Supabase security and performance advisors, GitHub Actions, and the actual Vercel production commit.

## Live baseline recorded on 2026-09-23

The read-only Supabase audit found:

- Project `jnuits.org.bd` is healthy on PostgreSQL 17.6.
- Public executive terms 1 through 6 exist; committee 6 is current.
- A separate “Founding Executive Committee” record for term number 1 is already hidden, so it must remain preserved.
- No committee number has more than one public executive term.
- There are 19 global committee roles and 6 assignments: 2 linked to member identities and 4 legacy display-only assignments.
- No linked appointment duplicates exist for `(term_id, role_id, member_id)`.
- `bulk_operations` and `bulk_operation_rows` contain no production rows.
- Production migration history is current through `20260825010200_member_directory_facets`.

These are observations, not fixture data. No implementation may depend on those counts remaining unchanged.

## Ownership and coordination

- Codex owns schema, migrations, validation, imports, publication, permissions, claiming, and functional frontend integration.
- Antigravity owns UI stabilization, responsive behavior, accessibility, rendering performance, and real-browser verification while preserving the agreed contracts and theme.
- Codex works in the isolated `codex/committee-onboarding` branch and worktree based on the verified integration baseline.
- Shared membership surfaces require explicit coordination so both agents do not edit the same files concurrently.

## Completion constraints

Official spreadsheets, historical priorities, and verified dates are still required to populate complete committees 1 through 6. Synthetic fixtures may validate the system, but roster completion cannot be claimed until administrators approve the supplied data and publication preview.

Do not fabricate missing roster information, delete legacy records, remove the backup branch, grant committee-derived admin privileges, or apply an unreviewed migration to production.
