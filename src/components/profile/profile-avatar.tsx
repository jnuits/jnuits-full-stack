import Image from "next/image";
import type { CSSProperties } from "react";

type ProfileAvatarSize = "xs" | "sm" | "md" | "card" | "lg" | "xl";

type ProfileAvatarProps = {
  className?: string;
  name?: null | string;
  priority?: boolean;
  size?: ProfileAvatarSize;
  src?: null | string;
};

const AVATAR_SIZES: Record<ProfileAvatarSize, string> = {
  lg: "80px",
  card: "64px",
  md: "56px",
  sm: "40px",
  xl: "104px",
  xs: "30px",
};

export function getProfileInitials(name?: null | string) {
  const initials = (name || "Member")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  return initials || "M";
}

function resolveTone(name?: null | string) {
  const source = (name || "Member").trim();
  const code = source ? source.charCodeAt(0) : 0;

  return String(Math.abs(code) % 6);
}

export function ProfileAvatar({
  className,
  name,
  priority = false,
  size = "md",
  src,
}: ProfileAvatarProps) {
  const initials = getProfileInitials(name);
  const label = name ? `${name} profile photo` : "Member profile photo";

  return (
    <span
      aria-label={label}
      className={["profile-avatar", className].filter(Boolean).join(" ")}
      data-size={size}
      data-tone={resolveTone(name)}
      role="img"
      style={{ "--profile-avatar-size": AVATAR_SIZES[size] } as CSSProperties}
    >
      {src ? (
        <Image
          alt=""
          aria-hidden="true"
          fill
          priority={priority}
          sizes={AVATAR_SIZES[size]}
          src={src}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
