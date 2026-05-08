"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  ExternalLink,
  Globe,
  UserRound,
  X,
} from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { useMediaQuery } from "@/hooks/use-media-query";
import type { PublicCommitteeAssignment } from "@/lib/committee/public";
import { getInitials } from "@/lib/committee-utils";

function cn(...classes: Array<false | null | string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type PreviewPosition = {
  left: number;
  top: number;
};

export function ExecutiveMemberCard({
  assignment,
  isCurrent,
  termTitle,
}: {
  assignment: PublicCommitteeAssignment;
  isCurrent: boolean;
  termTitle: string;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleId = useId();
  const [hoverPreviewVisible, setHoverPreviewVisible] = useState(false);
  const [previewPosition, setPreviewPosition] = useState<PreviewPosition>({
    left: 0,
    top: 0,
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 639px)");
  const profileHref = assignment.jnuitsId
    ? `/members/${encodeURIComponent(assignment.jnuitsId)}`
    : null;

  useEffect(() => {
    if (!profileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex='-1'])"
        )
      );

      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  const updatePreviewPosition = () => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const previewWidth = 280;
    const previewHeight = 220;
    const gap = 10;
    const spaceAbove = rect.top;
    const top =
      spaceAbove > previewHeight + gap
        ? rect.top - previewHeight - gap
        : rect.bottom + gap;
    const left = Math.max(
      8,
      Math.min(rect.left + rect.width / 2 - previewWidth / 2, window.innerWidth - previewWidth - 8)
    );

    setPreviewPosition({ left, top: Math.max(8, top) });
  };

  const handleMouseEnter = () => {
    const isTouchDevice =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia("(pointer: coarse)").matches;

    if (isTouchDevice) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);

    hoverTimer.current = setTimeout(() => {
      updatePreviewPosition();
      setHoverPreviewVisible(true);
    }, 400);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoverPreviewVisible(false);
  };

  const openProfile = () => {
    setHoverPreviewVisible(false);
    setProfileOpen(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProfile();
    }
  };

  return (
    <>
      <article
        aria-haspopup="dialog"
        aria-label={`View profile of ${assignment.displayName}, ${assignment.roleTitle}`}
        className="group relative cursor-pointer select-none rounded-2xl border border-border bg-card p-4 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        onClick={openProfile}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        ref={cardRef}
        role="button"
        tabIndex={0}
      >
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary/60">
          {assignment.roleTitle}
        </p>

        <div className="relative mb-3 size-14">
          <MemberAvatarImage
            alt={assignment.displayName}
            className="size-14 rounded-xl"
            name={assignment.displayName}
            src={assignment.avatarUrl}
          />
          {isCurrent ? (
            <span
              aria-hidden="true"
              className="absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-background bg-emerald-500"
            />
          ) : null}
        </div>

        <p className="line-clamp-2 text-sm font-bold leading-tight text-foreground">
          {assignment.displayName || "Unlinked member"}
        </p>
        {assignment.jnuitsId ? (
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">
            {assignment.jnuitsId}
          </p>
        ) : null}
        {assignment.departmentName ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {assignment.departmentName}
          </p>
        ) : null}

        <div className="mt-3 flex translate-y-1 items-center gap-1 border-t border-border/50 pt-3 opacity-100 transition-all duration-200 group-hover:translate-y-0 sm:opacity-0 sm:group-hover:opacity-100">
          <span className="text-[11px] font-medium text-primary">
            View profile
          </span>
          <ArrowRight aria-hidden="true" className="text-primary" size={11} />
        </div>
      </article>

      {hoverPreviewVisible
        ? createPortal(
            <div
              className="pointer-events-none fixed z-50 w-[280px] animate-[jnuits-fade-rise_180ms_var(--motion-ease)_both] rounded-2xl border border-border bg-card/95 p-5 shadow-2xl backdrop-blur-sm"
              style={{
                left: previewPosition.left,
                top: previewPosition.top,
              }}
            >
              <MemberPreviewContent
                assignment={assignment}
                termTitle={termTitle}
              />
            </div>,
            document.body
          )
        : null}

      {profileOpen
        ? createPortal(
            <div
              aria-labelledby={titleId}
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setProfileOpen(false);
              }}
              role="dialog"
            >
              <div
                className={cn(
                  "w-full overflow-hidden border border-border bg-card shadow-2xl",
                  isMobile
                    ? "max-h-[92vh] rounded-t-2xl"
                    : "max-h-[88vh] max-w-md rounded-2xl"
                )}
                ref={dialogRef}
              >
                <ProfilePreviewContent
                  assignment={assignment}
                  closeButtonRef={closeButtonRef}
                  isCurrent={isCurrent}
                  onClose={() => setProfileOpen(false)}
                  profileHref={profileHref}
                  termTitle={termTitle}
                  titleId={titleId}
                />
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function MemberAvatarImage({
  alt,
  className,
  name,
  src,
}: {
  alt: string;
  className: string;
  name: string;
  src: null | string;
}) {
  if (src) {
    return (
      <span className={cn("relative block overflow-hidden", className)}>
        <Image
          alt={alt}
          className="rounded-xl border border-border/50 object-cover transition-colors group-hover:border-primary/30"
          fill
          sizes="80px"
          src={src}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex items-center justify-center border border-primary/10 bg-gradient-to-br from-primary/15 to-primary/5 font-black text-primary transition-colors group-hover:border-primary/25",
        className
      )}
    >
      {getInitials(name || "JnUITS")}
    </span>
  );
}

