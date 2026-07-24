# Non-payment forms pre-production verification

## Scope

Run only against the isolated pre-production Supabase project and application. Never point this workflow at production. Payment stays disabled.

## Required approval

Applying the pending migrations is a controlled database change and requires explicit approval from the repository owner. The verification workflow itself does not approve or apply migrations.

## Preconditions

- PR #65 reviewed and merged to `main`.
- A current pre-production backup or restore point is confirmed.
- Protected `preproduction` environment has `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `PREPRODUCTION_SUPABASE_SECRET_KEY`, and the documented non-production E2E account secrets.
- Environment variables include `PREPRODUCTION_SUPABASE_PROJECT_REF`, `PREPRODUCTION_SUPABASE_URL`, and `PREPRODUCTION_APP_URL`.
- Two synthetic confirmed alumni cases exist for approve/reject verification. Record their IDs as `E2E_ALUMNI_APPROVE_CASE_ID` and `E2E_ALUMNI_REJECT_CASE_ID`; record the expected canonical ID as `E2E_ALUMNI_EXPECTED_JNUITS_ID`.

## Migration sequence

1. Confirm backup/restore readiness.
2. Run migration parity before applying anything.
3. Review the pending SQL in timestamp order.
4. Apply only to isolated pre-production through the normal Supabase migration workflow.
5. Regenerate `src/lib/db/types.ts` from the linked pre-production schema and commit the result.
6. Run migration parity again and inspect RLS/advisor output.

## Verification

Dispatch **Pre-production Verification** from `main` with both inputs enabled:

- `run_event_registration_concurrency=true`
- `run_authenticated_e2e=true`

Set `E2E_ALUMNI_WORKFLOW=1` for the protected alumni decision fixture run. Required outcomes:

- one confirmed seat and eleven waitlisted results under the 12-way event test;
- duplicate, closed, and full outcomes create no extra registrations;
- normal admin can approve one alumni case, see the canonical invitation handoff, and reject a separate case;
- role-denial, Form Studio, portal, public smoke, runtime probe, migration parity, and admin invitation schema checks pass;
- Playwright report, traces, screenshots, and runtime evidence are retained.

## Rollback and recovery

If migration or smoke verification fails, stop the run and block release. Do not attempt ad hoc production-like fixes. Restore the isolated pre-production database from its confirmed restore point or apply a reviewed forward-fix migration, then rerun the entire verification sequence. Application rollback alone does not reverse schema changes.

## Completion evidence

Record workflow URL, commit SHA, migration list, generated-type diff, concurrency JSON output, authenticated Playwright outcome, skipped tests, and any restore/forward-fix action in issue #64 and PR #65.
