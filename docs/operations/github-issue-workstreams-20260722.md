# GitHub issue workstreams — 2026-07-22

This is the ownership contract for the 49 open audit issues. An issue appears in exactly one group.

## Group A — project lead (20)

Issues: `#15`, `#16`, `#17`, `#18`, `#19`, `#26`, `#31`, `#39`, `#40`, `#42`, `#46`, `#47`, `#48`, `#49`, `#50`, `#51`, `#57`, `#58`, `#59`, `#60`.

The lead owns CI workflows, repository scripts, operational documentation, environment validation, security headers/proxy/error policy, Sentry configuration, generated database artifacts, migration replay/parity, live Supabase migration control, `src/lib/admin/api-auth*`, retention operations, and profile deletion/request paths.

## Group B — feature agent (29)

Issues: `#12`, `#13`, `#14`, `#20`, `#21`, `#22`, `#23`, `#24`, `#25`, `#27`, `#28`, `#29`, `#30`, `#32`, `#33`, `#34`, `#35`, `#36`, `#37`, `#38`, `#41`, `#43`, `#44`, `#45`, `#52`, `#53`, `#54`, `#55`, `#56`.

The feature agent owns feature UI/API/core modules plus new component, integration, and browser tests. It may author forward-only migration files, but does not apply them or modify migration replay/parity and generated database artifacts. It must add a separate portal E2E specification rather than edit `e2e/authenticated-workflows.spec.ts`.

## Branch and merge rules

- Group A works on `codex/forms-launch`.
- Group B works on `codex/agent-b-forms-safety` in its isolated worktree.
- Group B must not edit Group A-owned paths.
- Each issue or tightly coupled pair receives a focused commit with targeted tests.
- Migrations remain local until project-lead review, migration parity checks, Supabase advisors, and explicit approval for live application.
- Merge Group A prerequisites first; then rebase or merge Group B and resolve only expected dependency edges.

## Current triage notes

- `#36` appears implemented and needs closure evidence rather than new behavior.
- `#20`, `#24`, `#32`, `#33`, `#34`, and `#35` were partially implemented when triaged.
- `#26`, `#42`, and `#46` already had active lead-side work.
- No exact duplicate issues were found.
