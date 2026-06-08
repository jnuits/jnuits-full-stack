# Admin Panel Audit Remediation Tracker

Date: 2026-06-07

## Implemented In This Pass

- Centralized admin route, navigation, badge, permission, and MFA metadata in `src/lib/admin/access.ts`.
- Added `src/lib/admin/api-auth.ts` so admin API routes can require an explicit permission before using service-role Supabase clients.
- Converted admin layout route checks and sidebar visibility to permission-driven access metadata.
- Added route metadata for Admin Profiles, Bulk Operations, About, Slider, and Contact Settings.
- Replaced broad admin/operator checks in membership, certificates, reports, content, media, events, gallery, project, and legacy admin actions with explicit permission checks.
- Fixed `POST /api/admin/events/[eventId]/checkin` so authenticated non-admin users cannot mutate event registrations through the service-role path.
- Fixed the invitation registry toolbar overflow by letting filters wrap inside the admin content width.
- Kept invitation claim links on the public `/register` URL and removed query-string autofill behavior.
- Polished member, alumni, and membership-approval claim emails with manual steps, visible fallback links, expiry/support copy, and no promise of a second confirmation email.
- Removed the slider workspace debug console logging.

## Still Needs A Reviewed Database Migration

The app map now uses canonical permissions, but the SQL history still has older `has_platform_role(...)` policy definitions and broad grants in the generated schema dump. A hardening migration should be reviewed before applying to production because these policies affect public content, admin workspaces, and legacy compatibility helpers.

Recommended migration scope:

- Replace remaining management RLS policies that call `public.has_platform_role(...)` with `public.has_permission(...)` equivalents from `src/lib/admin/access.ts`.
- Keep public read policies only for intentional public surfaces such as published content, public events, public gallery items, contact settings, and directory-safe member data.
- Keep `public.has_platform_role(text)` only as a compatibility helper if existing policies still depend on it, and document that it maps canonical roles/permissions rather than granting a new authority surface.
- Revoke execute on sensitive `SECURITY DEFINER` functions from `anon` and `authenticated`; grant only to `service_role` when the function mutates privileged data.
- Keep low-risk identity helpers executable by `authenticated` only when they return data scoped to the current user.
- Verify all exposed public tables have RLS enabled after the migration.

High-priority functions/grants to re-check:

- `public.finalize_member_invitation_claim(...)`: should remain `service_role` only.
- `public.allocate_membership_id(...)`, `public.set_member_lifecycle_status(...)`, `public.preview_bulk_membership_operation(...)`, and `public.commit_bulk_membership_operation(...)`: either keep authenticated execution with in-function `has_permission(...)` checks, or restrict to `service_role` if all callers are service-role server actions.
- `public.has_permission(text)`: keep callable by `authenticated`; avoid granting to `anon` unless a public policy explicitly needs anonymous permission checks.
- Generated-schema table grants to `anon`: make sure RLS policies, not grants alone, are the real access boundary.

## Follow-Up Refactor Tasks

- Retire `src/app/admin/actions.ts` by moving remaining consumers into domain action files.
- Split the largest client workspaces into focused panels/hooks:
  - committee workspace
  - membership database workspace
  - invitations workspace
  - workplace workspace
- Standardize all admin API/action result envelopes:
  - safe user-facing `message`
  - stable `code`
  - server-only detailed provider/Supabase logs
- Add missing admin UX states:
  - loading
  - error
  - empty
  - retry affordance
  - safer confirmation modals
  - failed-delivery and batch-progress indicators

## Verification Checklist

- Run `npm run typecheck`.
- Run `npm run lint`.
- Smoke-test sidebar visibility with roles that have partial permissions.
- Smoke-test denied access to admin event check-in as an authenticated non-admin.
- Smoke-test Cloudinary/media APIs with and without `cms.media.manage`.
- Smoke-test gallery APIs with and without `cms.gallery.manage`.
- Smoke-test invitation registry filters at desktop and mobile widths.
- End-to-end claim flow:
  - issue invitation
  - receive email
  - open `https://jnuits.org.bd/register`
  - manually enter JnUITS ID, code, email, and password
  - finalize profile
  - sign in
  - refresh claims
  - land in the member/alumni portal
