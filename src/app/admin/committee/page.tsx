import { cookies } from "next/headers";
import {
  rolloverCommitteeTerm,
  saveCommitteeAssignment,
  saveCommitteeTerm,
} from "@/app/admin/committee/actions";
import {
  ADMIN_FLASH_COOKIE_NAME,
  parseAdminFlash,
} from "@/lib/admin/flash";
import { createAdminClient } from "@/lib/supabase/admin";

type CommitteeTermRecord = {
  created_at: string;
  ends_on: string | null;
  id: string;
  is_public: boolean;
  rollover_source_term_id: string | null;
  slug: string;
  starts_on: string;
  status: string;
  summary: string | null;
  title: string;
};

type CommitteeRoleRecord = {
  code: string;
  id: string;
  is_executive: boolean;
  sort_order: number;
  title: string;
};

type MemberOption = {
  email: string | null;
  full_name: string;
  id: string;
  jnuits_id: string;
};

type CommitteeAssignmentRecord = {
  id: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  display_name: string | null;
  sort_order: number;
  bio: string | null;
  committee_roles?:
    | { title?: string | null; code?: string | null }
    | { title?: string | null; code?: string | null }[]
    | null;
  members?:
    | {
        full_name?: string | null;
        designation?: string | null;
        current_organization?: string | null;
        jnuits_id?: string | null;
      }
    | {
        full_name?: string | null;
        designation?: string | null;
        current_organization?: string | null;
        jnuits_id?: string | null;
      }[]
    | null;
};

function resolveRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

