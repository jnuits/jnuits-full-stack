# Admin activity source catalog

Release 2 starts at an explicit deployment cutover. Existing public.audit_events rows remain available in the legacy explorer; they cannot establish admin attendance or completed work. The public table permits browser-origin inserts in legacy policy, so only a new trusted service receipt or a committed governed RPC qualifies.

| Boundary | Canonical evidence | Meaning |
| --- | --- | --- |
| Admin-destined password sign-in | Native successful sign-in and current eligible admin role, exact native session | Admin sign-in, not workspace entry or work |
| Verified workspace HTML render | Live actor/session, current lifecycle and applicable assurance, prefetch excluded | First entry per native session; access at most once per admin/UTC day; no attention claim |
| Native Auth event import | Provider audit row ID and verified identity interval at event time | Original provider action; refresh/recheck never completed work |
| Admin profile/account invitations | Committed admin profile/invitation/role operation receipt | Change outcome, recipient-only notices in Release 3 |
| Membership profile/review/invitation | Committed database operation receipt or post-success service audit insert | Completed mutation only for catalogued actions |
| Content/event/gallery/project/media | Post-success service audit insert | Original successful mutation; signing/export/download are access events, not completed work |
| Native MFA / operation verification | Existing private admin_verification_audit | Verification is not completion; preserve existing store/retention |
| Denied/failed/cancelled action | Explicit denied/failed receipt only | Never inferred as success from button clicks or intended action |

Instrumentation inventory: src/app/admin/{admin-profiles,committee,content,invitations,membership,reports}, src/app/api/admin/{cloudinary,events,forms,gallery}, src/lib/{admin/workplace,content/media-assets}, governed SQL RPCs and native Auth. Dynamic action labels must be explicitly catalogued; unrecognized labels stay outcome unknown and do not increment work.

Application receipts deliberately omit metadata/request bodies. Server context stores only validated edge-observed IP and coarse client-reported browser/OS/device; visitor IP/country remain unavailable where the free ingress cannot prove them. Full network details require both existing audit and security permissions.

Native user_updated_password is the sole application password-notice source. Login/recheck/refresh events are not interchangeable. No auth-table triggers or browser access to auth/private tables are introduced.

Routine membership reviews use their committed request ID, and renewals use their committed renewal ID, inside the existing private transition transaction. `already_reviewed` and `already_confirmed` do not add work or advance its timestamp. Renewal verification attempts still complete under their original proof rules. Other governed operations use their exact attempt ID: `admin.role.change/invite/remove`, `admin.lifecycle.freeze/unfreeze`, `admin.invitation.revoke`, security updates and retention archive/approve/purge. Invitation creation resolves its target from the committed authorization/invitation relation. Revocation resolves the existing invitation target. Acceptance has no initiating admin proof: its existing private native-session committing helper emits `invitation:<UUID>:accepted`, once, with the affected user as target and no duty-work increment. A forged browser legacy audit row cannot produce this receipt.

Reviewed service-authored post-success action catalog:

| Writer | Completed-mutation families |
| --- | --- |
| `src/app/admin/admin-profiles/actions.ts` | `admin_profile.updated` |
| `src/app/admin/committee/actions.ts` | Term create/update/current/rollover; term-position create/update; assignment create/update/remove/bulk; advisor create/update/archive/auth-link; executive/sub-executive/advisor imports |
| `src/app/admin/content/actions.ts` | Page save; post create/update; member-blog publish/change-request; developer-profile create/update; project create/update/delete |
| `src/app/admin/content/{events,gallery,notices}/actions.ts` | Event create/update/delete; album create/update/item-update/reorder; notice create/update/delete/publish/archive |
| `src/app/api/admin/gallery/**` | Album create and uploaded-item commit |
| `src/app/admin/invitations/actions.ts` | Direct issue; batch create/issue/sync/status; revoke/reissue/bulk-revoke; member-for-invite and CSV commit |
| `src/app/admin/membership/**` | Portal-role update; application reject; member invitation generation/revocation; profile and identity-review outcomes |
| `src/lib/admin/workplace.ts` | Committed direct corrections and bulk review receipts |
| `src/lib/content/media-assets.ts` | Create/update/trash/restore, after successful mutation |

Known access/maintenance receipts (`content.cloudinary_upload_signature_issued`, `event.registrations_exported`, `form.submissions_exported`, `form.upload_downloaded`, `operator.report_generated`, `observability.sentry_verification_triggered`, `event.registration_notice_resent`) retain their successful source outcome without increasing completed duty work. A notice resend records the accepted attempt, not confirmed mailbox delivery. Unknown/dynamic labels remain `unknown`, contribute no completed work and remain visible with their provenance; adding a new writer requires classification, not a blanket success rule. Denied/cancelled attempts without an explicit receipt do not become synthetic failed/successful rows. This catalog is a bounded count of verified receipts, not an exhaustive productivity metric or online-presence claim.

Retention refinement approved by the owner on 2026-10-15: important admin/security projections at least three calendar months; routine other native Auth events30days. Existing longer application/verification history stays intact. Native raw-source cleanup remains disabled until provider permissions/support, collection receipts and a production dry-run establish that important records are retained. No paid log service or AI schedule is required.
