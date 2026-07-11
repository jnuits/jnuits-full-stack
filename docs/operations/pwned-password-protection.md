# Free Leaked-Password Protection

JnUITS uses the free [HIBP Pwned Passwords range API](https://haveibeenpwned.com/API/v3) rather than Supabase's paid leaked-password feature. The range API uses k-anonymity: the browser or server hashes the password locally with SHA-1, sends only the first five hash characters, and compares the remaining suffix locally. The plaintext password and complete hash never leave the application.

## Current application choice

The checked-in implementation has two layers:

1. `src/lib/security/pwned-passwords.ts` is a browser-safe TypeScript helper. `PasswordSecurityField` calls it only when the completed password field loses focus; it does not perform incremental checks while someone types.
2. The server actions for member claims, recovery-password changes, and signed-in password changes call the same helper immediately before their Supabase Auth mutation. This is the enforcement point: disabling JavaScript cannot bypass it. A failed range lookup fails closed with a retry message, so a password cannot be created while its breach status is unknown.

The helper requests `https://api.pwnedpasswords.com/range/{prefix}` with `Add-Padding: true`, as supported by HIBP. It is free and does not use the HIBP breach-email or domain APIs.

## Edge Function option

JnUITS does not deploy this option today. Its Next.js server actions already form a server-only boundary and preserve the invitation-claim transaction in one place. A public Edge Function that calls `auth.admin.createUser()` would add an unnecessary signup endpoint.

If a future server-to-server workflow needs an Edge Function, use an internal-only function like this. Set `INTERNAL_SIGNUP_SECRET` only in Supabase Edge Function secrets and call it only from trusted server code after the invitation or eligibility check has passed. Never call it from a browser.

```ts
// supabase/functions/internal-password-signup/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

const rangeUrl = "https://api.pwnedpasswords.com/range";
const internalSecret = Deno.env.get("INTERNAL_SIGNUP_SECRET");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function sha1Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

async function passwordIsPwned(password: string) {
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const response = await fetch(`${rangeUrl}/${prefix}`, {
    headers: { "Add-Padding": "true" },
    signal: AbortSignal.timeout(4_000),
  });

  if (!response.ok) throw new Error("Pwned Passwords range lookup failed");

  return (await response.text())
    .split(/\r?\n/)
    .some((line) => line.split(":", 1)[0]?.trim().toUpperCase() === suffix);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ message: "Not found" }, 404);
  if (!internalSecret || request.headers.get("x-internal-signup-secret") !== internalSecret) {
    return json({ message: "Not found" }, 404);
  }

  const body = await request.json().catch(() => null) as
    | { email?: unknown; password?: unknown; userMetadata?: Record<string, unknown> }
    | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) return json({ message: "Invalid signup request." }, 400);

  try {
    if (await passwordIsPwned(password)) {
      return json({ message: "Choose a password that has not appeared in known data breaches." }, 400);
    }
  } catch {
    // Fail closed: do not create an account when the security check is unavailable.
    return json({ message: "Password security verification is unavailable. Please try again shortly." }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: false,
    password,
    user_metadata: body?.userMetadata ?? {},
  });

  if (error || !data.user) return json({ message: "Unable to create the account." }, 400);
  return json({ user: { email: data.user.email, id: data.user.id } }, 201);
});
```

The function needs `verify_jwt = false` in `supabase/config.toml` only because it authenticates with its own internal secret. That secret check is mandatory, and the function must never be made callable by an untrusted browser. Supabase's admin `createUser` API is server-only because its secret key bypasses RLS. See the [Supabase Edge Function security guidance](https://supabase.com/docs/guides/functions/auth) and [Auth Admin createUser reference](https://supabase.com/docs/reference/javascript/auth-admin-createuser).

## Operating rules

- Keep the in-app server-side check even if a future Edge Function is added.
- Do not log plaintext passwords, hashes, prefixes, HIBP responses, or request bodies.
- Keep the password policy (12–128 characters and predictable-password checks) in place; the range API complements it rather than replacing it.
- Before re-enabling Supabase CAPTCHA in production, verify login, reset, invite claim, and password change flows with a real Turnstile token.
