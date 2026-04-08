# JnUITS Full Stack Deploy 

Unified Next.js + Supabase application for the JnUITS public site, member portal, certificate verification, and technical admin workflows.

## Current scope

- Next.js 16 app router bootstrap at repo root
- Supabase SSR client, server client, admin client, and `proxy.ts` session refresh
- Core schema and RLS baseline applied to the connected Supabase project
- Public certificate verification routes and import/parity scripts
- Temporary public membership application and status-check flow
- Initial auth flows for sign-in, password recovery, email confirmation, and invitation-based claim
- Committee term and assignment administration in `/admin/committee`
- Operator reporting snapshots and reconciliation views in `/admin/reports`
- Richer portal moderation flows for workplace requests and profile change requests
- Step-up protected direct profile edits and member blog authoring in the portal
- Supabase-backed content/admin models for public pages, with direct Cloudinary upload plus metadata registration for large media
- Repo-managed CSV onboarding and reconciliation scripts with archived reports
- Phase tracker and walkthrough documents in [`plan`](./plan)

## Required environment variables

Create `.env.local` from `.env.example` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `APP_BASE_URL`

Deferred until their phases:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_PRESET`
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_RELEASE`

Optional for script-persisted operator reports:

- `SUPABASE_REPORT_ACTOR_USER_ID`

## Local development

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run lint
npm run typecheck
npm run build
npm run certificates:import -- --file path/to/certificates-import-ready.csv --dry-run
npm run certificates:verify -- --file path/to/certificates-import-ready.csv
npm run members:onboard -- --file artifacts/templates/member-onboarding-template.csv --dry-run
npm run members:reconcile -- --dry-run
```

Sentry smoke test in local development:

```bash
curl http://localhost:3000/api/debug/sentry
```

## Platform notes

- Node is pinned to `24.14.1` in `.nvmrc` and `24.x` in `package.json`.
- Set the Vercel project Node version to `24.x` as well.
- Large videos and photos should live in Cloudinary; Supabase stores media metadata, moderation state, and relational links.
- Supabase email templates should route confirmation and recovery links to:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

- Sentry is configured with `@sentry/nextjs`, a `/monitoring` tunnel route, and App Router global error capture.
- `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` are required for runtime telemetry.
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are needed if you want source maps uploaded during `next build`.

## Reports and evidence

- Certificate import and parity reports are written to `artifacts/reports/certificates/`.
- Membership onboarding and reconciliation reports are written to `artifacts/reports/membership/`.
- Phase tracking and verification gates are maintained in [`plan/IMPLEMENTATION_TRACKER.md`](./plan/IMPLEMENTATION_TRACKER.md).
