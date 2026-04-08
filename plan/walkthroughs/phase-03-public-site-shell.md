# Phase 03: Public Site Shell

## Goal

Reach shell-level parity for the public-facing website so the unified app can replace the old frontend entry points safely.

## Implementation checklist

- Finalize global header, footer, and responsive navigation.
- Port homepage singleton content shape.
- Port contact, developer, and core marketing routes.
- Add metadata, sitemap, robots, and manifest coverage.

## Verification checklist

- Review desktop and mobile layout behavior.
- Confirm nav coverage for all required public routes.
- Confirm contact flow redirects and errors render correctly.

## Test data or fixture needs

- Approved copy/content for homepage, footer, and developer sections

## Acceptance gate

The public shell is coherent, responsive, and no longer needs the legacy frontend for global navigation or contact entry points.

## Rollback or recovery notes

If public parity slips, keep the content models but hide incomplete routes behind temporary messaging until the shell is corrected.
