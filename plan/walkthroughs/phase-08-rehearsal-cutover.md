# Phase 08: Rehearsal and Cutover

## Goal

Prove that the unified app can replace the old stack without data loss, workflow regression, or unacceptable public-site drift.

## Implementation checklist

- Run full staging rehearsal from fresh migration state.
- Generate parity reports for certificates, content, and member data.
- Capture screenshots for critical public, portal, and admin flows.
- Run rollback drill and cutover checklist.

## Verification checklist

- Confirm local build and Vercel preview deploy both pass.
- Confirm smoke tests for public routes, auth, portal, and admin.
- Confirm rollback instructions are executable and tested.

## Test data or fixture needs

- Rehearsal datasets from legacy systems
- Approved smoke-test checklist

## Acceptance gate

The project owner signs off on parity, rollback readiness, and production cutover timing.

## Rollback or recovery notes

Do not cut over until rollback has been rehearsed with the same migration and deployment assets intended for production.
