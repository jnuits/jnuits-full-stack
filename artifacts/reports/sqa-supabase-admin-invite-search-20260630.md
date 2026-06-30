# SQA Supabase Admin Invite Search Verification

Date: 2026-07-01
Project: `fsirdkjgrcocowxqjhjg`
Mode: read-only metadata check through Codex Supabase plugin `_execute_sql`, after approved live migration application through `_apply_migration`

## Result

The admin account lifecycle and admin invitation/member search migrations are now applied in production. Production migration history is authoritative because Supabase MCP recorded tool-generated versions.

| Check | Object | Present | Detail |
| --- | --- | --- | --- |
| migration | `20260630190842` | yes | `admin_account_lifecycle` |
| migration | `20260630191141` | yes | `admin_invitation_member_search_hardening` |
| table | `public.admin_invitations` | yes | RLS enabled |
| column | `admin_profiles.status` | yes | lifecycle state |
| column | `rbac_user_platform_roles.revoked_by_user_id` | yes | revocation attribution |
| column | `admin_invitations.claim_invitation_id` | yes | references `public.member_invitations(id)` |
| extension | `pg_trgm` | yes | installed in `extensions` schema |
| index | `admin_invitations_claim_invitation_idx` | yes | claim tracking lookup |
| index | `admin_invitations_email_status_idx` | yes | invite queue lookup |
| index | `admin_invitations_target_status_idx` | yes | target-user queue lookup |
| index | `admin_invitations_invited_by_idx` | yes | operator queue lookup |
| index | `members_admin_invite_email_trgm_idx` | yes | member invite search |
| index | `members_admin_invite_full_name_trgm_idx` | yes | member invite search |
| index | `members_admin_invite_jnuits_id_trgm_idx` | yes | member invite search |
| index | `members_admin_invite_member_type_trgm_idx` | yes | member invite search |

## Notes

The local migration file originally referenced `public.invitations(id)`, but this schema uses `public.member_invitations(id)`. The local migration was corrected before successful application. The PL/pgSQL exception condition was also corrected from `undefined_schema` to `invalid_schema_name`.

No secrets, user rows, invite tokens, emails, or profile data were selected for this report.
