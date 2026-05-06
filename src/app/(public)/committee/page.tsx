import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  ExternalLink,
  GraduationCap,
  UsersRound,
} from "lucide-react";

import { MemberAvatar } from "@/components/members/member-avatar";
import {
  getPublicCommitteeDirectory,
  type PublicAdvisorProfile,
  type PublicCommitteeAssignment,
  type PublicCommitteeTerm,
} from "@/lib/committee/public";

export const metadata: Metadata = {
  title: "Executive Committee & Advisors | JnU IT Society",
  description:
    "Browse JnU IT Society executive committee rosters, advisor board, tenure history, and public committee archive.",
  openGraph: {
    title: "JnU IT Society Committee",
    description:
      "Executive committee and advisor board archive for Jagannath University IT Society.",
    type: "website",
  },
};

const ROLE_GROUPS = [
  "president",
  "vice-president",
  "general-secretary",
  "assistant-general-secretary",
  "organizing-secretary",
  "treasurer",
  "office-secretary",
  "workshop-secretary",
  "it-secretary",
  "publication-secretary",
  "public-relations-secretary",
  "education-research-secretary",
  "international-secretary",
  "executive-member",
];

const ADVISOR_LABELS: Record<PublicAdvisorProfile["advisorType"], string> = {
  honorable_advisor: "Honorable Advisor",
  main_advisor: "Chief Advisor / Main Advisor",
  moderator_mentor: "Moderator / Mentor",
};

const ADVISOR_ORDER: PublicAdvisorProfile["advisorType"][] = [
  "main_advisor",
  "moderator_mentor",
  "honorable_advisor",
];

function FacebookIcon({
  "aria-hidden": ariaHidden,
  size = 15,
}: {
  "aria-hidden"?: boolean;
  size?: number;
}) {
  return (
    <svg
      aria-hidden={ariaHidden ?? true}
      fill="none"
      focusable="false"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path
        d="M14 8.2V6.9c0-.7.4-1.1 1.2-1.1H17V3h-2.6C11.5 3 10 4.7 10 7v1.2H8v3h2V21h3.2v-9.8h2.6l.4-3H13.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LinkedinIcon({
  "aria-hidden": ariaHidden,
  size = 15,
}: {
  "aria-hidden"?: boolean;
  size?: number;
}) {
  return (
    <svg
      aria-hidden={ariaHidden ?? true}
      fill="none"
      focusable="false"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path
        d="M6.9 20H3.6V9.4h3.3V20ZM5.3 8a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8ZM20.4 20h-3.3v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V20h-3.3V9.4h3.2v1.5h.1a3.5 3.5 0 0 1 3.1-1.7c3.4 0 4 2.2 4 5.1V20Z"
        fill="currentColor"
      />
    </svg>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Present";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function SocialLinks({
  className = "mt-5 flex justify-center gap-2",
  facebookUrl,
  linkedinUrl,
  name,
  websiteUrl,
}: {
  className?: string;
  facebookUrl?: null | string;
  linkedinUrl?: null | string;
  name: string;
  websiteUrl?: null | string;
}) {
  const links = [
    {
      href: facebookUrl,
      icon: FacebookIcon,
      label: `View ${name}'s Facebook profile`,
      title: "Facebook",
    },
    {
      href: linkedinUrl,
      icon: LinkedinIcon,
      label: `View ${name}'s LinkedIn profile`,
      title: "LinkedIn",
    },
    {
      href: websiteUrl,
      icon: ExternalLink,
      label: `Visit ${name}'s website`,
      title: "Website",
    },
  ].filter((link) => Boolean(link.href));

  if (links.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {links.map((link) => {
        const Icon = link.icon;

        return (
          <a
            aria-label={link.label}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] transition hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)]"
            href={link.href || "#"}
            key={link.title}
            rel="noopener noreferrer"
            target="_blank"
            title={link.title}
          >
            <Icon aria-hidden={true} size={15} />
          </a>
        );
      })}
    </div>
  );
}

function CommitteeMemberCard({ member }: { member: PublicCommitteeAssignment }) {
  return (
    <article className="group flex h-full flex-col items-center rounded-[1.35rem] border border-[var(--border)] bg-[var(--card)] px-5 py-6 text-center shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
      <MemberAvatar name={member.displayName} size={64} src={member.avatarUrl} />
      <h3 className="mt-4 text-lg font-semibold leading-tight text-[var(--foreground)]">
        {member.displayName}
      </h3>
      <p className="mt-2 rounded-full border border-[var(--brand-blue)]/20 bg-[var(--brand-blue)]/10 px-3 py-1 text-xs font-semibold text-[var(--brand-blue)]">
        {member.roleTitle}
      </p>
      {member.roleTitleBn ? (
        <p className="mt-2 text-sm font-medium text-[var(--muted-foreground)]">
          {member.roleTitleBn}
        </p>
      ) : null}
      {member.jnuitsId ? (
        <Link
          className="mt-3 text-sm font-semibold text-[var(--brand-blue)] underline-offset-4 hover:underline"
          href={`/members/${encodeURIComponent(member.jnuitsId)}`}
        >
          {member.jnuitsId}
        </Link>
      ) : null}
      {member.departmentName ? (
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
          {member.departmentName}
        </p>
      ) : null}
      {member.bio ? (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted-foreground)]">
          {member.bio}
        </p>
      ) : null}
      <div className="mt-auto">
        <SocialLinks
          facebookUrl={member.facebookUrl}
          linkedinUrl={member.linkedinUrl}
          name={member.displayName}
          websiteUrl={member.websiteUrl}
        />
      </div>
    </article>
  );
}

