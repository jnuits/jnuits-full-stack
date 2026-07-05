# Supabase Phase 2 Audit Evidence - 2026-07-05

Project: `jnuits.org.bd` (`fsirdkjgrcocowxqjhjg`)

Scope: read-only verification after the certificate full-name and public certificate hardening migrations. This report contains metadata and aggregate counts only.

## Migration State

Live migration history includes the expected backend/security migrations from June 2026 and the certificate migrations applied during the July 2026 release-readiness pass:

- `20260608093000_admin_permission_policy_hardening`
- `20260612090000_security_performance_remediation`
- `20260613090000_public_certificate_safe_view`
- `20260628034000_tighten_public_view_and_function_grants`
- `20260630190842_admin_account_lifecycle`
- `20260630191141_admin_invitation_member_search_hardening`
- `20260703020515_certificate_full_name`
- `20260703040706_cleanup_certificate_legacy_names`
- `20260705013614_tighten_certificate_public_access`
- `20260705013928_public_certificate_view_access`
- `20260705020732_public_certificate_security_invoker_view`
- `20260705022356_revoke_anon_admin_totp_helper`

## Certificate Verification State

- `certificates`: 134 rows.
- `public_certificates`: 134 rows.
- Raw `certificates` contains `certificate_id`, `source_document_id`, `source_record_id`, and canonical `full_name`.
- Raw `certificates` no longer contains `first_name` or `last_name`.
- Public `public_certificates` exposes the public-safe certificate projection with `full_name`.
- Public `public_certificates` no longer exposes `first_name`, `last_name`, `source_document_id`, or `source_record_id`.
- `anon` can select certificate `24007` from `public.public_certificates`.
- `public_certificates` is a `security_invoker=true` view. Public roles have column-scoped SELECT on safe certificate fields in `certificates`, while source identifier columns remain denied.

Conclusion: certificate schema drift is closed. Public certificate verification should use `public_certificates`; direct base-table access is limited to the same safe public columns so the security-invoker view can operate without bypassing RLS.

## RLS And Policy State

- Public tables with RLS disabled: `0`.
- Active public RLS policies still referencing `has_platform_role(...)`: `0`.

Conclusion: the earlier role-policy drift is closed at the policy layer. Keep `has_platform_role(...)` only as a compatibility helper until app usage no longer needs it.

## Grants Still Requiring Cleanup Review

Current public-role table grants remain broad:

- Non-SELECT grant entries to `anon` / `authenticated`: `599`.
- Public objects affected by non-SELECT grants: `52`.
- SELECT grant entries to `anon` / `authenticated`: `105`.

These grants are partially mitigated by RLS, but they are still broader than the app needs. Recommended next step is a reviewed, table-by-table grant tightening migration with route smoke tests, not a blanket revoke.

Priority tables to review first:

- `admin_profiles`
- `admin_invitations`
- `audit_events`
- `security_events`
- `member_invitations`
- `membership_applications`
- `profile_update_requests`
- `certificate_import_batches`
- `certificates_import_staging`
- RBAC tables
- support and mentorship tables

## Security Definer Function Exposure

`SECURITY DEFINER` functions executable by public roles:

| Function | anon | authenticated | Initial classification |
|---|---:|---:|---|
| `is_admin_totp_enforced()` | no | yes | Anonymous execute revoked; authenticated/service-role kept for admin MFA routing. |
| `allocate_membership_id(year_block text)` | no | yes | Sensitive mutation helper; review before authenticated execute remains. |
| `commit_bulk_membership_operation(target_operation_id uuid)` | no | yes | Sensitive mutation helper; likely should be service-role or permission-gated inside function. |
| `preview_bulk_membership_operation(target_operation_id uuid)` | no | yes | Review function body and permission checks. |
| `set_member_lifecycle_status(...)` | no | yes | Sensitive mutation helper; review function body and permission checks. |
| `has_permission(requested_permission text)` | no | yes | Required RLS/helper function; keep if body is safe. |
| `has_platform_role(role_code text)` | no | yes | Compatibility helper; remove later after code and policy usage are gone. |
| `is_super_admin()` / `is_super_admin_user(target_user_id uuid)` | no | yes | Required helper candidates; verify no broad data leak. |
| `current_member_id()` / `current_member_type()` | no | yes | Required portal/RLS helper candidates. |
| `current_rbac_claims_snapshot()` | no | yes | Verify output does not expose more than needed. |
| `can_access_mentorship_relationship(...)`, `can_access_support_ticket(...)`, `can_manage_support_ticket(...)` | no | yes | Likely RLS helpers; keep after body review. |

Conclusion: do not revoke these blindly. The next migration should classify each function by actual app dependency and either keep with documented body-level authorization or restrict execution.


## Advisor Notes

- public_certificates no longer appears as a security-definer view after 20260705020732_public_certificate_security_invoker_view.
- Anonymous execution of public.is_admin_totp_enforced() is closed by 20260705022356_revoke_anon_admin_totp_helper.
- public.security_rate_limits still appears as RLS-enabled with no policies. This is expected for a service-role-only rate-limit backend and should remain documented unless a public RPC path requires otherwise.

## Legacy And Data Integrity State

| Object | Live rows | Recommendation |
|---|---:|---|
| `gallery_album_items` | 986 | Canonical gallery item model; keep. |
| `gallery_entries` | 6 | Legacy candidate; verify rows are mirrored or archival before dropping code/table. |
| `profile_update_requests` | 8 | Preserve. Current state: 4 pending, 4 approved. |
| `member_invitations` | 6 | Preserve for onboarding audit/history. |
| `admin_invitations` | 0 | Schema ready; no live queue yet. |
| `operator_reports` | 17 | Preserve as history. Types include `content_inventory`, `reconciliation_snapshot`, `csv_onboarding`, `membership_reconciliation`, and `committee_roster`. |
| `admin_profiles` | 3 | All are `status = active` and `is_active = true`. |

## Phase 2 Status

Completed:

- Certificate migration drift closed.
- Public certificate safe view verified.
- Raw certificate source identifier fields denied to `anon`; safe public fields are column-granted for the security-invoker view.
- Public table RLS coverage verified.
- Old `has_platform_role(...)` policy drift verified as closed.
- Admin profile lifecycle consistency verified.

Still remaining:

- Reviewed grant-tightening migration for the 52 public objects with broad non-SELECT grants.
- Remaining authenticated security-definer helper classification; anonymous `is_admin_totp_enforced()` exposure is closed.
- Gallery legacy cleanup decision for `gallery_entries`.
- Route smoke tests after any grant/function hardening changes.

## Recommended Next Actions

1. Keep the certificate migrations and audit-script updates in the current change set.
2. Create a separate Supabase hardening migration for grants/functions only after reviewing exact app dependencies.
3. Run browser/API smoke tests for public content, portal member flows, admin invitation/member flows, events, gallery, support, and certificates before narrowing broad grants.
4. Keep `gallery_entries` until its 6 rows are confirmed migrated or intentionally archival.


