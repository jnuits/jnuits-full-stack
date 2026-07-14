# Pre-production authenticated-browser fixtures

Credential-backed browser verification is permitted only against the isolated
pre-production Supabase project. It must never target production, a preview
that shares production data, or a developer's local account.

## Required setup

1. Create a separate pre-production project and record its project reference
   in the protected CI/environment store.
2. Create fresh, pre-production-only fixture identities for super admin,
   normal admin, content admin, current member, alumni, and the dedicated
   member-linked-admin candidate. Do not reuse any historical fixture password
   or MFA seed.
3. Enrol a verified TOTP factor for the super-admin and member-linked-admin
   candidates. Store every password, MFA seed, test-inbox token, and
   server-only fixture credential only in the protected store.
4. Keep CAPTCHA enabled in pre-production using the provider's approved test
   configuration. A production CAPTCHA bypass is not an acceptable test setup.

The old manual RBAC test-user reset script was retired because fixture
credential material must not be committed to source control. Its former values
must be treated as compromised and rotated before the environment is used.

## Required protected inputs

The authenticated E2E job may read only protected variables for fixture email
addresses, passwords, TOTP seeds, the expected pre-production project
reference, a safe-inbox token, and the server-only fixture runner credential.
Do not put these values in `.env` files, repository scripts, CI logs,
Playwright traces, screenshots, videos, or HTML-email artifacts.

## Fixture-runner contract

Before credential-backed E2E is enabled, implement a server-only runner with
all of the following controls:

- Refuse any target except an explicitly allowlisted pre-production base URL
  and the expected project reference.
- Require `E2E_TARGET=preprod` and a pre-production marker before a reset.
- Run serially with a fixture lock and return only booleans or counts, never
  identities, URLs, tokens, or rows.
- Reset only the dedicated linked-admin candidate: revoke its scoped test
  grants, expire its old test invitations, and detach its member claim while
  preserving the verified test MFA factor.
- Run only from trusted branches or manual dispatch; fork pull requests must
  never receive the protected inputs.

The browser journey must prove real member claim, invitation acceptance, MFA
completion, permitted content-admin access, and denial of a restricted route.
It also needs a safe inbox for the two expected messages and must reserve that
quota in the serial run.

## Operational guardrails

- Rotate or recreate every fixture after an exposure, then invalidate the old
  pre-production accounts and factors through an approved operator action.
- Never run a fixture reset against production.
- Disable or redact artifacts for flows containing invitation links or bearer
  tokens.
- Keep authenticated E2E disabled until the isolation guard and fixture runner
  above are implemented and the pre-production environment is approved.

See [authenticated browser smoke checks](authenticated-browser-smoke.md) for
the role-routing checks that can run once this setup is available.
