import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security/http-headers";

const sentryRelease =
  process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA;

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // A CSV import is capped at 2 MB in the action. Leave room for multipart form overhead.
      bodySizeLimit: "3mb",
    },
  },
  env: sentryRelease
    ? {
        NEXT_PUBLIC_SENTRY_RELEASE: sentryRelease,
      }
    : {},
  async headers() {
    return [
      {
        headers: buildSecurityHeaders(),
        source: "/:path*",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  poweredByHeader: false,
};

export default withSentryConfig(nextConfig, {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: Boolean(process.env.SENTRY_AUTH_TOKEN),
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
