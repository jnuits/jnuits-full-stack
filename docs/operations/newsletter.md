# Newsletter operations and owner acceptance

Implementation uses a separate double opt-in lifecycle. Membership, Auth and admin verification tokens cannot authorize newsletter confirmation. GET /newsletter/confirm only displays the explicit confirmation action; only its same-origin POST can confirm. Tokens are random 32-byte values, stored as SHA-256 hashes, expire after 24 hours and are never logged. The database serializes resend and synchronization attempts; delivery alone never activates a subscriber.

## Owner configuration before release

In Resend, create a dedicated newsletter Segment and a public Topic whose default subscription is opt-out. Obtain a separate server-only API key with the required Email, Contacts, Suppressions, Segments and Topics access. Set RESEND_NEWSLETTER_API_KEY, RESEND_NEWSLETTER_SEGMENT_ID and RESEND_NEWSLETTER_TOPIC_ID in the application environment through the provider's private settings. UUID identifiers are required. Keep existing RESEND_API_KEY and transactional sending configuration unchanged. The confirmation sender uses the existing verified RESEND_FROM_EMAIL and reply address.

Confirm APP_BASE_URL is the intended HTTPS origin, the existing production Turnstile site/secret configuration is valid, and RATE_LIMIT_SECRET_SALT enables the existing durable limiter. Configure the existing signed Resend webhook for delivery, failed, bounced and complained events. Retain its existing signing secret; this release adds a fourth isolated delivery ledger without replacing membership/event/invitation ledgers. Never place keys or consenting mailbox addresses in this document or public evidence.

The reviewed forward migrations were applied once before the application release: audit_content_query_summaries (`20261005054954`), audit_newsletter_double_opt_in (`20261005055016`), and the delivery-event index (`20261005055358`). Their SQL receipts are recorded in [the migration receipt file](2026-10-05-audit-migration-receipts.json). Do not apply them again when configuring delivery. Keep nullable provider identifiers out of frontend configuration. Missing provider configuration returns a generic unavailable state and cannot activate a subscription.

## Provider behavior and limits

Subscription requires explicit consent, server validation, CAPTCHA and same-origin metadata. IP limits are 10 subscription requests/hour and 60 confirmation requests/hour, with separate durable namespaces. Confirmation request JSON is capped at 16 KiB. Email limits serialize at 60 seconds between sends and three attempts/hour. Existing subscriber, suppressed address, duplicate and cooldown requests receive the same generic 202; IP denials use 429 and Retry-After.

The provider is checked for bounce/complaint/manual suppression and global unsubscribe before sending or synchronizing. Existing suppressed/unsubscribed contacts are never reactivated. After explicit confirmation, synchronization validates the configured public opt-out Topic and Segment, creates a contact only when absent, opts that confirmed address into the Topic and adds it to the Segment. Partial failure remains pending and is retried by the same explicit confirmation action. Completed confirmation is idempotent; replay never re-subscribes an unsubscribed contact. Signed bounce/complaint events persist suppression and override concurrent activation. No campaign or automatic digest is implemented.

Create broadcasts in Resend's dashboard, target both the dedicated newsletter Segment and Topic, and include Resend's {{{RESEND_UNSUBSCRIBE_URL}}} preference/unsubscribe link in every broadcast. Review audience/topic targeting before sending. Local subscriber state is not permission to override Resend global suppression. Sending confirmation emails also uses the dedicated newsletter key, not the transactional key.

## Owner-performed live acceptance

Use your own consenting mailbox after provider configuration and the actual production revision are verified. Submit unchecked-to-explicit consent through the real CAPTCHA. Record sanitized timestamps and visible outcomes: generic accepted response; one delivered confirmation; GET does not activate; explicit POST confirms; repeat confirmation is successful without duplicate provider writes; contact is in the chosen Segment and explicitly opted into the Topic. Also exercise Resend preferences/unsubscribe and confirm a repeated request never silently restores global unsubscribe. Do not test bounce/complaint by harming a real mailbox; use provider-supported disposable fixtures.

Capture only sanitized outcome evidence. Do not publish the address, message body with a token, URL query string, provider contact identifiers or credentials. Local transport mocks and rollback SQL are automated behavior evidence, not proof of real delivery, CAPTCHA or owner consent. Until these checks are performed, live newsletter acceptance remains OPEN.

## Recovery and inspection

Private subscription, hashed-token and delivery-event tables have RLS and no direct browser/service grants. The single empty-search-path SECURITY DEFINER newsletter_store RPC is service-only and additionally checks the invoking database role. Application routes never accept an actor or subscriber identifier. Use approved service tooling for sanitized aggregate state only; do not expose email lists or confirmation hashes. A provider outage is retryable through the existing confirmation action while the unconsumed token remains valid. A 120-second synchronization lease prevents simultaneous enrollment; expiry permits a safe idempotent retry after a terminated worker. Never manually mark a subscription active to repair delivery.

See [Resend Contacts](https://resend.com/docs/dashboard/contacts/manage-contacts), [Topics](https://resend.com/docs/dashboard/topics/introduction) and [Suppressions](https://resend.com/docs/api-reference/suppressions/get-suppression). Database backup coverage and retention are documented separately.
