"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteBrand } from "@/components/layout/site-brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { portalNavigation } from "@/lib/site";

export function PortalShell({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="portal-shell flex-1">
      <div className="shell py-8">
        <div className="workspace-frame">
          <aside className="workspace-sidebar h-fit p-5">
            <div className="workspace-sidebar__utility">
              <SiteBrand compact subtitle="Protected member workspace" />
              <ThemeToggle />
            </div>
            <div className="mt-6 mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
                Member portal
              </p>
              <p className="mt-2 font-[family-name:var(--font-heading)] text-[1.65rem] font-bold leading-tight">
                Personal tools with safe boundaries
              </p>
            </div>
            <nav className="workspace-nav-list">
              {portalNavigation.map((item) => (
                <Link
                  key={item.href}
                  data-active={pathname === item.href ? "true" : "false"}
                  href={item.href}
                  className="workspace-nav-link"
                >
                  <span>{item.label}</span>
                  <span className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Open
                  </span>
                </Link>
              ))}
            </nav>
            <div className="workspace-callout workspace-sidebar__callout mt-5">
              This portal is intentionally narrower than <code>/admin</code>.
              Sensitive review queues and migration controls remain in the
              operator workspace.
            </div>
          </aside>

          <main className="workspace-main p-6 sm:p-8">
            <div className="workspace-topbar">
              <span className="status-pill">Member workspace</span>
            </div>
            <h1 className="section-title text-[2.45rem]">{title}</h1>
            <p className="section-copy mt-3">{summary}</p>
            <div className="mt-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
