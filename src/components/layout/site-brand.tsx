import Image from "next/image";
import Link from "next/link";

type SiteBrandProps = {
  compact?: boolean;
  href?: string;
  inverted?: boolean;
  subtitle?: string;
};

export function SiteBrand({
  compact = false,
  href = "/",
  inverted = false,
  subtitle = "Public site + member portal",
}: SiteBrandProps) {
  return (
    <Link aria-label="Go to JnUITS home" className="inline-flex" href={href}>
      <div className="brand-lockup">
        <div
          className={`brand-mark ${inverted ? "brand-mark--inverted" : ""} ${compact ? "size-12" : "size-14"}`}
        >
          <Image
            alt="JnUITS official logo"
            className="h-full w-full object-contain"
            height={56}
            src="/logo.svg"
            width={56}
          />
        </div>
        <div>
          <div className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight">
            JnUITS
          </div>
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
            {subtitle}
          </div>
        </div>
      </div>
    </Link>
  );
}
