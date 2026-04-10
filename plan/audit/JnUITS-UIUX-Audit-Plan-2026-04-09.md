# JnUITS UI/UX Audit + Phase Plan (Public Site, Member Portal, Admin)

Date: 2026-04-09  
Scope: `https://jnuits-full-stack.vercel.app`, `/portal`, `/admin`, plus whitebox review of `jnuits-full-stack` repository.

## Executive Summary

The platform foundation is strong (clear route architecture, branded system, role-separated surfaces), but UX maturity is still in a **transition state**:

- public experience still contains migration/legacy wording
- key forms rely on placeholders instead of explicit labels
- admin workflows are powerful but cognitively heavy (single long control surface)
- member portal is safe but not yet optimized for retention, confidence, and progressive onboarding

Recommended direction: **stabilize conversion and accessibility first**, then ship workflow depth.

---

## Evidence Highlights (Code + Live)

- Public site is live and content-rich: `src/app/(public)/page.tsx`
- `/portal` and `/admin` correctly redirect to login: live probe confirmed
- Portal and admin shells are role-separated:
  - `src/components/portal/portal-shell.tsx`
  - `src/components/admin/admin-shell.tsx`
- Public members directory is implemented with search/filter/pagination:
  - `src/app/(public)/members/page.tsx`
  - `src/lib/members/directory.ts`
- Public membership intake is intentionally closed and status-check-only:
  - `src/app/(public)/membership-form/page.tsx`
  - `src/app/api/membership-form/route.ts`

---

## Current UX Findings (Severity)

## High

1. **Public messaging inconsistency (trust + conversion friction)**  
   Multiple pages still communicate migration-era language (legacy/transition tone) rather than polished institutional messaging.

2. **Form accessibility debt**  
   Many auth/contact/member-facing forms use placeholders without persistent labels, which hurts usability, screen reader flow, and error recovery.

3. **Admin cognitive overload**  
   Main admin page is feature-rich but dense; too many high-impact operations in one continuous scroll surface.

## Medium

4. **Portal onboarding lacks progressive guidance**  
   New users are authenticated but not always clearly guided through first-run critical sequence (verify -> profile -> privacy controls -> activity).

5. **Action hierarchy inconsistency**  
   Some pages use many same-weight CTAs; prioritization between primary/secondary actions can be clearer.

6. **System-state communication can be improved**  
   Empty/locked states are present, but not uniformly instructional (next best action is not always explicit).

## Low

7. **Navigation ergonomics on small screens**  
   Horizontal nav works, but discoverability and deep-route orientation can be improved.

8. **Microcopy consistency**  
   Voice/tone varies between institutional, operational, and technical language.

---

## Phase-by-Phase UI/UX Development Plan

## Quick Wins (0-2 weeks)

- Replace migration/legacy phrasing across public pages with user-facing institutional copy.
- Add explicit form labels (keep placeholders optional helper text only).
- Standardize CTA hierarchy: one primary action per panel.
- Add consistent empty/locked/error state templates with “what to do next”.
- Add success feedback consistency for all portal/admin mutations.

### Acceptance Criteria
- All major forms pass manual keyboard-only completion.
- Public pages contain no migration-language artifacts.
- Every empty/locked panel includes a concrete next step link.

## Phase 1 (2-6 weeks)

- Build a compact design-system layer (tokens + component states + validation states).
- Introduce dashboard summaries:
  - Portal: “Your next 3 actions”
  - Admin: queue triage + risk overview cards
- Add role-aware quick actions and saved filters in admin.
- Improve mobile navigation: section chips + contextual breadcrumbs.

### Acceptance Criteria
- Reusable input/form/button/card patterns in all three surfaces.
- Admin median “review to decision” interaction reduced (fewer clicks/scroll).
- Lighthouse accessibility score trend improved on core pages.

## Phase 2 (2-3 months)

- Introduce workflow-focused UX:
  - Admin split views for applications/invitations/moderation
  - Portal guided profile completion funnel
- Add user-facing activity feed with meaningful event wording.
- Improve content discoverability (search/sort faceting for notices/events/blogs).
- Add strong “trust blocks” (governance, data handling, verification policy).

### Acceptance Criteria
- Operator tasks complete in structured workflows vs long-scroll page scanning.
- Portal completion funnel measurable (profile completeness + verification completion).
- Public discoverability metrics improve (content route depth, time-on-page).

## Phase 3 (Scale)

- Multi-language readiness
- Advanced personalization in portal
- Accessibility hardening to WCAG AA+ patterns
- UX analytics loop (behavior-informed iteration cadence)

### Acceptance Criteria
- UX review cadence with monthly scorecard.
- Regression checklist for accessibility + responsive + microcopy consistency.

---

## Component-Level Recommendations

- **Forms**: always pair `<label>` with field; reserve placeholder for examples.
- **Status surfaces**: unified success/warning/error blocks with retry/action link.
- **Admin queues**: convert to tabbed workflows + sticky decision rail.
- **Portal profile/edit**: persist section completion indicators.
- **Public hero + notices/events**: enforce editorial style + metadata consistency.

---

## Suggested Ownership

- Product/UX Lead: IA, copy system, component standards
- Frontend Engineer: implementation + responsive/accessibility
- Ops/Admin Stakeholder: queue workflow tuning and approval ergonomics
- QA: keyboard/screen-reader/regression audit

---

## Final Recommendation

Prioritize **clarity + accessibility + workflow simplification** before adding visual complexity. The architecture is already good enough to scale; the highest ROI now is reducing user/operator friction and improving confidence in every critical flow.
