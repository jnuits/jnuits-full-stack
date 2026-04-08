import Link from "next/link";
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
  return (
    <div className="portal-shell flex-1">
      <div className="shell grid gap-6 py-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="glass-card h-fit p-4">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Member Portal
            </p>
            <p className="mt-2 font-[family-name:var(--font-heading)] text-xl font-bold">
              Limited safe workspace
            </p>
          </div>
          <nav className="grid gap-2">
            {portalNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-[rgba(17,32,45,0.08)] bg-white/70 px-4 py-3 text-sm font-semibold"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="glass-card p-6 sm:p-8">
          <span className="status-pill">Portal phase scaffolded</span>
          <h1 className="section-title mt-4 text-[2.4rem]">{title}</h1>
          <p className="section-copy mt-3">{summary}</p>
          <div className="mt-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
