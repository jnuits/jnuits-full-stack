"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { publicNavigation } from "@/lib/site";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[rgba(244,242,236,0.84)] backdrop-blur-xl">
      <div className="shell flex items-center justify-between gap-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(17,32,45,0.12)] bg-white text-sm font-black text-[var(--brand-deep)]">
            J
          </div>
          <div>
            <div className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight">
              JnUITS
            </div>
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Public Site + Portal
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {publicNavigation.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-semibold transition hover:bg-white"
                style={{
                  color: active ? "var(--brand-blue)" : "var(--brand-ink)",
                  background: active ? "rgba(255,255,255,0.88)" : "transparent",
                }}
              >
                {item.label}
              </Link>
            );
          })}
          <Link href="/login" className="primary-button ml-2 text-sm">
            Sign In
          </Link>
        </nav>
      </div>
    </header>
  );
}
