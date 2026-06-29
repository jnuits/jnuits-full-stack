import type { ReactNode } from "react";

import { cookies } from "next/headers";
import Link from "next/link";
import {
  Filter,
  LockKeyhole,
  MailPlus,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldOff,
  Users,
} from "lucide-react";

import {
  changeAdminRoleAction,
  inviteAdminAction,
  revokeAdminInvitationAction,
  updateAdminLifecycleAction,
} from "@/app/admin/admin-profiles/actions";
import { AdminProfileActivityList } from "@/components/admin/admin-profile-activity-list";
import { AdminProfileEditorForm } from "@/components/admin/admin-profile-editor-form";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import {
  ADMIN_LIFECYCLE_LABELS,
  ADMIN_ROLE_LABELS,
  normalizeAdminRoleCode,
  type AdminAccountRoleCode,
} from "@/lib/admin/admin-account-policy";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import {
  parseAdminProfileFilters,
  type AdminAccountInvitation,
  type AdminProfileDirectoryProfile,
  type AdminProfileFilters,
  type AdminProfileStats,
} from "@/lib/admin/admin-profile-model";
import { loadAdminProfileDirectory } from "@/lib/admin/admin-profiles";
import { hasPermission, requireAdminUser } from "@/lib/auth/session";

export const metadata = { title: "Admin Accounts | JnUITS Admin" };

type SearchParams = Record<string, string | string[] | undefined>;

function formatDate(value: null | string | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-BD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function profileHref(
  filters: AdminProfileFilters,
  profileId: string,
  tab = filters.tab,
) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  params.set("tab", tab);
  params.set("profile", profileId);
  return `/admin/admin-profiles?${params.toString()}`;
}

function tabHref(filters: AdminProfileFilters, tab: AdminProfileFilters["tab"]) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  if (filters.profile) params.set("profile", filters.profile);
  params.set("tab", tab);
  return `/admin/admin-profiles?${params.toString()}`;
}


function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="route-tile min-h-0 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-[color-mix(in_oklab,var(--brand-blue)_10%,var(--card))] text-[var(--brand-blue)]">
          {icon}
        </span>
        <strong className="font-[family-name:var(--font-heading)] text-3xl leading-none tracking-[0]">
          {value}
        </strong>
      </div>
      <p className="section-copy mt-3 text-sm font-semibold">{label}</p>
    </div>
  );
}

function MetricsGrid({ stats }: { stats: AdminProfileStats }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard icon={<Users size={17} />} label="Total identities" value={stats.total} />
      <MetricCard icon={<ShieldCheck size={17} />} label="Active" value={stats.active} />
      <MetricCard icon={<MailPlus size={17} />} label="Pending invites" value={stats.pendingInvites} />
      <MetricCard icon={<LockKeyhole size={17} />} label="Frozen" value={stats.frozen} />
      <MetricCard icon={<ShieldOff size={17} />} label="Removed" value={stats.removed} />
    </section>
  );
}

function TabLink({
  active,
  children,
  href,
}: {
  active: boolean;
  children: ReactNode;
  href: string;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className="admin-editor-tabs__tab"
      href={href}
      role="tab"
      aria-selected={active}
      prefetch={false}
    >
      {children}
    </Link>
  );
}

