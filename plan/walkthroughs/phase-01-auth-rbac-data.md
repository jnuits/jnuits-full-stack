# Phase 01: Auth, RBAC, and Data Core

## Goal

Create the foundational Supabase schema for profiles, members, invitations, RBAC, certificates, and auditability with RLS enabled by default.

## Implementation checklist

- Apply extensions/helpers migration.
- Apply identity/certificates/RLS migration.
- Seed canonical platform roles.
- Ensure `profiles.platform_role` is not used anywhere.
- Enforce partial uniqueness on active RBAC grants where `revoked_at is null`.
- Add or refresh TypeScript database types after schema changes.

## Verification checklist

- Confirm tables exist with RLS enabled.
- Confirm `rbac_platform_roles` is seeded.
- Confirm the function search path lint is resolved.
- Confirm Supabase security advisors return no active lints after the core schema is applied.

## Test data or fixture needs

- One admin user for later RBAC testing
- One seeded member row linked to an auth user for portal testing
- One seeded invitation for claim-flow testing

## Acceptance gate

The connected Supabase project can be recreated from migrations, and auth-sensitive tables are protected by RLS plus explicit policies.

## Rollback or recovery notes

If a migration needs correction, create a forward fix migration instead of editing production state manually.
