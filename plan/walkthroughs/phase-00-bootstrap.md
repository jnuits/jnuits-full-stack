# Phase 00: Bootstrap

## Goal

Stand up a single deployable Next.js app at the repo root with Supabase SSR foundations, project standards, and Vercel-compatible defaults.

## Implementation checklist

- Confirm repo root contains the Next.js app, not a nested workspace.
- Pin Node to `22.x` in `package.json` and `.nvmrc`.
- Add shared public, auth, portal, admin, and API route groups.
- Add `src/lib/supabase/client.ts`, `server.ts`, `proxy.ts`, and `admin.ts`.
- Add root `proxy.ts` using the current Next.js proxy convention.
- Document required environment variables and Vercel/Supabase settings in `README.md`.

## Verification checklist

- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Confirm protected portal/admin routes redirect unauthenticated users to `/login`.

## Test data or fixture needs

- Valid Supabase URL and publishable key
- One server-only Supabase secret key

## Acceptance gate

The app builds locally, Vercel detects it as Next.js, and the auth/session helpers are in place without any dependency on the old Strapi proxy.

## Rollback or recovery notes

If bootstrap breaks the deploy, revert to the previous commit and restore only the file-based scaffold plus env documentation before reapplying changes incrementally.
