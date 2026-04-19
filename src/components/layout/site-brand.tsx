import Image from "next/image";
import Link from "next/link";
import { brandProfile } from "@/lib/branding";

type SiteBrandProps = {
  compact?: boolean;
  displayTitle?: string;
  fullName?: boolean;
  href?: string;
  inverted?: boolean;
  subtitle?: string;
};

export function SiteBrand({
  compact = false,
  displayTitle,
  fullName = false,
  href = "/",
  inverted = false,
  subtitle,
}: SiteBrandProps) {
  const brandTitle =
    displayTitle ?? (fullName ? brandProfile.fullName : brandProfile.shortName);

  return (
    <Link
      aria-label={`Go to ${brandProfile.fullName} home`}
      className="inline-flex"
      href={href}
    >
      <div
        className="brand-lockup"
        data-compact={compact ? "true" : "false"}
        data-custom-title={displayTitle ? "true" : "false"}
        data-full-name={fullName ? "true" : "false"}
        data-inverted={inverted ? "true" : "false"}
      >
        <div
          className={`brand-mark ${inverted ? "brand-mark--inverted" : ""} ${compact ? "size-12" : "size-14"}`}
        >
          <Image
            alt={`${brandProfile.fullName} official logo`}
            className="h-full w-full object-contain"
            height={56}
            src="/logo.svg"
            width={56}
          />
        </div>
        <div className="brand-copy">
          <div className="brand-title">{brandTitle}</div>
          <div className="brand-slogan">{brandProfile.slogan}</div>
          {subtitle ? <div className="brand-subtitle">{subtitle}</div> : null}
        </div>
      </div>
    </Link>
  );
}
