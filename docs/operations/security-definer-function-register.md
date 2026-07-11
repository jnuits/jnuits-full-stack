# SECURITY DEFINER Function Register

This register records the deliberate authenticated execution surface for the
remaining `public` schema `SECURITY DEFINER` helpers. It is an operations
review artifact, not a substitute for RLS, server-side authorization, or the
Supabase security advisor.

## Verification Snapshot

Verified against the production project on 2026-07-11, using read-only
metadata queries:

- all helpers in the table below have `search_path` set to the empty schema;
- `anon` cannot execute any of the `SECURITY DEFINER` helpers below;
- `authenticated` and `service_role` can execute them because RLS policies or
  authenticated session-refresh code call them;
- `is_aal2()` is not a `SECURITY DEFINER` function. It only reads the current
  JWT claim and is intentionally available to the policy engine.

Supabase reports these functions because any authenticated RPC-callable
`SECURITY DEFINER` function deserves review. The warning is not, by itself,
evidence that the function should be revoked.

## Approved Authenticated Helpers

| Function | Purpose | Why `SECURITY DEFINER` is required | Direct RPC result | Decision |
| --- | --- | --- | --- | --- |
| `can_access_mentorship_relationship(uuid)` | RLS for mentorship relationships and messages | Resolves the caller's relationship safely without recursive policy reads | Boolean for the caller and supplied opaque UUID | Keep authenticated execute |
| `can_access_support_ticket(uuid)` | RLS for support tickets and replies | Checks the caller's ownership, assignment, or scoped ticket permission | Boolean only; inaccessible and missing IDs both resolve to false | Keep authenticated execute |
| `can_manage_support_ticket(uuid)` | RLS for ticket updates | Resolves the caller's ticket-management scope without exposing the ticket row | Boolean only | Keep authenticated execute |
| `current_member_id()` | RLS ownership checks for member-linked rows | Reads only the member ID linked to `auth.uid()` | The caller's own member ID or null | Keep authenticated execute |
| `current_member_type()` | RLS policy branching for member/alumni flows | Reads only the member type linked to `auth.uid()` | The caller's own type or null | Keep authenticated execute |
| `current_rbac_claims_snapshot()` | SSR/proxy fallback while a fresh JWT claim is not yet available | Reads only active roles and member ID for `auth.uid()` | The caller's own role/member snapshot | Keep authenticated execute |
| `has_permission(text)` | Canonical permission predicate in RLS and server/session checks | Reads RBAC join tables that ordinary callers must not select directly | Boolean for the caller's own permission | Keep authenticated execute |
| `is_admin_totp_enforced()` | Admin MFA routing before a user reaches AAL2 | Reads the global security setting that is otherwise protected | Global boolean only | Keep authenticated execute |
| `is_super_admin()` | RLS hierarchy checks | Reads only whether `auth.uid()` has the super-admin grant | Boolean for the caller | Keep authenticated execute |

## Narrowing Candidate

| Function | Current purpose | Residual concern | Next safe step |
| --- | --- | --- | --- |
| `is_super_admin_user(uuid)` | Prevents lower admins from modifying a super-admin target in `admin_profiles` RLS policies | A signed-in caller can ask whether an arbitrary opaque user ID is a super admin | Stage a reviewed migration that returns false unless the caller has `admin.admin_profiles.manage`; preserve policy behavior and test normal-admin, super-admin, and portal-user cases before applying live |

Do not revoke `authenticated` execution from this helper before changing the
policy design: RLS expressions call it while evaluating `admin_profiles`
access. A blind revoke would make valid profile-management policies fail.

## Functions Already Restricted

`20260705151405_restrict_authenticated_security_definer_exec.sql` restricts
legacy bulk/lifecycle helpers and `has_platform_role(text)` to `service_role`.
Those functions are not needed by current RLS policies or client code.

## Review Procedure

Before altering any entry:

1. Search all migrations, `schema.sql`, and app RPC calls for the function.
2. Confirm the live function remains `SECURITY DEFINER` only where a policy
   needs a non-recursive lookup, with `search_path` explicitly set.
3. Confirm `anon` execution is still revoked.
4. Add focused RLS/API tests for the caller types affected.
5. Apply a reviewed migration only after explicit live-DB approval, reload the
   PostgREST schema cache, then re-run the Supabase security advisor.

The advisor warnings for the approved helpers should remain visible as a
review reminder until Supabase supports a documented per-function suppression
mechanism. Do not hide them by weakening the portal's RLS model.
