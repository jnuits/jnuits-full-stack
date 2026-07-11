# Authenticated Browser Smoke

The credential-driven browser checks are intentionally opt-in. They never contain test credentials in source control and are skipped by default in CI.

1. Use non-production or explicitly approved test accounts only.
2. Set `E2E_AUTH_SMOKE=1` plus the following environment variables for the roles you want to exercise:
   - `E2E_NORMAL_ADMIN_EMAIL`, `E2E_NORMAL_ADMIN_PASSWORD`
   - `E2E_CONTENT_ADMIN_EMAIL`, `E2E_CONTENT_ADMIN_PASSWORD`
   - `E2E_CURRENT_MEMBER_EMAIL`, `E2E_CURRENT_MEMBER_PASSWORD`
   - `E2E_ALUMNI_MEMBER_EMAIL`, `E2E_ALUMNI_MEMBER_PASSWORD`
3. If the local app and Supabase Auth CAPTCHA protection are temporarily disabled together for QA, run:

```powershell
npm run test:e2e:auth
```

The suite verifies the expected dashboard destination and a representative set of protected routes for normal admin, content admin, current member, and alumni member. It also checks that these pages do not display a runtime error or page-level horizontal overflow.

Do not run it against production with credentials until CAPTCHA has been re-enabled and an approved browser challenge strategy exists.