function MemberPreviewContent({
  assignment,
  termTitle,
}: {
  assignment: PublicCommitteeAssignment;
  termTitle: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <MemberAvatarImage
          alt={assignment.displayName}
          className="size-16 flex-shrink-0 rounded-xl"
          name={assignment.displayName}
          src={assignment.avatarUrl}
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
            {assignment.roleTitle}
          </p>
          <p className="mt-0.5 text-base font-bold leading-tight text-foreground">
            {assignment.displayName}
          </p>
          {assignment.jnuitsId ? (
            <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
              {assignment.jnuitsId}
            </p>
          ) : null}
        </div>
      </div>

      {assignment.departmentName ? (
        <PreviewRow icon={<Building2 aria-hidden="true" size={11} />}>
          {assignment.departmentName}
        </PreviewRow>
      ) : null}

      <PreviewRow icon={<CalendarDays aria-hidden="true" size={11} />}>
        {termTitle}
      </PreviewRow>

      <div className="border-t border-border/50 pt-2">
        <p className="text-center text-[10px] text-muted-foreground/50">
          Click to open full profile
        </p>
      </div>
    </div>
  );
}

function PreviewRow({
  children,
  icon,
}: {
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {icon}
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

function ProfilePreviewContent({
  assignment,
  closeButtonRef,
  isCurrent,
  onClose,
  profileHref,
  termTitle,
  titleId,
}: {
  assignment: PublicCommitteeAssignment;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  isCurrent: boolean;
  onClose: () => void;
  profileHref: null | string;
  termTitle: string;
  titleId: string;
}) {
  const hasSocialLinks = Boolean(
    assignment.facebookUrl || assignment.linkedinUrl || assignment.websiteUrl
  );

  return (
    <>
      <div className="bg-gradient-to-br from-primary/10 to-background px-6 pb-5 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="relative size-20 flex-shrink-0">
              <MemberAvatarImage
                alt={assignment.displayName}
                className="size-20 rounded-2xl border-2 border-background shadow-sm"
                name={assignment.displayName}
                src={assignment.avatarUrl}
              />
              {isCurrent ? (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1 -right-1 size-5 rounded-full border-2 border-background bg-emerald-500"
                />
              ) : null}
            </div>

            <div className="min-w-0 flex-1 pt-1">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-primary/70">
                {assignment.roleTitle}
              </p>
              <h3 className="text-xl font-bold leading-tight" id={titleId}>
                {assignment.displayName || "Historical member"}
              </h3>
              {assignment.jnuitsId ? (
                <p className="mt-1 font-mono text-xs text-muted-foreground/70">
                  {assignment.jnuitsId}
                </p>
              ) : null}
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                {isCurrent ? "Current term" : "Historical term"}
              </span>
            </div>
          </div>

          <button
            aria-label="Close profile preview"
            className="inline-flex size-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-3 border-t border-border/50 px-6 py-5">
        {assignment.departmentName ? (
          <ProfileInfoRow
            icon={<Building2 aria-hidden="true" size={14} />}
            label="Department"
            value={assignment.departmentName}
          />
        ) : null}
        <ProfileInfoRow
          icon={<UserRound aria-hidden="true" size={14} />}
          label="Role"
          value={assignment.roleTitle}
        />
        <ProfileInfoRow
          icon={<CalendarDays aria-hidden="true" size={14} />}
          label="Term"
          value={termTitle}
        />

        {hasSocialLinks ? (
          <div className="flex gap-2 pt-1">
            {assignment.facebookUrl ? (
              <SocialLink
                href={assignment.facebookUrl}
                label={`Facebook profile for ${assignment.displayName}`}
              >
                <span className="text-xs font-bold">f</span>
              </SocialLink>
            ) : null}
            {assignment.linkedinUrl ? (
              <SocialLink
                href={assignment.linkedinUrl}
                label={`LinkedIn profile for ${assignment.displayName}`}
              >
                <span className="text-xs font-bold">in</span>
              </SocialLink>
            ) : null}
            {assignment.websiteUrl ? (
              <SocialLink
                href={assignment.websiteUrl}
                label={`Website for ${assignment.displayName}`}
              >
                <Globe aria-hidden="true" size={14} />
              </SocialLink>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-6 py-4">
        <p className="text-xs text-muted-foreground">{termTitle}</p>
        {profileHref ? (
          <Link
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            href={profileHref}
          >
            Full profile
            <ArrowUpRight aria-hidden="true" size={13} />
          </Link>
        ) : null}
      </div>
    </>
  );
}

function ProfileInfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="flex-shrink-0 text-muted-foreground">{icon}</span>
      <span className="w-20 flex-shrink-0 text-xs text-muted-foreground">
        {label}
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function SocialLink({
  children,
  href,
  label,
}: {
  children: ReactNode;
  href: string;
  label: string;
}) {
  return (
    <a
      aria-label={`${label} (opens in new tab)`}
      className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-border/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
      <ExternalLink className="sr-only" size={1} />
    </a>
  );
}
