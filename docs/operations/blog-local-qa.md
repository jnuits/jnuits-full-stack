# Blog UI Local QA

Use this only for local authenticated screenshots and interaction testing. It does not bypass RBAC, does not create privileged cookies, and does not change the production CAPTCHA rule.

1. In the local QA environment, set `AUTH_CAPTCHA_REQUIRED=false`.
2. Keep `VERCEL_ENV` unset or set to a non-production value such as `preview`.
3. Ensure the configured Supabase Auth project has CAPTCHA disabled for the same temporary QA window. If it still enforces CAPTCHA, password sign-in will correctly fail without a token.
4. Run `npm run dev`.
5. Sign in with a test account.
6. Capture `/admin/content/blogs` and `/portal/blogs` on desktop and mobile widths.

When `VERCEL_ENV=production`, auth Turnstile remains required even if `AUTH_CAPTCHA_REQUIRED=false` is present. Before deploying production, set `AUTH_CAPTCHA_REQUIRED=true` and re-enable CAPTCHA in Supabase Auth so the app and provider protections stay aligned.