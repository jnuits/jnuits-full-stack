import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  UserRound,
  Users,
  Vote,
} from "lucide-react";

import { MemberAvatar } from "@/components/members/member-avatar";
import type {
  PublicCommitteeAssignment,
  PublicCommitteeTerm,
} from "@/lib/committee/public";
import { formatCommitteeDate } from "@/lib/committee-utils";

const ROLE_GROUPS = [
  {
    columns: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    label: "Leadership",
    roles: [
      "president",
      "vice-president",
      "general-secretary",
      "assistant-general-secretary",
    ],
  },
  {
    columns: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    label: "Secretaries",
    roles: [
      "organizing-secretary",
      "treasurer",
      "office-secretary",
      "workshop-secretary",
      "it-secretary",
      "publication-secretary",
      "public-relations-secretary",
      "education-research-secretary",
      "international-secretary",
    ],
  },
  {
    columns: "grid-cols-1 sm:grid-cols-3 lg:grid-cols-4",
    label: "Executive Members",
    roles: ["executive-member"],
  },
];

export function CurrentCommitteeSection({
  term,
}: {
  term: null | PublicCommitteeTerm;
}) {
  if (!term) {
    return (
      <section id="current-committee">
        <SectionHeading
          eyebrow="Current committee"
          title="No current committee is published"
        />
        <PendingRoster
          description="Committee terms are prepared, but no public current executive committee is currently published."
          href="/committee"
          title="Current committee details will appear here"
        />
      </section>
    );
  }

  const seatsFilled = term.assignments.length;

  return (
    <section id="current-committee">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="Current committee"
          title={term.title}
          description={term.summary || "Current executive committee of JnU IT Society."}
        />
        <Link
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          href={`/committee/${term.slug}`}
        >
          Open term page
          <ArrowUpRight aria-hidden="true" size={12} />
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <InfoChip icon={CalendarDays}>
          Tenure: {formatCommitteeDate(term.startsOn)} - {formatCommitteeDate(term.endsOn)}
        </InfoChip>
        {term.electionDate ? (
          <InfoChip icon={Vote}>
            Election: {formatCommitteeDate(term.electionDate)}
          </InfoChip>
        ) : null}
        <InfoChip icon={Users}>
          {seatsFilled}/{term.targetExecutiveSlots} executive seats
        </InfoChip>
      </div>

      {term.assignments.length > 0 ? (
        <div className="mt-10">
          {ROLE_GROUPS.map((group) => (
            <RoleGroup
              assignments={term.assignments}
              columns={group.columns}
              key={group.label}
              label={group.label}
              roleCodes={group.roles}
            />
          ))}
        </div>
      ) : (
        <PendingRoster
          description={`The committee term is configured and verified with election date ${
            term.electionDate ? formatCommitteeDate(term.electionDate) : "on record"
          }. The public roster will be published once member-linked executive assignments are imported and validated.`}
          href={`/committee/${term.slug}`}
          title="The 6th Executive Committee roster will be published soon"
        />
      )}
    </section>
  );
}

function SectionHeading({
  description,
  eyebrow,
  title,
}: {
  description?: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function InfoChip({
  children,
  icon: Icon,
}: {
  children: ReactNode;
  icon: typeof CalendarDays;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
      <Icon aria-hidden="true" size={12} />
      {children}
    </span>
  );
}

function PendingRoster({
  description,
  href,
  title,
}: {
  description: string;
  href: string;
  title: string;
}) {
  return (
    <div className="mt-10 rounded-3xl border border-dashed border-border/60 bg-gradient-to-b from-muted/30 to-muted/10 px-8 py-20 text-center">
      <PodiumSeal />
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary/70">
        Roster Pending
      </p>
      <h3 className="mx-auto max-w-2xl text-2xl font-bold text-foreground">
        {title}
      </h3>
      <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-muted-foreground">
        {description}
      </p>
      <div className="mt-8 flex justify-center">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          href={href}
        >
          Open term shell
        </Link>
      </div>
      <p className="mt-6 text-xs text-muted-foreground/60">
        Members elected July 7, 2025 - 21 executive seats
      </p>
    </div>
  );
}

function PodiumSeal() {
  const angles = [0, 60, 120, 180, 240, 300];

  return (
    <svg
      aria-hidden="true"
      className="mx-auto mb-6 text-primary"
      fill="none"
      height="80"
      viewBox="0 0 80 80"
      width="80"
    >
      <circle
        cx="40"
        cy="40"
        fill="currentColor"
        fillOpacity="0.04"
        r="38"
        stroke="currentColor"
        strokeOpacity="0.15"
      />
      <circle
        cx="40"
        cy="40"
        fill="currentColor"
        fillOpacity="0.04"
        r="28"
        stroke="currentColor"
        strokeOpacity="0.2"
      />
      <circle
        cx="40"
        cy="40"
        fill="currentColor"
        fillOpacity="0.08"
        r="18"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      {angles.map((degree) => {
        const radians = (degree * Math.PI) / 180;
        return (
          <line
            key={degree}
            stroke="currentColor"
            strokeLinecap="round"
            strokeOpacity="0.5"
            strokeWidth="2"
            x1="40"
            x2={40 + 10 * Math.cos(radians)}
            y1="40"
            y2={40 + 10 * Math.sin(radians)}
          />
        );
      })}
      <path
        d="M30 48h20M32 44h16M34 38v6M40 38v6M46 38v6M31 34l9-6 9 6M34 34h12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.55"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function RoleGroup({
  assignments,
  columns,
  label,
  roleCodes,
}: {
  assignments: PublicCommitteeAssignment[];
  columns: string;
  label: string;
  roleCodes: string[];
}) {
  const members = assignments.filter((assignment) =>
    roleCodes.includes(assignment.roleCode)
  );

  if (members.length === 0) return null;

  return (
    <div className="mt-12 first:mt-0">
      <div className="mb-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <h3 className="px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </h3>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className={`grid gap-4 ${columns}`}>
        {members.map((member) => (
          <ExecutiveCard key={member.id} member={member} />
        ))}
      </div>
    </div>
  );
}

function ExecutiveCard({ member }: { member: PublicCommitteeAssignment }) {
  return (
    <article className="group relative rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm">
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-primary/70">
        {member.roleTitle}
      </p>
      <MemberAvatar name={member.displayName} size={48} src={member.avatarUrl} />
      <h4 className="mt-3 text-base font-bold text-foreground">{member.displayName}</h4>
      {member.jnuitsId ? (
        <p className="mt-1 font-mono text-xs text-muted-foreground/70">
          {member.jnuitsId}
        </p>
      ) : null}
      {member.departmentName ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {member.departmentName}
        </p>
      ) : null}
      <div className="mt-4 border-t border-border/50 pt-4">
        {member.jnuitsId ? (
          <Link
            className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-primary opacity-100 transition hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:opacity-0 sm:group-hover:opacity-100"
            href={`/members/${encodeURIComponent(member.jnuitsId)}`}
          >
            View profile
            <ArrowRight aria-hidden="true" size={10} />
          </Link>
        ) : (
          <span className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground">
            <UserRound aria-hidden="true" size={10} />
            Historical record
          </span>
        )}
      </div>
    </article>
  );
}
