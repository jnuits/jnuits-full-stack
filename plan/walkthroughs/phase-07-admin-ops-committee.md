# Phase 07: Admin Ops and Committee Management

## Goal

Replace the old operator-only workflows with technical but task-first admin queues in the unified app.

## Implementation checklist

- Build invitation management, resend, and audit views.
- Build the first operator queue for membership application review and invitation generation.
- Build moderation queues for profile/workplace updates.
- Port committee, tenure, and role-assignment workflows.
- Port CSV onboarding and reconciliation scripts with dry-run/apply reporting.
- Add audit exploration for sensitive operations.

## Verification checklist

- Confirm invitations can be created, revoked, and traced.
- Confirm moderation actions create audit events.
- Confirm committee assignments and tenure records can be reconciled.
- Confirm CSV onboarding/reconcile scripts emit archived reports.

## Test data or fixture needs

- Seeded admin and moderator accounts
- Sample committee/tenure data
- Legacy CSV datasets for onboarding and reconciliation

## Acceptance gate

Technical operators can complete migration and operational tasks entirely within the new stack or its repo-managed scripts.

## Rollback or recovery notes

Keep dry-run reports mandatory before any destructive or high-volume operator action.
