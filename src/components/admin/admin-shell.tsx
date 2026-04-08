import Link from "next/link";
import { adminNavigation } from "@/lib/site";

export function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell flex-1">
      <div className="shell grid gap-6 py-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="glass-card h-fit p-4">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Operator Space
            </p>
            <p className="mt-2 font-[family-name:var(--font-heading)] text-xl font-bold">
              Technical admin workspace
            </p>
          </div>
          <nav className="grid gap-2">
            {adminNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-[rgba(17,32,45,0.08)] bg-white/72 px-4 py-3 text-sm font-semibold"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="glass-card p-6 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
