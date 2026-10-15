# Supabase Auth URL drift

The production Site URL is `https://jnuits.org.bd`; the selected redirect policy includes `https://jnuits.org.bd/**`. The application uses `/auth/confirm` for email confirmation and recovery. Keep existing project-scoped Vercel preview redirects until their integration owner reviews them.

The owner restored these settings on 2026-10-15. An active Supabase–Vercel connection was verified. Supabase documents deployment webhooks updating redirect URIs; this is a plausible source of the reported overwrite, but available evidence does not establish the last writer. No repository script was found changing hosted Auth URL settings. Do not disconnect integrations or change provider settings on that inference alone.

`node scripts/check-supabase-auth-urls.mjs` makes one read-only Management API request with server-only `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` (requires `auth_config_read`). It accepts only the canonical Site URL and the chosen canonical redirect policy, fails closed on drift/unavailable configuration, and prints only booleans or a generic error/status. It never logs the Auth configuration, which can include provider and SMTP secrets.

The existing protected, manually dispatched Production Readiness workflow runs this check. This is detection when that workflow runs, not a continuous monitor or a provider-setting lock. After changing integrations or deploying, rerun readiness and review any drift before changing settings again. No recurring AI task is installed.

References: [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Supabase–Vercel integration behavior](https://supabase.com/blog/using-supabase-with-vercel), [read-only Auth configuration API](https://supabase.com/docs/reference/api/v1-get-auth-service-config).
