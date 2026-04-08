import Link from "next/link";
import { SiteBrand } from "@/components/layout/site-brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { adminNavigation } from "@/lib/site";

export function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell flex-1">
      <div className="shell py-8">
        <div className="workspace-frame">
          <aside className="workspace-sidebar h-fit p-5">
            <div className="flex items-start justify-between gap-3">
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
            <nav className="grid gap-2">
              {adminNavigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="workspace-nav-link"
                >
                  <span>{item.label}</span>
                  <span className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Queue
                  </span>
                </Link>
              ))}
            </nav>
            <div className="workspace-callout mt-5">
              Operator flows are now moving past placeholder copy. Membership
              review and invitation generation live here first; moderation,
              committee management, and reconciliation continue in the next passes.
            </div>
          </aside>
          <main className="workspace-main p-6 sm:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
