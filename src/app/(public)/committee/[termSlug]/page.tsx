import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MemberAvatar } from "@/components/members/member-avatar";
import type { PublicCommitteeAssignment } from "@/lib/committee/public-contracts";
import { getPublicCommitteeTermByIdentifier } from "@/lib/committee/public";
import { groupCommitteeAssignmentsByPosition } from "@/lib/committee-utils";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ termSlug: string }>;
}): Promise<Metadata> {
  const { termSlug } = await params;
  const term = await getPublicCommitteeTermByIdentifier(termSlug);

  if (!term) {
    return {
      title: "Committee term not found | JnU IT Society",
    };
  }

  return {
    title: `${term.title} | JnU IT Society`,
    description:
      term.summary ||
      `Public roster for ${term.title} of Jagannath University IT Society.`,
    openGraph: {
      title: `${term.title} | JnU IT Society`,
      description:
        term.summary ||
        `Public roster for ${term.title} of Jagannath University IT Society.`,
      type: "website",
    },
  };
}

function CommitteeMemberRow({ member }: { member: PublicCommitteeAssignment }) {
  return (
    <article className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <MemberAvatar name={member.displayName} size={54} src={member.avatarUrl} />
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-[var(--foreground)]">
          {member.displayName}
        </h2>
        <p className="mt-1 text-sm font-semibold text-[var(--brand-blue)]">
          {member.roleTitle}
          {member.roleTitleBn ? ` · ${member.roleTitleBn}` : ""}
        </p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {[member.jnuitsId, member.departmentName].filter(Boolean).join(" · ")}
        </p>
      </div>
      {member.jnuitsId ? (
        <Link
          className="secondary-button justify-center"
          href={`/members/${encodeURIComponent(member.jnuitsId)}`}
        >
          Profile
        </Link>
      ) : null}
    </article>
  );
}

function RoleSection({
  label,
  members,
}: {
  label: string;
  members: PublicCommitteeAssignment[];
}) {
  if (members.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        {label}
      </h2>
      <div className="grid gap-3">
        {members.map((member) => (
          <CommitteeMemberRow key={member.id} member={member} />
        ))}
      </div>
    </section>
  );
}

export default async function CommitteeTermPage({
  params,
}: {
  params: Promise<{ termSlug: string }>;
}) {
  const { termSlug } = await params;
  const term = await getPublicCommitteeTermByIdentifier(termSlug);

  if (!term) {
    notFound();
  }

  const positionGroups = groupCommitteeAssignmentsByPosition(term.assignments);

  return (
    <main className="shell py-12">
      <section className="glass-card overflow-hidden px-6 py-8 sm:px-8">
        <Link className="queue-link" href="/committee">
          ← Back to committee archive
        </Link>
        <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="section-title">{term.title}</h1>
            <p className="section-copy mt-5 max-w-3xl">
              {term.summary ||
                "Public executive committee roster for Jagannath University IT Society."}
            </p>
          </div>
          <div className="grid gap-2 text-sm text-[var(--muted-foreground)]">
            <span className="detail-chip">
              Tenure {formatDate(term.startsOn)} - {formatDate(term.endsOn)}
            </span>
            {term.electionDate ? (
              <span className="detail-chip">
                Election {formatDate(term.electionDate)}
              </span>
            ) : null}
            <span className="detail-chip">
              {term.assignments.length}/{term.targetExecutiveSlots} seats filled
            </span>
            {term.dateConfidence === "estimated" ? (
              <span className="detail-chip">Estimated dates</span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-8 section-band">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-divider">Executive roster</p>
            <h2 className="section-title mt-4">Committee assignments</h2>
          </div>
          {term.voterRuleNote ? (
            <p className="max-w-xl text-sm leading-7 text-[var(--muted-foreground)]">
              {term.voterRuleNote}
            </p>
          ) : null}
        </div>

        {term.assignments.length > 0 ? (
          <div className="mt-8 grid gap-7">
            {positionGroups.map((group) => (
              <RoleSection
                key={group.key}
                label={group.label}
                members={group.assignments}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state mt-8">
            No public executive assignments have been imported for this term yet.
          </div>
        )}
      </section>
    </main>
  );
}
