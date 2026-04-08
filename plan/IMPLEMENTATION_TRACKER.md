# Implementation Tracker

| Phase | Status | Blocker | Owner | Prerequisites | Evidence | Exit Gate |
| --- | --- | --- | --- | --- | --- | --- |
| Phase 00: Bootstrap | In progress | Local env vars still need to be populated | Codex + project owner | Vercel project linked, repo bootstrapped, Node 24 pinned | Next.js app scaffold, Supabase helpers, `proxy.ts`, README | `npm run build` passes locally and in Vercel preview |
| Phase 01: Auth, RBAC, data core | In progress | Need generated DB types refresh after future schema changes | Codex | Supabase project available | Migrations applied, tables created, RLS enabled, roles seeded | Auth shell works, route protection works, RLS baseline verified |
| Phase 02: Certificates | In progress | Import-ready CSV still needs to be supplied | Codex + operator | Core schema applied, server secret available | Public routes, batch/view APIs, import/parity scripts | Dry-run and apply import reports match source CSV counts |
| Phase 03: Public site shell | In progress | Legacy content parity pass still pending | Codex + content owner | Bootstrap routes exist | Home/about/events/blogs/gallery/notices/developers/contact routes, refined brand theme, light/dark switch | Public shell reaches design/content parity for global sections |
| Phase 04: Content + media | In progress | Legacy exports and production Cloudinary media still need to be imported | Codex + content owner | Phase 03 | `content_*`, `gallery_entries`, `developer_profiles`, and `media_assets` tables applied; `/admin/content` live; direct Cloudinary upload workflow built; public about/blogs/events/gallery/notices/developers/committee routes read from Supabase with fallback preview data | Public collections render from Supabase-backed models and content owners can manage publish state/media references without legacy admin |
| Phase 05: Membership transition | In progress | Directory verification rehearsal and legacy membership parity checks still need evidence | Codex + membership operators | Phases 00-01 | Claim flow validation, public intake, admin review queue, invitation generation evidence, directory verification gate | Application intake and invitation claim are both operational |
| Phase 06: Member portal | In progress | Richer author moderation polish and real media-backed member drafts still need follow-through | Codex | Member schema and auth flows live | Live portal profile view, directory verification form, workplace request flow, password change UX, timeline evidence, step-up protected direct edits, member blog authoring, profile change request submission and owner history | Claimed members can safely manage profile flows and submit moderated edits without touching `/admin` |
| Phase 07: Admin ops | In progress | Production-scale rehearsal data for committee rollover and CSV migrations still needs to be exercised | Codex + technical operators | Earlier data phases complete | Membership review queue, invitation lifecycle controls, workplace moderation queue, profile change moderation queue, committee term/assignment workspace, committee rollover automation, operator snapshot reports, CSV onboarding/reconciliation scripts, audit trail, queue UX | Operators can complete sensitive workflows without legacy admin |
| Phase 08: Rehearsal + cutover | Pending | Migration rehearsal data and parity reports not prepared yet | Codex + project owner | All earlier phases | Smoke tests, rollback drill, parity reports, screenshots | Production cutover approved and rehearsed |

## Required evidence rules

- Migration output: keep local SQL files in `supabase/migrations/` and confirm applied migration names.
- Test results: capture `npm run lint`, `npm run typecheck`, and `npm run build` output before phase exit.
- Parity reports: store certificate and later content/member parity reports under `artifacts/reports/`.
- UI evidence: capture screenshots for critical public, portal, and admin flows before sign-off.

## Active concerns

- Vercel still needs its project-level Node version aligned to `24.x`.
- The app will not run end-to-end until the required `.env.local` values are set locally and in Vercel, especially `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- The current `SENTRY_AUTH_TOKEN` can build with Sentry enabled, but it does not currently have enough read scope to verify event ingestion back through the Sentry API.
- Large images and videos should live in Cloudinary; Supabase now stores media metadata and publishing state only.
- Content, committee, and reporting schemas are live, but legacy import scripts/parity datasets still need to be supplied before those phases can exit.
