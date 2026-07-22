# GitHub Actions setup

## Required pull-request check

Protect `main` and require:

- `Quality Gate / Required CI`
- Vercel deployment check
- Branch up to date before merge
- Pull request approval before merge

`Required CI` aggregates lint, typecheck, admin audits, dependency audit, unit/integration tests, migration-contract tests, production build, Chromium smoke, credential guard, and secret scan.

## Repository or environment secrets

Never store these values in workflow YAML.

Common database automation:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

Pre-production authenticated E2E:

- `E2E_ALUMNI_MEMBER_EMAIL`
- `E2E_ALUMNI_MEMBER_PASSWORD`
- `E2E_CONTENT_ADMIN_EMAIL`
- `E2E_CONTENT_ADMIN_PASSWORD`
- `E2E_CURRENT_MEMBER_EMAIL`
- `E2E_CURRENT_MEMBER_PASSWORD`
- `E2E_NORMAL_ADMIN_EMAIL`
- `E2E_NORMAL_ADMIN_PASSWORD`

Production environment:

- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `RATE_LIMIT_SECRET_SALT`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `RETENTION_MANIFEST_SIGNING_SECRET`
- `SUPABASE_SECRET_KEY`
- `TURNSTILE_SECRET_KEY`

Secret scanning:

- `GITLEAKS_LICENSE` when required for this private organization repository

## GitHub environment variables

Pre-production:

- `PREPRODUCTION_APP_URL`
- `PREPRODUCTION_SUPABASE_PROJECT_REF`

Production:

- `APP_BASE_URL`
- `AUTH_CAPTCHA_REQUIRED` set to `true`
- `CLOUDINARY_CLOUD_NAME`
- `GOOGLE_DRIVE_EXPORTS_FOLDER_ID`
- `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_DRIVE_SHARED_DRIVE_ID`
- `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `PRODUCTION_APP_URL`
- `RATE_LIMIT_BACKEND` set to `supabase`
- `RESEND_FROM_EMAIL`
- `SUPABASE_PROJECT_REF`

Use protected `preproduction` and `production` GitHub environments. Keep authenticated tests manual/trusted-branch only. Never expose protected secrets to fork pull requests.
