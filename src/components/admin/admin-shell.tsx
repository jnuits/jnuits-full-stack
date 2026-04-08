"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteBrand } from "@/components/layout/site-brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { adminNavigation } from "@/lib/site";

export function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="admin-shell flex-1">
      <div className="shell py-8">
        <div className="workspace-frame">
          <aside className="workspace-sidebar h-fit p-5">
            <div className="workspace-sidebar__utility">
              <SiteBrand compact subtitle="Operator workspace" />
              <ThemeToggle />
            </div>
            <div className="mt-6 mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
                Operator space
              </p>
              <p className="mt-2 font-[family-name:var(--font-heading)] text-[1.65rem] font-bold leading-tight">
                Moderation, migration, and review queues
              </p>
            </div>
            <nav className="workspace-nav-list">
              {adminNavigation.map((item) => {
                const [baseHref] = item.href.split("#");
                const isOverviewAnchor = item.href.startsWith("/admin#");
                const active = isOverviewAnchor
                  ? pathname === "/admin"
                  : pathname === baseHref;

                return (
                  <Link
                    key={item.href}
                    data-active={active ? "true" : "false"}
                    href={item.href}
                    className="workspace-nav-link"
                  >
                    <span>{item.label}</span>
                    <span className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      {isOverviewAnchor ? "Queue" : "Workspace"}
                    </span>
                  </Link>
                );
              })}
            </nav>
            <div className="workspace-callout workspace-sidebar__callout mt-5">
              This workspace is for moderators and operators handling approvals,
              invitations, committees, reports, and public content changes.
              Member-safe tasks stay in the portal instead of this wider control
              surface.
            </div>
          </aside>
          <main className="workspace-main p-6 sm:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
