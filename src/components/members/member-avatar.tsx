"use client";

import { useState } from "react";

import { getProfileInitials } from "@/components/profile/profile-avatar";

const AVATAR_COLORS = [
  "#3249A6",
  "#0F766E",
  "#7C3AED",
  "#BE123C",
  "#A16207",
  "#0369A1",
  "#4338CA",
  "#15803D",
];

function hashName(name: string) {
  return Array.from(name || "Member").reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    0
  );
}

export function MemberAvatar({
  name,
  size = 48,
  src,
}: {
  name: string;
  size?: number;
  src?: null | string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = getProfileInitials(name);
  const color = AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];
  const dimension = `${size}px`;

  if (src && !imageFailed) {
    return (
      // Cloudinary already stores these avatars as 400x400 optimized assets.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={`${name} profile photo`}
        className="member-avatar"
        height={size}
        onError={() => setImageFailed(true)}
        src={src}
        style={{ height: dimension, width: dimension }}
        width={size}
      />
    );
  }

  return (
    <span
      aria-label={`${name} profile photo`}
      className="member-avatar member-avatar--initials"
      role="img"
      style={{
        background: color,
        fontSize: `${Math.max(16, Math.round(size * 0.34))}px`,
        height: dimension,
        width: dimension,
      }}
    >
      {initials}
    </span>
  );
}