export default async function AdminCommitteePage() {
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const flash = parseAdminFlash(
    cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value
  );

  const [termsResult, rolesResult, membersResult] = await Promise.all([
    admin
      .from("committee_terms")
      .select(
        "id, slug, title, summary, starts_on, ends_on, status, is_public, created_at, rollover_source_term_id"
      )
      .order("starts_on", { ascending: false }),
    admin
      .from("committee_roles")
      .select("id, code, title, sort_order, is_executive")
      .order("sort_order", { ascending: true }),
    admin
      .from("members")
      .select("id, full_name, jnuits_id, email")
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const terms = (termsResult.data || []) as CommitteeTermRecord[];
  const roles = (rolesResult.data || []) as CommitteeRoleRecord[];
  const members = (membersResult.data || []) as MemberOption[];

  const termIds = terms.map((term) => term.id);
  const assignmentsResult =
    termIds.length > 0
      ? await admin
          .from("committee_assignments")
          .select(
            "id, term_id, display_name, bio, sort_order, starts_on, ends_on, status, committee_roles(title, code), members(full_name, designation, current_organization, jnuits_id)"
          )
          .in("term_id", termIds)
          .order("sort_order", { ascending: true })
      : { data: [] };

  const assignments = (assignmentsResult.data || []) as (CommitteeAssignmentRecord & {
    term_id: string;
  })[];

  const assignmentsByTerm = new Map<string, CommitteeAssignmentRecord[]>();

  for (const assignment of assignments) {
    const list = assignmentsByTerm.get(assignment.term_id) || [];
    list.push(assignment);
    assignmentsByTerm.set(assignment.term_id, list);
  }

  return (
    <div className="grid gap-8">
      <div>
        <div className="workspace-topbar">
          <span className="eyebrow">Committee and tenure</span>
          <span className="status-pill">Phase 07 roster tools live</span>
        </div>
        <h1 className="section-title text-[2.5rem]">
          Manage committee terms, role assignments, and tenure visibility
        </h1>
        <p className="section-copy mt-3">
          Committee data is now modeled as terms plus role assignments instead
          of route copy. This gives the public committee page a normalized
          source and gives operators a real tenure tool instead of a placeholder.
        </p>
      </div>

      {flash ? (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Operator feedback
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[-0.03em]">
            {flash.title}
          </h2>
          <p className="section-copy mt-2">{flash.message}</p>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Terms
          </p>
          <p className="metric-card__value mt-3">{terms.length}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Draft, upcoming, active, and archived terms now live in one table.
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Seeded roles
          </p>
          <p className="metric-card__value mt-3">{roles.length}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Committee positions are now normalized instead of embedded in page copy.
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Linked assignments
          </p>
          <p className="metric-card__value mt-3">{assignments.length}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Assignments can link to a real member or carry a display-only name.
          </p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
        <form action={saveCommitteeTerm} className="section-band grid gap-4">
          <div>
            <span className="eyebrow">Committee term</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              Create the next public or internal tenure window
            </h2>
          </div>
          <div className="portal-form-grid">
            <label className="input-label sm:col-span-2">
              Term title
              <input name="title" placeholder="Fifth Executive Committee" required />
            </label>
            <label className="input-label">
              Slug
              <input name="slug" placeholder="fifth-executive-committee" />
            </label>
            <label className="input-label">
              Status
              <select defaultValue="draft" name="status">
                <option value="draft">Draft</option>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="input-label">
              Starts on
              <input name="startsOn" type="date" required />
            </label>
            <label className="input-label">
              Ends on
              <input name="endsOn" type="date" />
            </label>
            <label className="input-label sm:col-span-2">
              Summary
              <textarea
                name="summary"
                placeholder="What this term represents publicly or operationally"
                rows={4}
              />
            </label>
            <label className="input-label sm:col-span-2">
              <span>Visibility</span>
              <select defaultValue="false" name="isPublic">
                <option value="false">Keep internal until ready</option>
                <option value="true">Expose on the public committee route</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="primary-button" type="submit">
              Save committee term
            </button>
          </div>
        </form>

        <form action={saveCommitteeAssignment} className="section-band grid gap-4">
          <div>
            <span className="eyebrow">Role assignment</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              Attach a member or named person to a term and role
            </h2>
          </div>
          <div className="portal-form-grid">
            <label className="input-label">
              Term
              <select name="termId" required>
                <option value="">Select a committee term</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-label">
              Role
              <select name="roleId" required>
                <option value="">Select a role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-label sm:col-span-2">
              Linked member
              <select name="memberId">
                <option value="">No linked member record</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name} • {member.jnuits_id}
                    {member.email ? ` • ${member.email}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-label sm:col-span-2">
              Display name override
              <input name="displayName" placeholder="Use only if no linked member exists" />
            </label>
            <label className="input-label">
              Starts on
              <input name="startsOn" type="date" />
            </label>
            <label className="input-label">
              Ends on
              <input name="endsOn" type="date" />
            </label>
            <label className="input-label">
              Status
              <select defaultValue="active" name="status">
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label className="input-label">
              Sort order
              <input defaultValue={100} min={1} name="sortOrder" type="number" />
            </label>
            <label className="input-label sm:col-span-2">
              Bio or note
              <textarea
                name="bio"
                placeholder="Public-facing committee note or internal operator context"
                rows={4}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="primary-button" type="submit">
              Save assignment
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form action={rolloverCommitteeTerm} className="section-band grid gap-4">
          <div>
            <span className="eyebrow">Tenure automation</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              Roll one committee term into the next without re-entering the roster
            </h2>
          </div>
          <p className="section-copy">
            This creates a new term, preserves lineage back to the source term,
            optionally carries active assignments, and saves a committee rollover
            report for operator evidence.
          </p>
          <div className="portal-form-grid">
            <label className="input-label sm:col-span-2">
              Source term
              <select name="sourceTermId" required>
                <option value="">Select a source term</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-label sm:col-span-2">
              New term title
              <input name="title" placeholder="Sixth Executive Committee" required />
            </label>
            <label className="input-label">
              Slug
              <input name="slug" placeholder="sixth-executive-committee" />
            </label>
            <label className="input-label">
              Status
              <select defaultValue="upcoming" name="status">
                <option value="draft">Draft</option>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
              </select>
            </label>
            <label className="input-label">
              Starts on
              <input name="startsOn" type="date" required />
            </label>
            <label className="input-label">
              Ends on
              <input name="endsOn" type="date" />
            </label>
            <label className="input-label sm:col-span-2">
              Summary override
              <textarea
                name="summary"
                placeholder="Leave blank to copy the source term summary."
                rows={4}
              />
            </label>
            <label className="input-label">
              New term visibility
              <select defaultValue="false" name="isPublic">
                <option value="false">Internal until ready</option>
                <option value="true">Public route enabled</option>
              </select>
            </label>
            <label className="input-label">
              Carry assignments
              <select defaultValue="true" name="carryAssignments">
                <option value="true">Clone active assignments</option>
                <option value="false">Create empty term</option>
              </select>
            </label>
            <label className="input-label">
              Carried assignment status
              <select defaultValue="planned" name="assignmentStatus">
                <option value="planned">Planned</option>
                <option value="active">Active</option>
              </select>
            </label>
            <label className="input-label">
              Close source term
              <select defaultValue="true" name="closeSourceTerm">
                <option value="true">Archive source term</option>
                <option value="false">Leave source unchanged</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="primary-button" type="submit">
              Run rollover
            </button>
          </div>
        </form>

        <article className="section-band">
          <span className="eyebrow">Rollover notes</span>
          <div className="mt-5 grid gap-3">
            <article className="route-tile">
              <h3>Lineage preserved</h3>
              <p>
                New terms and carried assignments retain source references so the
                history is auditable instead of being overwritten.
              </p>
            </article>
            <article className="route-tile">
              <h3>Operator evidence</h3>
              <p>
                Every rollover writes an operator report entry and an audit
                event so committee changes are traceable later.
              </p>
            </article>
            <article className="route-tile">
              <h3>Safer roster preparation</h3>
              <p>
                Carried assignments can start as planned, giving operators room
                to adjust the new term before it is exposed publicly.
              </p>
            </article>
          </div>
        </article>
      </section>

      <section className="section-band">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">Committee registry</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Stored terms and linked tenure assignments
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[var(--muted)]">
            Each term now owns its assignments. The public committee page will
            read from these rows when a term is marked public.
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          {terms.length === 0 ? (
            <div className="empty-state">
              No committee terms have been created yet. Start by saving the first
              tenure window above.
            </div>
          ) : (
            terms.map((term) => {
              const termAssignments = assignmentsByTerm.get(term.id) || [];

              return (
                <article key={term.id} className="application-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="eyebrow">{term.status}</span>
                        <span className="detail-chip">
                          {term.is_public ? "Public route enabled" : "Internal only"}
                        </span>
                      </div>
                      <h3 className="mt-4 font-[family-name:var(--font-heading)] text-[2rem] leading-[0.98] tracking-[-0.04em]">
                        {term.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                        {term.summary || "No summary saved yet."}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm text-[var(--muted)]">
                      <span className="detail-chip">Slug {term.slug}</span>
                      <span className="detail-chip">
                        {term.starts_on}
                        {term.ends_on ? ` • ${term.ends_on}` : ""}
                      </span>
                      {term.rollover_source_term_id ? (
                        <span className="detail-chip">Rolled over</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {termAssignments.length === 0 ? (
                      <div className="empty-state md:col-span-2 xl:col-span-3">
                        No assignments saved for this term yet.
                      </div>
                    ) : (
                      termAssignments.map((assignment) => {
                        const role = resolveRelation(assignment.committee_roles);
                        const member = resolveRelation(assignment.members);

                        return (
                          <article key={assignment.id} className="route-tile">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h3>{role?.title || "Committee role"}</h3>
                              <span className="status-pill">{assignment.status}</span>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-[var(--brand-blue)]">
                              {assignment.display_name ||
                                member?.full_name ||
                                "Unlinked committee member"}
                            </p>
                            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                              {member?.designation ||
                                member?.current_organization ||
                                assignment.bio ||
                                "No member subtitle or note saved yet."}
                            </p>
                            {member?.jnuits_id ? (
                              <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                                {member.jnuits_id}
                              </p>
                            ) : null}
                          </article>
                        );
                      })
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
