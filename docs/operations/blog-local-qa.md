# Blog UI Local QA

Use this only for local authenticated screenshots and interaction testing. It does not bypass RBAC, does not create privileged cookies, and does not change production CAPTCHA behavior.

1. Set `AUTH_CAPTCHA_REQUIRED=false` in the local QA environment.
2. Keep `VERCEL_ENV` unset or set to a non-production value such as `preview`.
3. Run `npm run dev`.
4. Sign in with an existing documented admin or portal test account.
5. Capture `/admin/content/blogs` and `/portal/blogs` on desktop and mobile widths.

When `VERCEL_ENV=production`, auth Turnstile remains required even if `AUTH_CAPTCHA_REQUIRED=false` is present.
