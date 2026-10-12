# Joint Secretary retirement — 12 October 2026

The owner confirmed that JnUITS has no Joint Secretary position and requested its complete removal. Production inspection found one unused catalog role, one empty 7th EC position, and an obsolete alias on Assistant General Secretary. No current or historical appointment referenced the retired role.

The forward migration removes that role and seat, cleans the alias, and adds a catalog constraint preventing recreation by code, title or alias. It aborts before cleanup if any appointment references the retired role. Removed configuration is retained in the audit log. No member, appointment, valid position, authorization policy or application code is changed. Historical migration SQL remains sealed and unchanged.

## Hosted receipt

- Project: `fsirdkjgrcocowxqjhjg`.
- Applied once through the Supabase plugin: `20261012023028_retire_joint_secretary_role`.
- Original CLI-generated local version: `20261012021405`. Only the new filename was reconciled to the provider-assigned version; SQL bytes did not change.
- SQL: 3,476 bytes; SHA-256 `62ed564a669fb3d871fedff10b3da64a85d9b0876e9717c3719a54ea27917ff4`; MD5 `04251da1740d5e6e6be3bef40fb1964a`.
- Hosted receipt contains one statement-array entry and matches both digests and byte length. There are now 118 hosted migrations. Do not apply this migration again.

## Verification

- The retired role, alias and position label are absent; the catalog constraint is validated.
- Every member and appointment fingerprint is unchanged. Other role metadata and every valid term-position fingerprint are unchanged. Assistant General Secretary retains its valid settings.
- All 17 current appointments remain; the 7th EC configured target is now 21 instead of 22. Existing owner-configured seats were preserved.
- No public-table RLS was disabled; no grants or Auth roles changed.
- Disposable Postgres regression first failed on the legacy role and then passed after cleanup. Five invalid code/title/alias writes were rejected; a legitimate new role was accepted and rolled back. A referenced-role fixture caused the migration to abort, preserving all roles, positions, appointments and audit state.
- Initial exact-SQL Quality Gate `38195402191` and Diff Check `38195402195` passed, including clean replay, migration runtime/integrity/order, unit tests, build, secret scan and 159 release browser tests across Chromium, Firefox and WebKit. Final checks also run after filename reconciliation before merging PR #178.
- Production `/committee` and `/committee/7th-executive-committee` returned HTTP 200 with Assistant General Secretary and both newly onboarded members present. The retired role is absent. Responses remain private/no-store and Cloudflare reports `DYNAMIC`.

The production application already reads current Supabase configuration. Refresh `/admin/committee` to discard any previously rendered client state; this database correction does not require a Vercel rebuild. Previous audit acceptance/configuration work, source spreadsheets, private access files, original worktrees and the backup branch remain preserved.
