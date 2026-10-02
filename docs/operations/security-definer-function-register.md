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
| `edit_onboarding_draft_row(uuid,uuid,integer,jsonb,jsonb,jsonb,text)` | Correct one persisted onboarding draft row while advancing its revision | Committee managers must be able to stage constrained member changes without receiving general member-table write access | Operation ID and the new draft revision after permission, state, and revision checks | Keep authenticated execute |
| `has_permission(text)` | Canonical permission predicate in RLS and server/session checks | Reads RBAC join tables that ordinary callers must not select directly | Boolean for the caller's own permission | Keep authenticated execute |
| `is_admin_totp_enforced()` | Admin MFA routing before a user reaches AAL2 | Reads the global security setting that is otherwise protected | Global boolean only | Keep authenticated execute |
| `is_super_admin()` | RLS hierarchy checks | Reads only whether `auth.uid()` has the super-admin grant | Boolean for the caller | Keep authenticated execute |
| `set_onboarding_draft_row_excluded(uuid,uuid,integer,boolean,text)` | Exclude or restore a persisted onboarding row with attribution | Atomically updates row exclusion state and invalidates the parent validation revision | Operation ID and the new draft revision | Keep authenticated execute |
| `validate_onboarding_draft(uuid,integer)` | Seal one draft revision for publication | Locks the parent and rows and validates their persisted contract across permission-scoped staging tables | Operation ID, revision, valid-row count, and preview status | Keep authenticated execute |
| `commit_onboarding_draft(uuid,integer,boolean)` | Atomically publish validated member/profile and committee appointment changes | Committee managers need a narrow path that can update identities and appointments without broad membership access; the function rechecks permission, versions, identities, positions, media, and seat limits | Aggregate commit result; completed retries return the stored result | Keep authenticated execute |

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

## Admin Verification Foundation (2026-10-02, staged)

`20261002154457_admin_verification_foundation.sql` adds service-only JSON RPCs:
`admin_verification_context`, `prepare`, `begin_email`, `mark_email_delivery`,
`load_email_challenge`, `redeem_email`, `reserve_password_attempt`,
`issue_password`, `reserve`, `check_read`, and `record_enrollment` (all with
the `admin_verification_` prefix and one `jsonb` argument).

All use an empty search path. PUBLIC, anon and authenticated execute is revoked;
only service_role can execute the public wrappers. All private implementation
functions and tables deny browser and service-role direct access. The wrappers
recheck live Auth session, active administrator, current role version, permission,
confirmed email, enrollment history and security policy. No secrets or OTPs are
returned by the context/preparation RPCs or written to audit records. This is
staged local verification evidence, not a claim of hosted deployment.

## Admin Operation Guards (2026-10-02, staged)

`20261002165457_admin_verification_operation_guards.sql` adds service-only
`admin_verification_check_write(jsonb)` for non-consuming, exact-intent mutation
preflight. The authenticated `confirm_membership_renewal` now has a seventh,
optional proof argument; the previous six-argument implementation is private
and denies browser/service execution. The wrapper derives its actor from the
signed JWT, checks the live session/current grant version and consumes proof
atomically with renewal state and audit writes. Genuinely verified TOTP sessions
retain legacy-call compatibility. Historical receipt dates are not authorized
by email proof for a different, current-day operation.

`private.require_membership_operator()` now applies the routine-review policy:
active membership permission and a live/current session, with actual TOTP MFA
when mandatory enforcement is on. It does not relax the renewal wrapper.
All new private helpers revoke PUBLIC, anon, authenticated and service execution.
The same staged migration adds these narrowly scoped entry points:

| Function | Allowed execution | Boundary |
| --- | --- | --- |
| `apply_admin_role_operation(text,jsonb,text)` | authenticated only | Signed-session actor, real TOTP plus exact password proof, serialized target/last-super checks and atomic role/audit writes |
| `update_admin_security_verified(jsonb,text)` | authenticated only | Exact protected intent; only a super admin can disable enforcement; settings, audit and proof consumed atomically |
| `revoke_admin_invitation_verified(jsonb,text)` | authenticated only | Exact invitation/confirmation and target hierarchy; pending invitations only; cannot remove accepted admin access |
| `accept_verified_admin_invitation(uuid)` | authenticated only | Immutable verified issuer authorization, recipient/session/member/expiry/delivery checks and transactional grant; unsigned legacy invitations rejected |
| `complete_admin_invitation_operation(uuid,jsonb)` | service_role only | Reserved issuer intent and live actor; recipient and requested role are immutable before external Auth/member-claim side effects |
| `complete_admin_lifecycle_operation(uuid,jsonb)` | service_role only | Reserved exact target, fresh actor and observed Auth ban/unban before atomic profile/audit/attempt completion |
| `complete_admin_retention_operation(uuid,jsonb)` | service_role only | Reserved operation/scope/job and current permission/session/policy; atomic discovery, archive state/evidence, approval or bounded purge |

All use an empty search path and deny PUBLIC/anon execution. Private helpers,
immutable invitation authorization records and workflow attempts deny direct
browser/service access. Role and lifecycle writers share the last-super-admin
lock; pending freeze reservations block target mutations and actor access,
including expired uncertain attempts until authorized reconciliation. No
uncertain proof is restored or automatically retried.

The former `purge_retention_job(text,uuid,uuid)` implementation is now a private
core with no direct browser/service execute grant. Its public legacy signature
fails closed and also revokes service-role execute. The developed retention
service still creates/verifies HMAC archive evidence before the completion RPC;
the database checks that approval/purge use the exact persisted evidence and
preserves the existing PII cutoff, not a new client-provided purge boundary.

Security settings, system health and retention pages authorize their own named
five-minute read scope before loading protected data. The central route map
retains each page's permission and scope rather than an AAL2-only layout gate.
The global workspace-entry enforcement remains unchanged.

These are disposable replay verification results, not hosted deployment:
neither staged migration has been applied to the production project yet.

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