function AdvisorCard({ advisor }: { advisor: PublicAdvisorProfile }) {
  const highlights = [...advisor.workExperience, ...advisor.publications].slice(0, 3);
  const displayName = [advisor.title, advisor.fullName].filter(Boolean).join(" ");
  const advisorTitle = advisor.isCurrent
    ? ADVISOR_LABELS[advisor.advisorType]
    : advisor.formerTitle || `Former ${ADVISOR_LABELS[advisor.advisorType]}`;
  const tenure = advisor.tenureDisplay ||
    `${formatDate(advisor.joinedOn)} - ${formatDate(advisor.leftOn)}`;

  return (
    <article className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <MemberAvatar name={advisor.fullName} size={58} src={advisor.avatarUrl} />
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight text-[var(--foreground)]">
            {displayName}
          </h3>
          <p className="mt-1 text-sm font-semibold text-[var(--brand-blue)]">
            {advisorTitle}
          </p>
          {advisor.advisorJnuitsId ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              {advisor.advisorJnuitsId}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {[advisor.designation, advisor.department].filter(Boolean).join(" · ") ||
              advisor.title ||
              "Jagannath University"}
          </p>
        </div>
      </div>
      {advisor.speech ? (
        <blockquote className="mt-5 border-l-2 border-[var(--brand-blue)]/30 pl-4 text-sm leading-7 text-[var(--muted-foreground)]">
          {advisor.speech}
        </blockquote>
      ) : advisor.bio ? (
        <p className="mt-5 text-sm leading-7 text-[var(--muted-foreground)]">
          {advisor.bio}
        </p>
      ) : null}
      {advisor.statusNote ? (
        <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm leading-6 text-[var(--muted-foreground)]">
          {advisor.statusNote}
        </p>
      ) : null}
      {highlights.length > 0 ? (
        <ul className="mt-4 grid gap-2 text-sm text-[var(--muted-foreground)]">
          {highlights.map((highlight) => (
            <li className="rounded-xl bg-[var(--muted)] px-3 py-2" key={highlight}>
              {highlight}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          {advisor.isCurrent ? "Current" : "Former"} · {tenure}
          {advisor.dateConfidence === "estimated" ? " · Estimated" : ""}
        </span>
        <div className="flex flex-wrap justify-end gap-2">
          {advisor.jnuProfileUrl ? (
            <a
              aria-label={`Open ${displayName}'s JnU profile`}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] px-3 text-xs font-semibold text-[var(--muted-foreground)] transition hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)]"
              href={advisor.jnuProfileUrl}
              rel="noopener noreferrer"
              target="_blank"
              title="JnU profile"
            >
              <ExternalLink aria-hidden={true} size={14} />
              JnU Profile
            </a>
          ) : null}
          <SocialLinks
            className="flex justify-end gap-2"
            facebookUrl={advisor.facebookUrl}
            linkedinUrl={advisor.linkedinUrl}
            name={displayName}
            websiteUrl={advisor.websiteUrl}
          />
        </div>
      </div>
    </article>
  );
}

function AdvisorGroup({
  advisors,
  title,
}: {
  advisors: PublicAdvisorProfile[];
  title: string;
}) {
  if (advisors.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          {title}
        </h3>
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {advisors.map((advisor) => (
          <AdvisorCard advisor={advisor} key={advisor.id} />
        ))}
      </div>
    </section>
  );
}

function RoleSection({
  assignments,
  roleCode,
}: {
  assignments: PublicCommitteeAssignment[];
  roleCode: string;
}) {
  const members = assignments.filter((assignment) => assignment.roleCode === roleCode);

  if (members.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          {members[0]?.roleTitle}
        </h2>
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((member) => (
          <CommitteeMemberCard key={member.id} member={member} />
        ))}
      </div>
    </section>
  );
}

function TermTimeline({ terms }: { terms: PublicCommitteeTerm[] }) {
  return (
    <section className="section-band">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-divider">Archive</p>
          <h2 className="section-title mt-4">Executive committee history</h2>
        </div>
        <p className="max-w-xl text-sm leading-7 text-[var(--muted-foreground)]">
          Historical terms are preserved as structured records. Estimated dates are
          clearly marked until official records are verified.
        </p>
      </div>
      <div className="mt-8 grid gap-3">
        {terms.map((term) => (
          <Link
            className="group grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--brand-blue)]/40 sm:grid-cols-[1fr_auto] sm:items-center"
            href={`/committee/${term.slug}`}
            key={term.id}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-[var(--foreground)]">{term.title}</h3>
                {term.isCurrent ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Current
                  </span>
                ) : null}
                {term.dateConfidence === "estimated" ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    Estimated dates
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {formatDate(term.startsOn)} - {formatDate(term.endsOn)}
              </p>
            </div>
            <span className="text-sm font-semibold text-[var(--brand-blue)]">
              Open roster →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function CommitteePage() {
  const directory = await getPublicCommitteeDirectory();
  const currentTerm = directory.currentTerm;
  const filledSeats = currentTerm?.assignments.length || 0;
  const currentAdvisors = directory.advisors.filter((advisor) => advisor.isCurrent);
  const formerAdvisors = directory.advisors.filter((advisor) => !advisor.isCurrent);

  return (
    <main className="shell py-12">
      <section className="glass-card overflow-hidden px-6 py-8 sm:px-8 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.75fr] lg:items-end">
          <div>
            <h1 className="section-title">Executive Committee & Advisors</h1>
            <p className="section-copy mt-5 max-w-2xl">
              Public roster for JnU IT Society leadership, advisor board, and
              committee history with member-linked identity records.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="metric-card">
              <UsersRound size={18} className="text-[var(--brand-blue)]" />
              <p className="metric-card__value mt-2">{filledSeats}</p>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Seats filled
              </p>
            </div>
            <div className="metric-card">
              <GraduationCap size={18} className="text-[var(--brand-blue)]" />
              <p className="metric-card__value mt-2">{directory.advisors.length}</p>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Advisors
              </p>
            </div>
            <div className="metric-card">
              <CalendarDays size={18} className="text-[var(--brand-blue)]" />
              <p className="metric-card__value mt-2">{directory.terms.length}</p>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Terms
              </p>
            </div>
          </div>
        </div>
      </section>

      {currentTerm ? (
        <section className="mt-8 section-band">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="section-divider">Current committee</p>
              <h2 className="section-title mt-4">{currentTerm.title}</h2>
              <p className="section-copy mt-4 max-w-3xl">
                {currentTerm.summary || "Current public executive committee roster."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-sm text-[var(--muted-foreground)]">
                <span className="detail-chip">
                  Tenure {formatDate(currentTerm.startsOn)} - {formatDate(currentTerm.endsOn)}
                </span>
                {currentTerm.electionDate ? (
                  <span className="detail-chip">
                    Election {formatDate(currentTerm.electionDate)}
                  </span>
                ) : null}
                <span className="detail-chip">
                  {filledSeats}/{currentTerm.targetExecutiveSlots} executive seats
                </span>
              </div>
            </div>
            <Link className="secondary-button" href={`/committee/${currentTerm.slug}`}>
              Open term page
            </Link>
          </div>

          {currentTerm.assignments.length > 0 ? (
            <div className="mt-8 grid gap-8">
              {ROLE_GROUPS.map((roleCode) => (
                <RoleSection
                  assignments={currentTerm.assignments}
                  key={roleCode}
                  roleCode={roleCode}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state mt-8">
              The current committee term is ready, but no public executive roster
              has been imported yet.
            </div>
          )}
        </section>
      ) : (
        <section className="mt-8 section-band">
          <div className="empty-state">
            Committee terms are prepared, but no public current committee is
            currently published.
          </div>
        </section>
      )}

      <section className="mt-8 section-band">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-divider">Advisor board</p>
            <h2 className="section-title mt-4">Advisors and mentor support</h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[var(--muted-foreground)]">
            Advisors are maintained separately from student/alumni members. Their
            tenure is based on joining and leaving dates, not executive committee
            terms.
          </p>
        </div>
        {directory.advisors.length > 0 ? (
          <div className="mt-8 grid gap-8">
            {ADVISOR_ORDER.map((advisorType) => (
              <AdvisorGroup
                advisors={currentAdvisors.filter(
                  (advisor) => advisor.advisorType === advisorType
                )}
                key={advisorType}
                title={ADVISOR_LABELS[advisorType]}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state mt-8">
            Advisor profiles will appear here once published by committee admins.
          </div>
        )}
      </section>

      {formerAdvisors.length > 0 ? (
        <section className="mt-8 section-band">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-divider">Former advisors</p>
              <h2 className="section-title mt-4">Advisor history</h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[var(--muted-foreground)]">
              Former Chief Advisors, Moderators/Mentors, and Honorable Advisors
              are preserved separately from executive committee terms.
            </p>
          </div>
          <div className="mt-8 grid gap-8">
            {ADVISOR_ORDER.map((advisorType) => (
              <AdvisorGroup
                advisors={formerAdvisors.filter(
                  (advisor) => advisor.advisorType === advisorType
                )}
                key={advisorType}
                title={`Former ${ADVISOR_LABELS[advisorType]}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-8">
        <TermTimeline terms={directory.terms} />
      </div>
    </main>
  );
}
