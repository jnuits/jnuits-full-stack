import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const sentryRelease =
  process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA;

const nextConfig: NextConfig = {
  env: sentryRelease
    ? {
        NEXT_PUBLIC_SENTRY_RELEASE: sentryRelease,
      }
    : {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: Boolean(process.env.SENTRY_AUTH_TOKEN),
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
