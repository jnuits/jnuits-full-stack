import { cookies } from "next/headers";

import { updateAdminProfileAction } from "@/app/admin/admin-profiles/actions";
import { AvatarUploadField } from "@/components/profile/avatar-upload-field";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import { requireAdminPermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type AdminProfileRecord = {
  id: string;
  admin_code: string;
  avatar_secure_url: string | null;
  display_name: string;
  email: string | null;
  is_active: boolean;
  title: string | null;
  updated_at: string;
  user_id: string;
};

type AdminRoleGrantRecord = {
  user_id: string;
  rbac_platform_roles:
    | { code?: string | null; display_name?: string | null }
    | { code?: string | null; display_name?: string | null }[]
    | null;
};

function resolveRoleRelation(relation: AdminRoleGrantRecord["rbac_platform_roles"]) {
  if (!relation) {
    return null;
  }

  if (Array.isArray(relation)) {
    return relation[0] || null;
  }

  return relation;
}

export const metadata = { title: "Admin Profiles | JnUITS Admin" };

export default async function AdminProfilesPage() {
  const auth = await requireAdminPermission("admin.admin_profiles.manage", {
    fallbackPath: "/admin",
  });
  const actorIsSuperAdmin = auth.user?.adminRole === "super_admin";
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);

  const { data: profileRows } = await flexibleAdmin
    .from("admin_profiles" as string)
    .select("id, user_id, admin_code, display_name, email, title, is_active, avatar_secure_url, updated_at")
    .order("updated_at", { ascending: false });

  const profiles = (profileRows || []) as AdminProfileRecord[];
  const userIds = profiles.map((profile) => profile.user_id);
  const { data: roleRows } =
    userIds.length > 0
      ? await flexibleAdmin
          .from("rbac_user_platform_roles" as string)
          .select("user_id, rbac_platform_roles(code, display_name)")
          .eq("scope", "admin")
          .is("revoked_at", null)
          .in("user_id", userIds)
      : { data: [] };
  const adminRoleByUserId = new Map(
    ((roleRows || []) as AdminRoleGrantRecord[])
      .map((grant) => {
        const role = resolveRoleRelation(grant.rbac_platform_roles);
        return [
          grant.user_id,
          {
            code: role?.code || null,
            displayName: role?.display_name || role?.code || "Admin",
          },
        ] as const;
      })
      .filter((entry): entry is readonly [string, { code: string; displayName: string }] =>
        Boolean(entry[1].code)
      )
  );
  const visibleProfiles = actorIsSuperAdmin
    ? profiles
    : profiles.filter(
        (profile) => adminRoleByUserId.get(profile.user_id)?.code !== "super_admin"
      );

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Admin Profiles</p>
          <h1 className="admin-page-header__title">Admin identity records</h1>
          <p className="admin-page-header__desc">
            Private admin profile metadata is managed separately from public member records.
          </p>
        </div>
        <span className="status-pill">{visibleProfiles.length} visible</span>
      </div>

      {flash ? (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Operator feedback
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[-0.03em]">
            {flash.title}
          </h2>
          <p className="section-copy mt-2">{flash.message}</p>
        </section>
      ) : null}

      <section className="section-band">
        <div className="grid gap-4">
          {visibleProfiles.length === 0 ? (
            <div className="empty-state">No admin profiles are visible to this account.</div>
          ) : (
            visibleProfiles.map((profile) => {
              const role = adminRoleByUserId.get(profile.user_id);
              const isSuperAdmin = role?.code === "super_admin";
              const canEdit = actorIsSuperAdmin || !isSuperAdmin;

              return (
                <article key={profile.id} className="application-card">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.7fr)]">
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-wrap items-start gap-3">
                          <AvatarUploadField
                            canUpload={canEdit}
                            compact
                            currentUrl={profile.avatar_secure_url}
                            displayName={profile.display_name}
                            targetId={profile.id}
                            targetType="admin_profile"
                          />
                          <div className="min-w-0">
                          <h2 className="font-[family-name:var(--font-heading)] text-[1.7rem] leading-[0.98] tracking-[-0.04em]">
                            {profile.display_name}
                          </h2>
                          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                            {profile.admin_code} • {profile.email || "No email"}
                          </p>
                          </div>
                        </div>
                        <span className="status-pill">
                          {profile.is_active ? "active" : "inactive"}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="detail-chip">
                          {role?.displayName || profile.title || "Admin"}
                        </span>
                        {isSuperAdmin ? (
                          <span className="detail-chip">Super admin</span>
                        ) : null}
                        <span className="detail-chip">
                          Updated {profile.updated_at.slice(0, 10)}
                        </span>
                      </div>
                    </div>

                    <form action={updateAdminProfileAction} className="grid gap-2">
                      <input name="adminProfileId" type="hidden" value={profile.id} />
                      <label className="input-label">
                        Display name
                        <input
                          defaultValue={profile.display_name}
                          disabled={!canEdit}
                          name="displayName"
                          required
                        />
                      </label>
                      <label className="input-label">
                        Title
                        <input
                          defaultValue={profile.title || ""}
                          disabled={!canEdit}
                          name="title"
                          placeholder="Admin title"
                        />
                      </label>
                      <label className="input-label">
                        Status
                        <select
                          defaultValue={profile.is_active ? "true" : "false"}
                          disabled={!canEdit}
                          name="isActive"
                        >
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      </label>
                      <button className="secondary-button" disabled={!canEdit} type="submit">
                        Save admin profile
                      </button>
                    </form>
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
