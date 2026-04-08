# Phase 07: Admin Ops and Committee Management

## Goal

Replace the old operator-only workflows with technical but task-first admin queues in the unified app.

## Implementation checklist

- Build invitation management, replacement/revoke controls, and audit views.
- Build the first operator queue for membership application review and invitation generation.
- Build moderation queues for profile/workplace updates.
- Port committee, tenure, and role-assignment workflows.
- Add operator reporting snapshots and reconciliation visibility inside `/admin/reports`.
- Port CSV onboarding and reconciliation scripts with dry-run/apply reporting and archived JSON evidence.
- Add audit exploration for sensitive operations.

## Verification checklist

- Confirm invitations can be created, revoked, and traced.
- Confirm moderation actions create audit events.
- Confirm committee assignments and tenure records can be created, reviewed, and reconciled.
- Confirm operator snapshot reports can be generated and stored.
- Confirm CSV onboarding/reconcile scripts emit archived reports.
- Confirm the admin workspace remains usable on phone-sized screens for at least core queue review.

## Test data or fixture needs

- Seeded admin and moderator accounts
- Sample committee/tenure data
- Legacy CSV datasets for onboarding and reconciliation

## Acceptance gate

Technical operators can complete committee, moderation, reporting, and migration tasks entirely within the new stack or its repo-managed scripts.

## Rollback or recovery notes

Keep dry-run reports mandatory before any destructive or high-volume operator action.
