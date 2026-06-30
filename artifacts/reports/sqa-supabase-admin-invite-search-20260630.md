# SQA Supabase Admin Invite Search Verification

Date: 2026-06-30
Project: `fsirdkjgrcocowxqjhjg`
Mode: read-only metadata check through Codex Supabase plugin `_execute_sql`

## Result

The production database has the earlier hardening migrations applied, but it does not yet have the latest admin invitation/member search migration objects.

| Check | Object | Present | Detail |
| --- | --- | --- | --- |
| migration | `20260608093000` | yes | `admin_permission_policy_hardening` |
| migration | `20260612090000` | yes | `security_performance_remediation` |
| migration | `20260613090000` | yes | `public_certificate_safe_view` |
| table | `public.admin_invitations` | no | required by latest admin lifecycle/invite UI |
| column | `admin_invitations.claim_invitation_id` | no | depends on `public.admin_invitations` |
| extension | `pg_trgm` | no | required for indexed member invite search |
| index | `members_admin_invite_email_trgm_idx` | no | pending migration object |
| index | `members_admin_invite_full_name_trgm_idx` | no | pending migration object |
| index | `members_admin_invite_jnuits_id_trgm_idx` | no | pending migration object |
| index | `members_admin_invite_member_type_trgm_idx` | no | pending migration object |

## Interpretation

`supabase/migrations/20260630090000_admin_invitation_member_search_hardening.sql` is still pending on production. The new local verification script should fail until this migration is reviewed and applied.

No secrets, user rows, invite tokens, emails, or profile data were selected for this report.
