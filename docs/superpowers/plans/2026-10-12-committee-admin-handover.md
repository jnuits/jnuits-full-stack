# Committee handover integration — 12 October 2026

Integrate AGY branch ui/committee-layout at 0d2131f with current main f9f11a9, preserving the retired Joint Secretary constraint and all real member/committee records.

1. Verify AGY presentation, accessibility and interactive behavior against synthetic fixtures. Preserve its public styling. Correct functional integration defects with focused regressions.
2. Add nullable committee assignment speech with a 160-character database constraint. Authorize through existing committee-management permission and assurance guards. Allow quotes for President and General Secretary, provide accessible admin input/counter, and project only intentionally published quotes. Preserve internal assignment notes as private.
3. Verify all three advisor categories and requested editable attributes. Expose the existing saved advisor speech in the safe public projection. Add audited remove-from-board capability by archiving visibility/current status, preserving profile history and linked portal accounts; existing editing can restore visibility. Preserve valid zero display order and recompute changed tenure dates.
4. Run focused red/green and full required checks, isolated SQL replay/security assertions and browser coverage. Release only after all required non-Vercel checks pass. Apply reviewed forward SQL once using Supabase plugin, reconcile the assigned filename byte-identically, merge normally and verify actual production SHA and interactions. Preserve ignored execution evidence and owner files.

Pre-flight: assignment speech database -> generated types -> service selectors -> public projector -> existing AGY quote markup. Advisor saved speech -> public-safe advisor contract -> existing featured quote container. Advisor archive -> existing authorized admin actions -> public current/history filters.

Ruling: archive advisor records rather than delete identity/history or linked Auth accounts; this supplies board removal and reversible restoration without broadening authorization. Cost if wrong: the owner may later want an explicit permanent deletion policy.
Ruling: section headings remain presentation copy; the handover only suggests optional CMS headings, which are unnecessary for editing advisor records.
Ruling: execute this handover personally and preserve the existing ledgers/worktrees, following the user's instruction; no repeated independent whole-branch review.

Acceptance: quotes <=160, non-spokesperson quote requests denied, private/planned assignments excluded, internal notes never projected, permission denial precedes writes, advisor edits and archive are audited/revalidated, all requested advisor metadata editable, keyboard/actual themes/viewport and current/history behavior verified. Do not mutate real records for testing.
