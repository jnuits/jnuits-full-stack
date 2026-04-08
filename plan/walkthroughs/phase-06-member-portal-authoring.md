# Phase 06: Member Portal and Authoring

## Goal

Deliver a safe non-technical portal for claimed members, including profile flows, workplace requests, timeline access, and limited blog drafting.

## Implementation checklist

- Build claimed-member profile and profile-edit surfaces.
- Keep direct sensitive mutations disabled until step-up verification is complete.
- Add password-change continuity inside the portal with reauthentication support.
- Expose workplace request history and submission for alumni.
- Add committee/general-member blog drafting in the portal, not `/admin`.

## Verification checklist

- Confirm claimed users can access the portal.
- Confirm non-claimed users are redirected out.
- Confirm workplace requests are created and visible to the owner.
- Confirm timeline data is returned only for the linked member.

## Test data or fixture needs

- Claimed current member account
- Claimed alumni member account
- Sample lifecycle events and workplace requests

## Acceptance gate

Non-technical members can complete core self-service flows without touching the technical admin workspace.

## Rollback or recovery notes

If step-up verification is incomplete, keep sensitive edits disabled rather than silently downgrading the security requirement.
