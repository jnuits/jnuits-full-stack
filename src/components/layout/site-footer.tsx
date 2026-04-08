import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--line)] bg-[rgba(16,35,49,0.96)] text-white">
      <div className="shell grid gap-8 py-10 md:grid-cols-3">
        <div>
          <p className="font-[family-name:var(--font-heading)] text-xl font-bold">
            JnUITS Full Stack
          </p>
          <p className="mt-3 max-w-sm text-sm leading-7 text-white/70">
            Unified platform bootstrap for the public website, member portal, and
            operator workflows. Early phases prioritize security, certificates, and
            migration tooling.
          </p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/55">
            Key Surfaces
          </p>
          <div className="mt-3 grid gap-2 text-sm text-white/80">
            <Link href="/certificates">Certificate verification</Link>
            <Link href="/members">Members and alumni</Link>
            <Link href="/portal">Member portal</Link>
            <Link href="/admin">Admin workspace</Link>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/55">
            Planning Artifacts
          </p>
          <div className="mt-3 grid gap-2 text-sm text-white/80">
            <Link href="/about">Execution summary</Link>
            <Link href="/contact">Contact workflow</Link>
            <span>Supabase + Vercel deployment path</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
