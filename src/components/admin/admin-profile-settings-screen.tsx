import Link from "next/link";
import { getAdminSettingsSnapshot } from "@/lib/admin/settings";
import { BadgeCheck, BellRing, ShieldCheck, UserCog } from "lucide-react";

function formatDate(value: null | string | undefined) {
  if (!value) {
    return "Unavailable";
  }

  return new Date(value).toLocaleString("en-BD", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function AdminProfileSettingsScreen() {
  const snapshot = await getAdminSettingsSnapshot();

  if (!snapshot) {
    return null;
  }

  return (
    <section className="grid gap-6">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin settings</p>
          <h1 className="admin-page-header__title">Profile Settings</h1>
          <p className="admin-page-header__desc">
            Current admin identity, linked member context, and the claims
            currently shaping this operator session.
          </p>
        </div>
        <span className="status-pill w-fit">
          {snapshot.auth.adminRole?.replaceAll("_", " ") || "admin"}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <article className="glass-card grid gap-4 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-[var(--line)] bg-[var(--surface-2)] p-3">
              <UserCog size={16} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Auth identity
              </p>
              <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[-0.03em]">
                {snapshot.authUser?.user_metadata?.display_name ||
                  snapshot.linkedMember?.full_name ||
                  snapshot.auth.email ||
                  "Admin account"}
              </h2>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Primary email</p>
              <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                {snapshot.auth.email || "Unavailable"}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Session role</p>
              <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                {snapshot.auth.adminRole?.replaceAll("_", " ") || "Unavailable"}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Role version</p>
              <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                {snapshot.auth.roleVersion ?? "Unavailable"}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Last sign-in</p>
              <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                {formatDate(snapshot.authUser?.last_sign_in_at)}
              </p>
            </div>
          </div>
        </article>

        <article className="glass-card grid gap-4 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-[var(--line)] bg-[var(--surface-2)] p-3">
              <BadgeCheck size={16} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Linked member record
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">
                This is the member record currently attached to the signed-in auth user.
              </p>
            </div>
          </div>

          {snapshot.linkedMember ? (
            <div className="grid gap-3">
              <div className="portal-info-row">
                <span className="portal-info-row__label">Member name</span>
                <span className="portal-info-row__value">
                  {snapshot.linkedMember.full_name}
                </span>
              </div>
              <div className="portal-info-row">
                <span className="portal-info-row__label">JnUITS ID</span>
                <span className="portal-info-row__value">
                  {snapshot.linkedMember.jnuits_id}
                </span>
              </div>
              <div className="portal-info-row">
                <span className="portal-info-row__label">Member type</span>
                <span className="portal-info-row__value">
                  {snapshot.linkedMember.member_type || "Unavailable"}
                </span>
              </div>
            </div>
          ) : (
            <p className="section-copy">
              No linked member record is attached to this admin account.
            </p>
          )}
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)]">
        <article className="glass-card grid gap-4 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-[var(--line)] bg-[var(--surface-2)] p-3">
              <ShieldCheck size={16} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Active assignments
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">
                Visible role assignments resolved through current RBAC policies.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {snapshot.roleAssignments.map((assignment, index) => (
              <div key={`${assignment.scope}-${assignment.roleCode}-${index}`} className="portal-info-row">
                <span className="portal-info-row__label">
                  {assignment.scope}
                </span>
                <span className="portal-info-row__value">
                  {assignment.roleDisplayName || assignment.roleCode || "Unavailable"}
                </span>
              </div>
            ))}
            {snapshot.roleAssignments.length === 0 ? (
              <p className="section-copy">
                No active role assignments were visible for this account.
              </p>
            ) : null}
          </div>
        </article>

        <article className="glass-card grid gap-4 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-[var(--line)] bg-[var(--surface-2)] p-3">
              <BellRing size={16} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Settings shortcuts
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">
                Jump directly into MFA, password, and delivery controls.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="primary-button" href="/admin/settings/security">
              Security settings
            </Link>
            <Link className="secondary-button" href="/admin/settings/notifications">
              Notification settings
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
