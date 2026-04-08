# Phase 05: Membership Transition

## Goal

Run the old public membership intake and the new invitation/claim model side by side until operators are ready to retire the temporary intake path.

## Implementation checklist

- Build the public membership application form and status-check workflow.
- Build the admin review queue that converts pending applications into approved members plus invitations.
- Keep invitation-based claim as the preferred member activation path.
- Preserve the directory verification gate for sensitive workplace data.
- Add member and alumni directory read paths based on safe projections.

## Verification checklist

- Confirm public application inserts succeed and can be reviewed, approved, or rejected by operators.
- Confirm claim flow consumes a valid invitation and links the member.
- Confirm directory verification cookies are scoped to the authenticated member.

## Test data or fixture needs

- One pending membership application
- One valid invitation row and one expired invitation row
- One member with a verification code hash

## Acceptance gate

Both onboarding paths are operational, documented, and auditable, with a clear retirement plan for public intake.

## Rollback or recovery notes

If invitation logic misbehaves, pause new invitations and continue accepting public applications while the claim flow is corrected.