function ProfileRow({
  filters,
  isSelected,
  profile,
}: {
  filters: AdminProfileFilters;
  isSelected: boolean;
  profile: AdminProfileDirectoryProfile;
}) {
  return (
    <Link
      aria-current={isSelected ? "page" : undefined}
      className={`grid gap-3 rounded-[0.9rem] border p-3 transition hover:border-[var(--brand-blue)] hover:bg-[color-mix(in_oklab,var(--brand-blue)_6%,var(--card))] ${
        isSelected
          ? "border-[var(--brand-blue)] bg-[color-mix(in_oklab,var(--brand-blue)_8%,var(--card))]"
          : "border-[var(--line)] bg-[var(--card)]"
      }`}
      href={profileHref(filters, profile.id)}
      prefetch={false}
    >
      <div className="flex min-w-0 items-start gap-3">
        <ProfileAvatar
          name={profile.displayName}
          size="sm"
          src={profile.avatarSecureUrl}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate font-semibold tracking-[0]">
                {profile.displayName}
              </h2>
              <p className="mt-1 truncate text-xs font-medium text-[var(--muted-foreground)]">
                {profile.adminCode} / {profile.email || "No email"}
              </p>
            </div>
            <span className="status-pill">{profile.lifecycleLabel}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profile.roles.length > 0 ? (
              profile.roles.map((role) => (
                <span className="detail-chip" key={role.code}>
                  {role.displayName}
                </span>
              ))
            ) : (
              <span className="detail-chip">No admin role</span>
            )}
            <span className="detail-chip">
              Updated {formatDate(profile.updatedAt)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function LinkedMemberSummary({ profile }: { profile: AdminProfileDirectoryProfile }) {
  if (!profile.linkedMember) {
    return (
      <div className="route-tile min-h-0 p-4">
        <p className="section-kicker">Linked member</p>
        <p className="section-copy mt-2 text-sm">
          No member profile is linked to this admin identity.
        </p>
      </div>
    );
  }

  return (
    <div className="route-tile min-h-0 p-4">
      <p className="section-kicker">Linked member</p>
      <div className="mt-3 grid gap-1 text-sm">
        <p className="font-semibold tracking-[0]">
          {profile.linkedMember.fullName || "Unnamed member"}
        </p>
        <p className="text-[var(--muted-foreground)]">
          {profile.linkedMember.jnuitsId || "No JnUITS ID"} / {" "}
          {profile.linkedMember.memberType || "No type"}
        </p>
        <p className="truncate text-[var(--muted-foreground)]">
          {profile.linkedMember.email || "No email"}
        </p>
      </div>
    </div>
  );
}

function InviteAdminPanel({
  allowedRoles,
}: {
  allowedRoles: AdminAccountRoleCode[];
}) {
  if (allowedRoles.length === 0) {
    return null;
  }

  return (
    <form action={inviteAdminAction} className="section-band grid gap-4">
      <div>
        <p className="section-divider">Invite admin</p>
        <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[0]">
          Send admin access invitation
        </h2>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="input-label">
          Email
          <input name="email" placeholder="admin@example.com" required type="email" />
        </label>
        <label className="input-label">
          Role
          <select name="roleCode" required>
            {allowedRoles.map((role) => (
              <option key={role} value={role}>
                {ADMIN_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>
        <label className="input-label">
          Display name
          <input name="displayName" placeholder="Admin display name" />
        </label>
        <label className="input-label">
          Title
          <input name="title" placeholder="Operational title" />
        </label>
      </div>
      <label className="input-label">
        Note
        <textarea name="note" placeholder="Reason or onboarding context" rows={3} />
      </label>
      <button className="admin-btn admin-btn--primary w-fit" type="submit">
        <MailPlus size={14} /> Send invitation
      </button>
    </form>
  );
}

function InvitationsPanel({
  allowedRoles,
  invitations,
}: {
  allowedRoles: AdminAccountRoleCode[];
  invitations: AdminAccountInvitation[];
}) {
  return (
    <div className="grid gap-4">
      <InviteAdminPanel allowedRoles={allowedRoles} />
      <section className="section-band grid gap-4">
        <div>
          <p className="section-divider">Invitations</p>
          <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[0]">
            Admin invitation queue
          </h2>
        </div>
        {invitations.length === 0 ? (
          <div className="empty-state m-0 max-w-none py-8">
            No admin invitations are visible for your role.
          </div>
        ) : (
          <div className="grid gap-2">
            {invitations.map((invitation) => (
              <article className="route-tile min-h-0 p-4" key={invitation.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold tracking-[0]">{invitation.email}</h3>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {ADMIN_ROLE_LABELS[invitation.invitedRoleCode]} / expires {formatDate(invitation.expiresAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="status-pill">{invitation.status}</span>
                    <span className="detail-chip">Delivery {invitation.deliveryStatus}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                    Sent {invitation.sendAttempts} time{invitation.sendAttempts === 1 ? "" : "s"}
                    {invitation.lastSentAt ? ` / last ${formatDate(invitation.lastSentAt)}` : ""}
                  </p>
                  {invitation.status === "pending" ? (
                    <form action={revokeAdminInvitationAction} className="flex flex-wrap items-center gap-2">
                      <input name="invitationId" type="hidden" value={invitation.id} />
                      <input
                        className="max-w-48"
                        name="confirmation"
                        placeholder={invitation.email}
                      />
                      <ConfirmSubmitButton
                        className="admin-btn admin-btn--danger"
                        confirmLabel="Revoke invitation"
                        description="This stops the pending admin invitation. It does not delete the auth user."
                        title="Revoke admin invitation?"
                      >
                        Revoke
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AccessControls({ profile }: { profile: AdminProfileDirectoryProfile }) {
  const canDoLifecycle =
    profile.capabilities.canFreeze ||
    profile.capabilities.canUnfreeze ||
    profile.capabilities.canRemove ||
    profile.capabilities.canChangeRole;

  if (!canDoLifecycle) {
    return (
      <div className="route-tile min-h-0 p-4">
        <p className="section-kicker">Access controls</p>
        <p className="section-copy mt-2 text-sm">
          No lifecycle or role-change actions are available for this identity.
        </p>
      </div>
    );
  }

  return (
    <div className="route-tile min-h-0 p-4">
      <p className="section-kicker">Access controls</p>
      <div className="mt-4 grid gap-4">
        {profile.capabilities.canChangeRole ? (
          <form action={changeAdminRoleAction} className="grid gap-3 rounded-[0.9rem] border border-[var(--line)] p-3">
            <input name="adminProfileId" type="hidden" value={profile.id} />
            <label className="input-label">
              Change role
              <select name="roleCode" required defaultValue={profile.primaryRole?.code || ""}>
                {profile.capabilities.allowedRoleTargets.map((role) => (
                  <option key={role} value={role}>
                    {ADMIN_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-label">
              Confirmation
              <input name="confirmation" placeholder={profile.adminCode} required />
            </label>
            <ConfirmSubmitButton
              className="admin-btn admin-btn--primary justify-center"
              confirmLabel="Change role"
              description="This revokes the current admin role grant and creates a new admin role grant for the selected role."
              title="Change admin role?"
            >
              Change role
            </ConfirmSubmitButton>
          </form>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {profile.capabilities.canFreeze ? (
            <form action={updateAdminLifecycleAction} className="grid gap-2 rounded-[0.9rem] border border-[var(--line)] p-3">
              <input name="adminProfileId" type="hidden" value={profile.id} />
              <input name="intent" type="hidden" value="freeze" />
              <input name="confirmation" placeholder={profile.adminCode} required />
              <ConfirmSubmitButton
                className="admin-btn admin-btn--danger justify-center"
                confirmLabel="Freeze account"
                description="This bans the Supabase Auth user and blocks existing admin sessions."
                title="Freeze admin account?"
              >
                Freeze
              </ConfirmSubmitButton>
            </form>
          ) : null}

          {profile.capabilities.canUnfreeze ? (
            <form action={updateAdminLifecycleAction} className="grid gap-2 rounded-[0.9rem] border border-[var(--line)] p-3">
              <input name="adminProfileId" type="hidden" value={profile.id} />
              <input name="intent" type="hidden" value="unfreeze" />
              <input name="confirmation" placeholder={profile.adminCode} required />
              <ConfirmSubmitButton
                className="admin-btn admin-btn--primary justify-center"
                confirmLabel="Unfreeze account"
                description="This removes the Supabase Auth ban and restores the admin profile to active."
                title="Unfreeze admin account?"
              >
                Unfreeze
              </ConfirmSubmitButton>
            </form>
          ) : null}

          {profile.capabilities.canRemove ? (
            <form action={updateAdminLifecycleAction} className="grid gap-2 rounded-[0.9rem] border border-[var(--line)] p-3 sm:col-span-2">
              <input name="adminProfileId" type="hidden" value={profile.id} />
              <input name="intent" type="hidden" value="remove" />
              <input name="confirmation" placeholder={profile.email || profile.adminCode} required />
              <ConfirmSubmitButton
                className="admin-btn admin-btn--danger justify-center"
                confirmLabel="Remove admin access"
                description="This revokes admin role grants and marks the admin identity removed. The Auth user and member profile are preserved."
                title="Remove admin access?"
              >
                Remove admin access
              </ConfirmSubmitButton>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProfileDetail({
  activities,
  profile,
}: {
  activities: React.ComponentProps<typeof AdminProfileActivityList>["activities"];
  profile: AdminProfileDirectoryProfile;
}) {
  return (
    <div className="section-band grid content-start gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <ProfileAvatar
            name={profile.displayName}
            size="md"
            src={profile.avatarSecureUrl}
          />
          <div className="min-w-0">
            <p className="section-kicker">Selected identity</p>
            <h2 className="mt-1 truncate font-[family-name:var(--font-heading)] text-3xl font-semibold leading-tight tracking-[0]">
              {profile.displayName}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {profile.adminCode} / {profile.email || "No email"}
            </p>
          </div>
        </div>
        <span className="status-pill">{profile.lifecycleLabel}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {profile.roles.map((role) => (
          <span className="detail-chip" key={role.code}>
            {role.displayName}
          </span>
        ))}
        <span className="detail-chip">Updated {formatDate(profile.updatedAt)}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(18rem,0.48fr)]">
        <div className="grid gap-4">
          <AdminProfileEditorForm
            profile={{
              adminCode: profile.adminCode,
              avatarSecureUrl: profile.avatarSecureUrl,
              canEdit: profile.canEdit,
              displayName: profile.displayName,
              id: profile.id,
              lifecycleLabel: profile.lifecycleLabel,
              title: profile.title,
            }}
          />
          <AccessControls profile={profile} />
        </div>
        <div className="grid content-start gap-4">
          <LinkedMemberSummary profile={profile} />
          <div className="route-tile min-h-0 p-4">
            <p className="section-kicker">Lifecycle state</p>
            <p className="mt-2 text-sm font-semibold tracking-[0]">
              {ADMIN_LIFECYCLE_LABELS[profile.lifecycleStatus]}
            </p>
            {profile.statusReason ? (
              <p className="section-copy mt-2 text-sm">{profile.statusReason}</p>
            ) : null}
            {profile.statusUpdatedAt ? (
              <p className="mt-3 text-xs font-semibold text-[var(--muted-foreground)]">
                Changed {formatDate(profile.statusUpdatedAt)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <AdminProfileActivityList
        activities={activities}
        profileId={profile.id}
        userId={profile.userId}
      />
    </div>
  );
}

export default async function AdminProfilesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const auth = await requireAdminUser({ fallbackPath: "/admin" });
  const actorUserId = auth.user?.id || "";
  const actorAdminRole = normalizeAdminRoleCode(auth.user?.adminRole);
  const canManageAdminRoles = await hasPermission("admin.roles.manage_admin");
  const resolvedSearchParams = await searchParams;
  const filters = parseAdminProfileFilters(resolvedSearchParams);
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const {
    actorInviteRoles,
    actorProfile,
    activities,
    filteredProfiles,
    invitations,
    profiles,
    roleOptions,
    selectedProfile,
    stats,
  } = await loadAdminProfileDirectory({
    actorAdminRole,
    actorUserId,
    canManageAdminRoles,
    filters,
  });
  const detailProfile = filters.tab === "self" ? actorProfile : selectedProfile;

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Admin Accounts</p>
          <h1 className="admin-page-header__title">Admin Identity &amp; Access</h1>
          <p className="admin-page-header__desc">
            Private admin metadata, invitations, lifecycle state, and governed role changes.
          </p>
        </div>
        <span className="status-pill">
          {filteredProfiles.length} of {profiles.length} shown
        </span>
      </div>

      {flash ? (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Operator feedback
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[0]">
            {flash.title}
          </h2>
          <p className="section-copy mt-2">{flash.message}</p>
        </section>
      ) : null}

      <MetricsGrid stats={stats} />

      <nav className="admin-editor-tabs" aria-label="Admin account views">
        <div className="admin-editor-tabs__list" role="tablist">
          <TabLink active={filters.tab === "self"} href={tabHref(filters, "self")}>
            My profile
          </TabLink>
          <TabLink active={filters.tab === "directory"} href={tabHref(filters, "directory")}>
            Directory
          </TabLink>
          <TabLink active={filters.tab === "invitations"} href={tabHref(filters, "invitations")}>
            Invitations
          </TabLink>
          <TabLink active={filters.tab === "access"} href={tabHref(filters, "access")}>
            Access changes
          </TabLink>
        </div>
      </nav>

      {filters.tab === "invitations" ? (
        <InvitationsPanel allowedRoles={actorInviteRoles} invitations={invitations} />
      ) : (
        <>
          {filters.tab !== "self" ? (
            <section className="section-band">
              <form action="/admin/admin-profiles" className="grid gap-4">
                <input name="tab" type="hidden" value={filters.tab} />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_minmax(12rem,0.45fr)_minmax(10rem,0.35fr)_auto]">
                  <label className="input-label">
                    Search identities
                    <div className="relative">
                      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                      <input className="pl-9" defaultValue={filters.q} name="q" placeholder="Name, email, admin code, member ID" />
                    </div>
                  </label>
                  <label className="input-label">
                    Role
                    <select defaultValue={filters.role} name="role">
                      <option value="">All roles</option>
                      {roleOptions.map((role) => (
                        <option key={role.code} value={role.code}>
                          {role.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="input-label">
                    Status
                    <select defaultValue={filters.status} name="status">
                      <option value="">All statuses</option>
                      <option value="active">Active</option>
                      <option value="pending_invite">Pending invite</option>
                      <option value="frozen">Frozen</option>
                      <option value="removed">Removed</option>
                      <option value="inactive">Inactive legacy</option>
                    </select>
                  </label>
                  <div className="flex items-end gap-2">
                    <button className="admin-btn admin-btn--primary" type="submit">
                      <Filter size={14} /> Apply
                    </button>
                    <Link className="admin-btn admin-btn--ghost" href={`/admin/admin-profiles?tab=${filters.tab}`}>
                      <RotateCcw size={14} /> Reset
                    </Link>
                  </div>
                </div>
              </form>
            </section>
          ) : null}

          <section className={filters.tab === "self" ? "grid gap-4" : "grid gap-4 xl:grid-cols-[minmax(22rem,0.72fr)_minmax(0,1fr)]"}>
            {filters.tab !== "self" ? (
              <div className="section-band grid content-start gap-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="section-divider">Directory</p>
                    <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[0]">
                      {filteredProfiles.length} admin identities
                    </h2>
                  </div>
                </div>

                {filteredProfiles.length === 0 ? (
                  <div className="empty-state m-0 max-w-none py-8">
                    No admin profiles match the current filters.
                  </div>
                ) : (
                  <div className="grid max-h-[calc(100vh-14rem)] gap-2 overflow-auto pr-1">
                    {filteredProfiles.map((profile) => (
                      <ProfileRow
                        filters={filters}
                        isSelected={selectedProfile?.id === profile.id}
                        key={profile.id}
                        profile={profile}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {detailProfile ? (
              <ProfileDetail activities={activities} profile={detailProfile} />
            ) : (
              <div className="section-band">
                <div className="empty-state m-0 max-w-none py-12">
                  Select an admin identity to inspect profile details and recent activity.
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}



