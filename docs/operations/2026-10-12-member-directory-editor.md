# Member directory defaults and profile editor

The owner approved public-by-default member/alumni profiles and a responsive editor on 12 October 2026.

## Directory privacy

New profiles default to `professional_visibility = public`. Invitation creation, bulk creation and the operator import agree with the database default. Explicit `private` and `members-only` choices remain supported. Importing an existing profile without a visibility field preserves its current choice. Ordinary profile edits never reset visibility.

The owner also authorized one-time publication of existing active current/alumni profiles: 19 profiles were public after the operation. Three deleted/deactivated records remain hidden. This operation is not a recurring sync or a migration that resets future opt-outs.

The public projection still excludes login email, phone, university student ID, Auth identifiers and other private administration fields. RLS on the underlying members table permits only the owner or authorized membership administrators. Directory visibility does not grant public database access or reactivate departed accounts.

## Committee office and membership

Public cards retain Member/Alumni classification and separately show active appointments from the explicitly current, public executive committee. The admin table shows committee office alongside the member identity while retaining the distinct Portal role column. Historical, planned, resigned or unpublished appointments do not become current-office badges. Labels do not grant or change authorization roles.

## Editing

Selecting Edit opens a native modal side panel on desktop/tablet and a full-screen editor on phones. Keyboard focus stays inside, Close/Escape return focus to the opener, and background scrolling is locked. Unsaved changes require explicit discard; saves block closing while pending. Saving profile fields preserves a separate account/lifecycle draft. Operational saves remain open so another unsaved section cannot be discarded accidentally. Existing server authorization, audit and verification requirements remain unchanged.

## Authorized test-account removal

Only `JnUITS-2015999` and `JnUITS-0000001` were removed, including their dedicated Auth identities, sessions, refresh tokens, portal grants and cascading invitations/profile requests. Each had exactly one linked non-admin profile, no owned Storage objects and no committee/content/event/support/renewal associations. The real `JnUITS-2023001` profile was verified intact.

The first attempted transaction rolled back because cascading role deletion tried to recreate a claim-version row after Auth deletion. Removing the targets' own portal grants before deleting Auth within the same guarded transaction completed cleanup. Existing audit history retains its normal null references after identity deletion. No other member's role or business record was changed.

## Release verification

Use the clean replay assertion `assert-member-directory-visibility.sql` for default publication and persistent explicit opt-outs. Run focused editor/title tests, full quality gates and the disposable profile browser runner for actual mobile/tablet/desktop light/dark behavior. Do not submit real profile changes or use production fixtures for acceptance.

The required Build and browser smoke job also runs the authenticated editor against isolated local Supabase in Chromium, Firefox and WebKit. It checks 375/768/1280px in both themes, keyboard wrapping and focus restoration, pending-save closing protection, a real synthetic profile save, and preservation/discard of a separate lifecycle draft. Its published screenshots contain only fictional profiles; traces and automatic screenshots remain disabled. To run the same suite locally: `PROFILE_SELF_SERVICE_QA=DISPOSABLE_SCRATCH MEMBER_EDITOR_QA=DISPOSABLE_SCRATCH node supabase/verification/run-admin-verification-browser-qa.mjs`. Optional `MEMBER_EDITOR_QA_PROJECT` accepts only chromium, firefox or webkit for local diagnosis; CI omits it to require all three.

Hosted receipt: migration `20261012164801_member_directory_public_default`, 120 migrations total. The plugin assigned its timestamp; the local filename was reconciled from `20261012161003` without changing SQL bytes. SHA-256: `e7b52032d7f8ec98ce45381a9cd1c340f40032c543ff96410b716a0f6057d1d8`. The committed SQL retains its original bytes. The hosted receipt matches the reviewed statements after transport line-ending normalization; its LF-normalized SQL SHA-256 is recorded in the local execution ledger. Version/name parity alone is not proof of deployed content. Verified post-change default: public; active public profiles: 19; deleted members-only profiles: 3.
