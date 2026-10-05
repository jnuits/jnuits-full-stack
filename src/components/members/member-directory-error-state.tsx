"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

export function MemberDirectoryErrorState() {
  const router = useRouter();

  return (
    <div className="shell py-16">
      <section className="error-state" role="alert">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300">
          <AlertTriangle size={24} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-[var(--foreground)]">
          Unable to load members right now
        </h1>
        <button
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand-blue)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
          onClick={() => router.refresh()}
          type="button"
        >
          Try again
        </button>
      </section>
    </div>
  );
}
