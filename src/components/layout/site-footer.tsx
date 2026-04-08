import Link from "next/link";
import { SiteBrand } from "@/components/layout/site-brand";

export function SiteFooter() {
  return (
    <footer
      className="mt-20 border-t border-[var(--line)] text-white"
      style={{
        background: "color-mix(in oklab, var(--foreground) 88%, black 12%)",
      }}
    >
      <div className="shell grid gap-8 py-12 md:grid-cols-3">
        <div>
          <SiteBrand inverted subtitle="Unified website, portal, and operator stack" />
          <p className="mt-4 max-w-sm text-sm leading-7 text-white/72">
            The platform foundation is live, but the content migration, richer
            portal workflows, and operator queues are still moving through the
            execution plan. This is the beginning of the rollout, not the end state.
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
            Delivery Path
          </p>
          <div className="mt-3 grid gap-2 text-sm text-white/80">
            <span>Phases 00-02 established the secure core</span>
            <span>Phases 03-05 now include the live public-content rebuild lane</span>
            <span>Dark and light modes now share the same brand system</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
