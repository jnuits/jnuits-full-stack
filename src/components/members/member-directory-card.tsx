"use client";

import { Check, Copy, Globe2, LockIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

import { MemberAvatar } from "@/components/members/member-avatar";
import { StatusBadge } from "@/components/members/status-badge";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
import type { MemberDirectoryEntry } from "@/lib/members/directory";

function FacebookIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="17"
      viewBox="0 0 24 24"
      width="17"
    >
      <path
        d="M14 8.2V6.9c0-.7.4-1.1 1.2-1.1H17V3h-2.6C11.5 3 10 4.7 10 7v1.2H8v3h2V21h3.2v-9.8h2.6l.4-3H13.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LinkedinIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="17"
      viewBox="0 0 24 24"
      width="17"
    >
      <path
        d="M6.7 8.9H3.5V20h3.2V8.9ZM5.1 4a1.85 1.85 0 1 0 0 3.7 1.85 1.85 0 0 0 0-3.7Zm14.8 9.6c0-3.1-1.7-5-4.3-5a3.7 3.7 0 0 0-3.2 1.7V8.9H9.3V20h3.2v-5.8c0-1.6.8-2.5 2.1-2.5 1.2 0 2 .8 2 2.5V20h3.3v-6.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function getWorkplaceSummary(member: MemberDirectoryEntry) {
  const visibleParts = [
    member.workplace.designation,
    member.workplace.currentOrganization,
  ].filter(Boolean);
  const visibleSummary = visibleParts.join(" at ");

  if (member.workplace.visible && visibleSummary) {
    return [visibleSummary, member.workplace.workLocation].filter(Boolean).join(" · ");
  }

  return "Workplace kept private";
}

export function MemberDirectoryCard({ member }: { member: MemberDirectoryEntry }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const copyTimeoutRef = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [toastPosition, setToastPosition] = useState<{ x: number; y: number } | null>(null);
  const displayJnuitsId = formatMembershipIdForDisplay(member.jnuitsId);
  const currentQuery = searchParams.toString();
  const currentHref = `${pathname}${currentQuery ? `?${currentQuery}` : ""}`;
  const profileHref = `/members/${encodeURIComponent(displayJnuitsId)}?from=${encodeURIComponent(
    currentHref
  )}`;
  const workplaceSummary = getWorkplaceSummary(member);
  const hasMemberDetails = Boolean(member.departmentName) || member.batchNo !== null;
  const socialLinks = [
    member.facebookUrl
      ? {
          href: member.facebookUrl,
          icon: <FacebookIcon />,
          label: `View ${member.fullName}'s Facebook profile`,
          title: "Facebook",
        }
      : null,
    member.linkedinUrl
      ? {
          href: member.linkedinUrl,
          icon: <LinkedinIcon />,
          label: `View ${member.fullName}'s LinkedIn profile`,
          title: "LinkedIn",
        }
      : null,
    member.websiteUrl
      ? {
          href: member.websiteUrl,
          icon: <Globe2 size={17} aria-hidden="true" focusable="false" />,
          label: `Visit ${member.fullName}'s website`,
          title: "Website",
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  function navigateToProfile() {
    router.push(profileHref);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      navigateToProfile();
    }
  }

  function stopCardClick(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
  }

  function handleCopy(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current);
    }

    void navigator.clipboard.writeText(displayJnuitsId).catch(() => undefined);
    setCopied(true);
    setToastPosition({ x: event.clientX, y: event.clientY });
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      setToastPosition(null);
    }, 1500);
  }

  return (
    <article
      aria-label={`View ${member.fullName}'s profile`}
      className="member-card group"
      onClick={navigateToProfile}
      onKeyDown={handleKeyDown}
      role="article"
      tabIndex={0}
    >
      <div className="member-card-header">
        <MemberAvatar name={member.fullName} src={member.avatarSecureUrl} />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold leading-6 text-[var(--foreground)]">
            {member.fullName}
          </h3>
          <div className="mt-1">
            <StatusBadge memberType={member.memberType} />
          </div>
          <button
            aria-label={`Copy member ID ${displayJnuitsId}`}
            className="jnuits-id-btn mt-2"
            onClick={handleCopy}
            title="Copy member ID"
            type="button"
          >
            {displayJnuitsId}
            {copied ? (
              <Check size={12} aria-hidden="true" />
            ) : (
              <Copy size={12} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div className="member-card-body">
        {hasMemberDetails ? (
          <div
            aria-label="Member details"
            className="flex flex-wrap justify-center gap-2 text-xs text-[var(--muted-foreground)]"
          >
            {member.departmentName ? <span>{member.departmentName}</span> : null}
            {member.departmentName && member.batchNo !== null ? (
              <span aria-hidden="true">·</span>
            ) : null}
            {member.batchNo !== null ? <span>Batch {member.batchNo}</span> : null}
          </div>
        ) : null}

        <div className="text-sm leading-6 text-[var(--muted-foreground)]">
          {workplaceSummary === "Workplace kept private" ? (
            <span className="workplace-private">
              <LockIcon size={13} aria-hidden="true" />
              <span>Workplace kept private</span>
            </span>
          ) : (
            workplaceSummary
          )}
        </div>
      </div>

      <div className="member-card-footer" aria-label="Social links">
        {socialLinks.map((link) => (
          <a
            aria-label={link.label}
            className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted-foreground)] transition hover:border-[var(--brand-blue)] hover:bg-[color-mix(in_oklab,var(--brand-blue)_8%,transparent)] hover:text-[var(--brand-blue)]"
            href={link.href}
            key={link.href}
            onClick={stopCardClick}
            rel="noopener noreferrer"
            target="_blank"
            title={link.title}
          >
            {link.icon}
            <span className="sr-only">{link.title}</span>
          </a>
        ))}
      </div>

      <a
        className="view-profile-link text-[var(--brand-blue)]"
        href={profileHref}
        onClick={stopCardClick}
      >
        View profile →
      </a>

      {toastPosition ? (
        <span
          className="toast-copied"
          role="status"
          style={{ left: toastPosition.x, top: toastPosition.y }}
        >
          Copied!
        </span>
      ) : null}
    </article>
  );
}
