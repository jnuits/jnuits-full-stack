export type SecurityHeader = {
  key: string;
  value: string;
};

export function buildContentSecurityPolicy({
  nonce,
  allowUnsafeEval = process.env.NODE_ENV !== "production",
}: { nonce: string; allowUnsafeEval?: boolean }) {
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(nonce)) throw new Error("Invalid CSP nonce.");
  const scriptSrc = [
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    allowUnsafeEval ? "'unsafe-eval'" : "",
    "https://challenges.cloudflare.com",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    scriptSrc,
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://api.pwnedpasswords.com https://challenges.cloudflare.com https://*.sentry.io",
    "frame-src 'self' https://challenges.cloudflare.com https://www.google.com",
    "form-action 'self'",
  ].join("; ");
}

export function buildSecurityHeaders({
  // HSTS must not depend on the hosting platform: any production build
  // (Vercel or self-hosted) enforces HTTPS-only transport.
  includeHsts =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production",
}: {
  allowUnsafeEval?: boolean;
  includeHsts?: boolean;
} = {}): SecurityHeader[] {
  return [
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-Frame-Options",
      value: "SAMEORIGIN",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    ...(includeHsts
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ]
      : []),
  ];
}