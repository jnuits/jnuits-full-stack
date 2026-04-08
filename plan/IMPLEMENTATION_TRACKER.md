# Implementation Tracker

| Phase | Status | Blocker | Owner | Prerequisites | Evidence | Exit Gate |
| --- | --- | --- | --- | --- | --- | --- |
| Phase 00: Bootstrap | In progress | Local env vars still need to be populated | Codex + project owner | Vercel project linked, repo bootstrapped, Node 24 pinned | Next.js app scaffold, Supabase helpers, `proxy.ts`, README | `npm run build` passes locally and in Vercel preview |
| Phase 01: Auth, RBAC, data core | In progress | Need generated DB types refresh after future schema changes | Codex | Supabase project available | Migrations applied, tables created, RLS enabled, roles seeded | Auth shell works, route protection works, RLS baseline verified |
| Phase 02: Certificates | In progress | Import-ready CSV still needs to be supplied | Codex + operator | Core schema applied, server secret available | Public routes, batch/view APIs, import/parity scripts | Dry-run and apply import reports match source CSV counts |
| Phase 03: Public site shell | In progress | Legacy content parity pass still pending | Codex + content owner | Bootstrap routes exist | Home/about/events/blogs/gallery/notices/developers/contact routes, refined brand theme, light/dark switch | Public shell reaches design/content parity for global sections |
| Phase 04: Content + media | In progress | Supabase-backed content tables and media moderation are still pending | Codex + content owner | Phase 03 | Structured public-content layer, legacy media reuse, route rebuild for about/blogs/events/gallery/notices/developers | Public collections render from Supabase-backed models |
| Phase 05: Membership transition | In progress | Directory verification gate and directory read paths still need to be completed | Codex + membership operators | Phases 00-01 | Claim flow validation, public intake, admin review queue, invitation generation evidence | Application intake and invitation claim are both operational |
| Phase 06: Member portal | Pending | Profile edit and step-up verification policy not implemented yet | Codex | Member schema and auth flows live | Portal profile, change password, workplace request, timeline, authoring evidence | Claimed members can safely manage profile flows |
| Phase 07: Admin ops | In progress | Moderation, committee, and reconciliation tooling are still pending | Codex + technical operators | Earlier data phases complete | Membership review queue, invitation generation, audit trail, queue UX | Operators can complete sensitive workflows without legacy admin |
| Phase 08: Rehearsal + cutover | Pending | Migration rehearsal data and parity reports not prepared yet | Codex + project owner | All earlier phases | Smoke tests, rollback drill, parity reports, screenshots | Production cutover approved and rehearsed |

## Required evidence rules

- Migration output: keep local SQL files in `supabase/migrations/` and confirm applied migration names.
- Test results: capture `npm run lint`, `npm run typecheck`, and `npm run build` output before phase exit.
- Parity reports: store certificate and later content/member parity reports under `artifacts/reports/`.
- UI evidence: capture screenshots for critical public, portal, and admin flows before sign-off.

## Active concerns

- Vercel still needs its project-level Node version aligned to `24.x`.
- The app will not run end-to-end until the required `.env.local` values are set locally and in Vercel, especially `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
