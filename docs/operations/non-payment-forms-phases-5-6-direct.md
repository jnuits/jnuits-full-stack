# Non-payment forms Phases 5-6 direct execution

## Ownership

This branch is implemented directly by ClickUp Brain. Do not assign GitHub Copilot or create Copilot work branches.

## Production regression

Draft publication currently fails with `The selected draft could not be published.` The confirmed cause is ambiguous unqualified `form_definition_id` references inside `publish_form_version()`, whose `RETURNS TABLE` output creates a PL/pgSQL variable with the same name. Fix this only through a new forward-only migration. Do not edit migrations already applied to production.

## Form Studio outcome

Field IDs must be generated automatically, remain stable after persistence, and stay hidden from normal operators. The creation flow should be understandable to anyone familiar with Google Forms: plain-language questions, familiar field types, integrated ordering, preview, draft safety, compatible event selection, readiness checks, and explicit publication.

## Phase 5-6 scope

Complete private Cloudinary assets, bounded audited CSV/XLSX exports, on-demand Google Shared Drive snapshots, manual verified three-year retention, RBAC/AAL2 alignment, Sentry privacy, environment/system-health validation, scale/security verification, and CI hardening.

## Non-negotiable safety

- Payment remains rejected server-side.
- Use modern Supabase publishable/secret keys and `getClaims()` or JWKS only.
- Never use legacy key aliases or shared JWT-secret verification.
- Do not inspect or print secrets.
- Do not add dependencies without approval.
- Author migrations locally and commit them, but never apply live DDL/DML, grants, archive, or purge.
- Do not weaken tests, assertions, security gates, or audit allowlists.
- Missing credential-gated tests are blocked/skipped evidence, never passing evidence.
- Another senior agent must review before merge or database application.

## Delivery sequence

1. Publication regression and post-migration database hardening.
2. Automatic field identity and Form Studio usability.
3. Private upload/download security.
4. Bounded export foundation.
5. Google Shared Drive snapshots.
6. Retention/archive workflow.
7. RBAC and AAL2 enforcement.
8. Sentry and environment validation.
9. Scale/security tests and CI.
10. Focused operational documentation and final review.
