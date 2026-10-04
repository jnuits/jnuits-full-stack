import type { Metadata } from "next";
import { Suspense } from "react";
import { NewsletterConfirmClient } from "@/components/newsletter/newsletter-confirm-client";

export const metadata: Metadata = {
  description: "Confirm your email address to receive official JnUITS newsletters and announcements.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Confirm Newsletter Subscription | JnUITS",
};

export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <div className="shell py-16">
      <Suspense
        fallback={
          <div className="glass-card mx-auto max-w-lg p-8 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">Loading confirmation…</p>
          </div>
        }
      >
        <NewsletterConfirmClient initialToken={token} />
      </Suspense>
    </div>
  );
}
