import Link from "next/link";
import { SiteBrand } from "@/components/layout/site-brand";
import { getFooterContent } from "@/lib/content/site-singletons";

export async function SiteFooter() {
  const footerContent = await getFooterContent();

  return (
    <footer className="site-footer mt-20">
      <div className="shell grid gap-8 py-12 md:grid-cols-3">
        <div>
          <SiteBrand inverted subtitle={footerContent.subtitle} />
          <p className="mt-4 max-w-sm text-sm leading-7 text-white/72">
            {footerContent.summary}
          </p>
        </div>

        <div>
          <p className="site-footer__column-title">
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
          <p className="site-footer__column-title">
            Contact
          </p>
          <div className="mt-3 grid gap-2 text-sm text-white/80">
            <span>{footerContent.university}</span>
            <Link href={`mailto:${footerContent.email}`}>{footerContent.email}</Link>
            <span>{footerContent.location}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
