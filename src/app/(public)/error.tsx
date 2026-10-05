"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="shell flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
        Something went wrong
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        This page could not be loaded
      </h1>
      <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
        An unexpected error occurred while rendering this section. You can try
        again, or head back to the homepage.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-card px-6 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
          href="/"
        >
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
