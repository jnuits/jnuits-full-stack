"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteBrand } from "@/components/layout/site-brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { publicNavigation } from "@/lib/site";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="shell py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SiteBrand />
          <nav className="hidden items-center gap-2 xl:flex">
            {publicNavigation.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-4 py-2 text-sm font-semibold transition"
                  style={{
                    color: active ? "var(--primary-foreground)" : "var(--brand-ink)",
                    background: active
                      ? "linear-gradient(135deg, var(--brand-deep), var(--brand-blue))"
                      : "transparent",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 sm:ml-auto">
            <ThemeToggle />
            <Link href="/login" className="primary-button text-sm">
              <span className="hidden sm:inline">Sign In</span>
              <span className="sm:hidden">Portal</span>
            </Link>
          </div>
        </div>

        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 xl:hidden">
          {publicNavigation.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition"
                style={{
                  color: active ? "var(--primary-foreground)" : "var(--brand-ink)",
                  background: active
                    ? "linear-gradient(135deg, var(--brand-deep), var(--brand-blue))"
                    : "color-mix(in oklab, var(--panel) 78%, transparent)",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
