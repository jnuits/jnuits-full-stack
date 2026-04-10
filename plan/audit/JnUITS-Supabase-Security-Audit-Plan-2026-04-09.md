# JnUITS Supabase Backend Audit + Security/Bug Remediation Plan

Date: 2026-04-09  
Scope: Supabase schema/RLS/migrations, Next.js API routes, auth/session behavior, operational safety.

## Executive Summary

The backend is structurally strong (RLS-enabled schema, role model, moderated workflows, service separation), but several practical security and reliability gaps remain:

- abuse protection/rate-limiting is mostly absent on public and sensitive endpoints
- service-role usage is broad and depends heavily on app-layer checks
- some APIs expose account-state signals useful for enumeration
- staging/prod parity issue exists for membership cycle tables (`PGRST205`)

Overall posture: **medium risk**, with a few **high-priority hardening actions** required before scale.

---

## Evidence Snapshot

### Core auth/service usage
- Service-role client exists and is used in multiple flows: `src/lib/supabase/admin.ts`
- Auth context from claims and role lookup: `src/lib/auth/session.ts`
- SSR proxy session refresh + protected path redirect: `src/lib/supabase/proxy.ts`

### Sensitive/public APIs reviewed
- Membership status lookup (public): `src/app/api/membership-form/status/route.ts`
- Contact submit (public): `src/app/api/contact/submit/route.ts`
- Profile direct edit (step-up protected): `src/app/api/profile/direct/route.ts`
- Directory verification: `src/app/api/members/verify/route.ts`
- Workplace/profile request APIs: `src/app/api/alumni/workplace-updates/route.ts`, `src/app/api/profile/change-requests/route.ts`

### Migration/state indicators
- Core identity/RLS baseline: `supabase/migrations/20260408001000_identity_certificates_rls.sql`
- Super admin hierarchy migration: `supabase/migrations/20260409040000_super_admin_role_hierarchy.sql`
- Membership cycle migration file exists but reported missing in target environment (`PGRST205`): `20260409051000_membership_cycles_and_batches.sql`

---

## Findings (Risk-Rated)

## High

1. **Public endpoint enumeration surface (`/api/membership-form/status`)**  
   Endpoint reveals whether an application exists for an email. This enables targeted probing and status intelligence.

2. **Insufficient abuse controls on internet-facing POST endpoints**  
   Contact and status-check style endpoints lack robust rate limits/challenge controls, increasing spam and abuse risk.

3. **Operational schema drift risk (migration mismatch)**  
   Membership-cycle tables are expected by app logic but missing in at least one deployed environment (`PGRST205`), creating reliability failures.

## Medium

4. **Broad service-role dependence in request paths**  
   Several APIs rely on admin client + app-level user checks. Correct today, but high blast radius if logic regresses.

5. **Step-up and verification are cookie-based without stronger contextual binding**  
   Works functionally; could be hardened with additional anti-replay/session binding controls.

6. **User-visible raw error forwarding in some flows**  
   Some handlers pass upstream error details to clients, increasing information disclosure and social-engineering utility.

## Low

7. **Audit event actor fidelity inconsistency**  
   Some member-initiated writes log `actor_user_id: null` instead of authenticated user id, reducing forensic quality.

8. **Missing explicit standardized API security middleware**  
   Security checks are route-local; a shared middleware/policy layer would reduce drift and mistakes.

---

## Exploit/Failure Scenarios (Practical)

- Automated scripts enumerate real applicant emails/status states via status-check endpoint.
- Contact endpoint is abused for spam bursts (mail costs + reputation impact).
- Future code change accidentally weakens app-layer authorization where service-role client is used.
- Membership rollout operations fail mid-flow due to migration parity mismatch.

---

## Phase-by-Phase Remediation Plan

## Immediate Hotfix (0-48 hours)

1. Add edge/API rate limiting to:
   - `/api/contact/submit`
   - `/api/membership-form/status`
   - `/api/members/verify`
   - `/api/profile/step-up`
2. Normalize status-check responses to reduce enumeration signal.
3. Replace raw upstream errors with safe generic client messages + server-side structured logging.
4. Freeze release until migration parity check passes in target env.

### Verification Tests
- Burst tests return throttling behavior.
- Status endpoint response shape is uniform for found/not-found probing.
- Migration check script confirms required tables before deploy.

## Phase 1 (2 weeks)

1. Introduce shared API security wrapper (authz, rate limits, error policy).
2. Add CSRF/intent protections where cookie-authenticated POST endpoints are vulnerable.
3. Harden step-up/directory verification:
   - stronger expiry validation,
   - explicit invalidation on auth state changes,
   - optional binding hints (session/device fingerprinting policy).
4. Correct audit actor attribution for all member-originated writes.

### Verification Tests
- Route-level policy tests for authz and error contracts.
- Security unit tests for verification cookie lifecycle.
- Audit log integrity checks.

## Phase 2 (1 month)

1. Reduce service-role blast radius:
   - move more reads to RLS-safe client paths,
   - isolate privileged writes behind hardened internal service modules.
2. Add environment parity gate in CI/CD:
   - migration drift detection,
   - schema contract checks before rollout.
3. Add basic anomaly detection dashboards (failed auth, abusive endpoints, moderation spikes).

### Verification Tests
- CI fails on drift.
- Staging and prod schema checksum parity.
- Security regression checklist integrated in release pipeline.

## Phase 3 (hardening/monitoring)

1. Full threat-model pass on auth + role hierarchy + moderation operations.
2. Add periodic whitebox review and dependency/security audit cadence.
3. Add incident response runbooks for auth abuse and moderation compromise scenarios.

### Verification Tests
- Quarterly security drill with evidence artifacts.
- Time-to-detect and time-to-contain metrics tracked.

---

## Priority Backlog (Impact vs Effort)

- **High impact / low-medium effort**
  - rate limits + abuse controls
  - status-check anti-enumeration response hardening
  - safe error message policy

- **High impact / medium effort**
  - shared API security middleware
  - migration parity gate in CI/CD
  - service-role surface minimization

- **Medium impact / low effort**
  - actor_user_id consistency fixes
  - security logging normalization

---

## Final Recommendation

Do not treat this as a schema problem only; this is now an **application security governance** phase. Implement anti-abuse controls + parity gates immediately, then systematically reduce privileged path exposure.
