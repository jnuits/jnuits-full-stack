# Phase 05: Membership Transition

## Goal

Retire open public intake while preserving legacy application status checks and invitation-first onboarding.

## Implementation checklist

- Disable new public membership submissions (`POST /api/membership-form` returns closed policy).
- Keep legacy status-check workflow live for previously submitted applications.
- Build the admin review queue that converts pending applications into approved members plus invitations.
- Keep invitation-based claim as the preferred member activation path.
- Preserve the directory verification gate for sensitive workplace data.
- Add member and alumni directory read paths based on safe projections with search/filter/pagination.

## Verification checklist

- Confirm public intake POST is disabled with a controlled closed-policy response.
- Confirm legacy status checks still return expected pending/approved/rejected values.
- Confirm claim flow consumes a valid invitation and links the member.
- Confirm directory verification cookies are scoped to the authenticated member.

## Test data or fixture needs

- One historical membership application row for status checking
- One valid invitation row and one expired invitation row
- One member with a verification code hash

## Acceptance gate

Invitation/claim onboarding is the only active intake path, while legacy status checks remain available and auditable.

## Rollback or recovery notes

If invitation logic misbehaves, pause invitation generation and keep claim/status support visible while operators repair onboarding.
