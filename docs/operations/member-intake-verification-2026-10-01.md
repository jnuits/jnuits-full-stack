# Member intake verification — 1 October 2026

## Release status

The intake/catalog/import-guidance implementation is committed locally on
`codex/membership-lifecycle-implementation`. The complete release is **not yet
declared production-ready**: the live public Google Sheet success-path check
remains pending, and these intake migrations have not been applied to the hosted
project. No push, merge, or production deployment was performed for this slice.

Approved plan: [Member intake, catalog, and guidance](../superpowers/plans/2026-09-29-member-intake-catalog-and-guidance.md).

Implementation commits: `b1ba263`, `6441578`, `fedb47a`, `fe3b2e6`, `68f8cde`,
`0469eef`, `830ac67`. Review corrections: `d941bba`.

## Verified behavior

- Department short codes, official names, reviewed aliases, and legacy slugs
  resolve to the existing internal department key. CSE does not become a second
  department or an uppercased slug-valued foreign key.
- New profile intake requires exactly two batch digits, including `07` and `08`,
  and a real ISO joining date. Storage remains numeric `1..99`; exports preserve
  leading zeros. Existing legacy staged one-digit values remain publishable.
- Publishing persists the joining date on create, ordinary update, and date-only
  update. Omitting the date preserves the existing value. Existing profiles with
  unknown historical joining dates can still receive unrelated edits; no date is
  fabricated.
- Blank templates, separate fictional samples, field instructions, and department
  references are available in Membership DB. All seven visible legacy bulk
  operations and certificate import also have generated CSV/XLSX guidance.
- Row errors include the row, field, stable code, safe received value, cause,
  accepted format, and example. Full error reports are downloadable and protect
  spreadsheet cells from formula interpretation.
- Uploaded CSV, XLSX, pasted rows, and Google Sheet snapshots share the persisted
  draft workflow. Inspection and draft saving do not write canonical members.
  Publication remains explicitly confirmed, permission checked, revision checked,
  transactional, and retry safe.
- Google Sheet fetching remains host allowlisted, bounded, timed out, and
  redirect checked. Parser errors do not echo fetched private headings or cells.

## Evidence

| Gate | Observed result |
| --- | --- |
| Full Node suite | 207 files, 1,243 tests passed |
| Full DOM suite | 25 files, 230 tests passed |
| Focused intake integration | 22 files, 213 tests passed |
| Committee onboarding foundation/publish contracts | 2 files, 13 tests passed |
| CI migration integrity, dependency units, and credential guard | 12 files, 71 tests passed |
| TypeScript / ESLint | Passed |
| Production-mode build using non-secret CI placeholders | Passed; placeholder backend lookup warning was expected |
| Admin access audit | Passed: 39 routes, 20 permissions |
| Admin responsive-pattern audit | No risky patterns found |
| Strict migration dependency scan | 104 migrations, no findings |
| Supported clean bootstrap replay | All 104 repository migrations plus the verification-only bootstrap helper applied and assertions passed |
| Actual intake publish RPC assertions | Create/update/date-only/omitted fields/leading-zero batches/rejection rollback/retry behavior passed |
| Historical migration runtime assertions | Passed in a disposable stack using the unchanged CI verification SQL |
| Protected browser source matrix | 40 checks across four widths, two themes, and five source states: 0px page overflow |
| Browser canonical publication | Manual draft inspection/save/validate/confirm/publish passed; canonical CSE, batch `07`, and joining date checked in the local database |
| Browser invalid-row handling | Invalid department/batch/date blocked validation and publication; complete error CSV downloaded |
| Browser guidance downloads | Blank/sample CSV/XLSX and department-code CSV returned nonempty successful responses |
| Browser keyboard / page identity / runtime health | Visible keyboard focus, correctly named controls, nonblank Membership DB page, no framework error overlay, no page/console errors |

Browser environment: Chromium against `http://localhost:3100/admin/membership`
at 375, 768, 1024, and 1440 CSS pixels in light and dark themes. The Browser plugin
was unavailable, so regular Playwright was used. All identities were fictional
and all writes targeted an isolated local Supabase stack, not production.
Authentication used real Supabase password sign-in and TOTP verification (AAL2),
with the application's normal RBAC, lifecycle, and route guards. CAPTCHA remained
enabled in the app configuration; this was not a login/CAPTCHA UI audit.

The new local Supabase default revoked API privileges that the older hosted
project already grants. A read-only hosted privilege check confirmed the
difference. Only the disposable local configuration used the CLI's legacy
auto-exposure compatibility setting before replaying the repository's explicit
grants, revocations, and RLS policies. No hosted grants or settings were changed.

On Windows, the unchanged historical runtime SQL was run through native
PowerShell/docker invocation because the older Git Bash runner hung after fixture
seeding. The supported clean-bootstrap runner ran through Git Bash with its
existing `SUPABASE_REPLAY_DB_PORT=45432` override. Neither procedure used remote
database arguments.

## Review findings resolved

The required fresh whole-branch review identified three publishing blockers:
department slugs were uppercased, leading-zero batches were rejected, and the
joining date was ignored by the database RPC. Regression tests and a real local
database failure reproduced these before the forward correction.

The same fix pass covered fetched-content error disclosure, impossible year-zero
dates, historical-profile edits incorrectly requiring unknown joining dates,
legacy preview batches exceeding the database range, the missing fictional CSV
sample link, and omitted certificate report codes. Previously committed migration
files were left unchanged; the RPC correction is a new forward migration.

Each correction was tested RED-to-GREEN, followed by the complete passing suites.
There was one fresh reviewer and one correction pass, not repeated reviewer
dispatches.

## Remaining intake gate

Supply an “Anyone with the link” Google Sheet containing only the fictional
sample rows. Verify server-side capture, field mapping, draft save/validation, and
explicit publication against that live Sheet, including `07`/`08`, and compare
the canonical result with an equivalent uploaded CSV. Restrict the Sheet again
after capture if desired.

Positive Sheet capture, redirect/timeout/size limits, response privacy, and source
equivalence passed automated tests. The browser verified the Sheet controls,
privacy guidance, and rejection of a non-Google link at every viewport/theme;
this is **not** evidence of a successful live Google-hosted capture.

Minor visual observation: long draft-summary labels can approach the metric-card
icon at desktop widths. This does not hide actions or change validation, but
should receive a targeted visual-polish pass before final rollout. Other browser
engines and live production connectivity were not tested in this slice.

## Later approved slices — not implemented here

1. [Renewal and departure](../superpowers/plans/2026-09-29-membership-renewal-and-departure.md): joining-date annual anniversaries, six-month grace period, former-member restrictions, overdue restoration, departure/appeal handling, and removal of cycle-window administration.
2. [Committee roster finalization](../superpowers/plans/2026-09-29-committee-roster-finalization.md): search existing canonical members, position/seat completion, successor-roster confirmation, and automatic outgoing-EC alumni conversion.
3. [Member/advisor photos and rollout](../superpowers/plans/2026-09-29-member-advisor-photos-and-rollout.md): optimized Cloudinary replacement, canonical public photo fallback, hosted migrations, CI, deployment, and production verification.

The existing cycle-window UI and committee compatibility code have deliberately
not been removed during intake verification. CLI-only repair/import tools and
public application/display changes are not silently included in this slice.
