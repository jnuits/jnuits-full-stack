export type SecurityHeader = {
  key: string;
  value: string;
};

export function buildContentSecurityPolicy({
  allowUnsafeEval = process.env.NODE_ENV !== "production",
}: { allowUnsafeEval?: boolean } = {}) {
  const scriptSrc = [
    "script-src 'self' 'unsafe-inline'",
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
    "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com https://*.sentry.io",
    "frame-src 'self' https://challenges.cloudflare.com",
    "form-action 'self'",
  ].join("; ");
}

export function buildSecurityHeaders({
  allowUnsafeEval = process.env.NODE_ENV !== "production",
  includeHsts = process.env.VERCEL_ENV === "production",
}: {
  allowUnsafeEval?: boolean;
  includeHsts?: boolean;
} = {}): SecurityHeader[] {
  return [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy({ allowUnsafeEval }),
    },
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