"use client";

import { Check, Copy, Globe2, LockIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { ReactNode } from "react";

import { MemberAvatar } from "@/components/members/member-avatar";
import { StatusBadge } from "@/components/members/status-badge";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
import type {
  PublicDirectoryMemberProfile,
  PublicMemberProfile,
} from "@/lib/members/public-profile-contract";

function FacebookIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="16"
      viewBox="0 0 24 24"
      width="16"
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
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="M6.7 8.9H3.5V20h3.2V8.9ZM5.1 4a1.85 1.85 0 1 0 0 3.7 1.85 1.85 0 0 0 0-3.7Zm14.8 9.6c0-3.1-1.7-5-4.3-5a3.7 3.7 0 0 0-3.2 1.7V8.9H9.3V20h3.2v-5.8c0-1.6.8-2.5 2.1-2.5 1.2 0 2 .8 2 2.5V20h3.3v-6.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function getWorkplaceValue(member: PublicDirectoryMemberProfile) {
  if (!member.workplace.visible || !member.workplace.currentOrganization) {
    return null;
  }

  return [member.workplace.designation, member.workplace.currentOrganization]
    .filter(Boolean)
    .join(" at ");
}

function ProfileField({
  fallback = "—",
  label,
  value,
}: {
  fallback?: ReactNode;
  label: string;
  value?: ReactNode;
}) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value || fallback}</dd>
    </>
  );
}

function CopyableProfileId({ id }: { id: string }) {
  const timeoutRef = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);
  const displayId = formatMembershipIdForDisplay(id);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function handleCopy(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    void navigator.clipboard.writeText(displayId).catch(() => undefined);
    setCopied(true);
    timeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      aria-label={`Copy member ID ${displayId}`}
      className="jnuits-id-btn"
      onClick={handleCopy}
      title="Copy member ID"
      type="button"
    >
      {displayId}
      {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      {copied ? <span className="profile-copy-status">Copied!</span> : null}
    </button>
  );
}

export function MemberProfileCard({ member }: { member: PublicMemberProfile }) {
  const directoryMember = member.scope === "directory" ? member : null;
  const workplace = directoryMember ? getWorkplaceValue(directoryMember) : null;
  const hasSocialLinks = Boolean(
    directoryMember?.facebookUrl ||
      directoryMember?.linkedinUrl ||
      directoryMember?.websiteUrl
  );

  return (
    <div className="profile-card">
      <div className="profile-hero">
        <MemberAvatar name={member.fullName} size={96} src={member.avatarSecureUrl} />
        <div className="profile-hero-info">
          <h1 className="profile-name">{member.fullName}</h1>
          {directoryMember ? (
            <StatusBadge memberType={directoryMember.memberType} />
          ) : null}
          <CopyableProfileId id={member.jnuitsId} />
        </div>
      </div>

      <hr className="profile-divider" />

      <section className="profile-section" aria-labelledby="profile-about-title">
        <h2 className="profile-section-title" id="profile-about-title">
          About
        </h2>
        <dl className="profile-fields">
          <ProfileField label="Department" value={member.departmentName} />
          {directoryMember ? (
            <>
              <ProfileField
                fallback={
                  <span className="private-label">
                    <LockIcon size={13} aria-hidden="true" />
                    Kept private
                  </span>
                }
                label="Workplace"
                value={workplace}
              />
              <ProfileField
                label="Location"
                value={directoryMember.workplace.workLocation}
              />
            </>
          ) : null}
        </dl>
      </section>

      {member.committeeAppointments.length > 0 ? (
        <>
          <hr className="profile-divider" />
          <section
            className="profile-section"
            aria-labelledby="profile-committee-title"
          >
            <h2 className="profile-section-title" id="profile-committee-title">
              Committee service
            </h2>
            <ul className="grid gap-3">
              {member.committeeAppointments.map((appointment) => (
                <li key={appointment.assignmentId}>
                  <Link
                    aria-label={`${appointment.roleTitle}, ${appointment.termTitle}`}
                    className="block rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-4 transition hover:border-[var(--brand-blue)]/40"
                    href={`/committee/${encodeURIComponent(appointment.termSlug)}`}
                  >
                    <span className="block text-sm font-semibold text-[var(--foreground)]">
                      {appointment.roleTitle}
                      {appointment.roleTitleBn
                        ? ` · ${appointment.roleTitleBn}`
                        : ""}
                    </span>
                    <span className="mt-1 block text-sm text-[var(--muted-foreground)]">
                      {appointment.termTitle}
                    </span>
                    {appointment.dateConfidence === "estimated" ? (
                      <span className="mt-2 block text-xs font-medium text-amber-600 dark:text-amber-400">
                        Estimated dates
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {directoryMember && hasSocialLinks ? (
        <>
          <hr className="profile-divider" />
          <section className="profile-section" aria-labelledby="profile-connect-title">
            <h2 className="profile-section-title" id="profile-connect-title">
              Connect
            </h2>
            <div className="profile-links">
              {directoryMember.facebookUrl ? (
                <a
                  aria-label={`${member.fullName}'s Facebook profile`}
                  className="profile-link-btn"
                  href={directoryMember.facebookUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                  title="Facebook"
                >
                  <FacebookIcon />
                  Facebook
                </a>
              ) : null}
              {directoryMember.linkedinUrl ? (
                <a
                  aria-label={`${member.fullName}'s LinkedIn profile`}
                  className="profile-link-btn"
                  href={directoryMember.linkedinUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                  title="LinkedIn"
                >
                  <LinkedinIcon />
                  LinkedIn
                </a>
              ) : null}
              {directoryMember.websiteUrl ? (
                <a
                  aria-label={`${member.fullName}'s website`}
                  className="profile-link-btn"
                  href={directoryMember.websiteUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                  title="Website"
                >
                  <Globe2 size={16} aria-hidden="true" />
                  Website
                </a>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
