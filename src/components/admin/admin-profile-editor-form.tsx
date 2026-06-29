"use client";

import { updateAdminProfileAction } from "@/app/admin/admin-profiles/actions";
import { AvatarUploadField } from "@/components/profile/avatar-upload-field";

type AdminProfileEditorFormProps = {
  profile: {
    adminCode: string;
    avatarSecureUrl: null | string;
    canEdit: boolean;
    displayName: string;
    id: string;
    lifecycleLabel: string;
    title: null | string;
  };
};

export function AdminProfileEditorForm({
  profile,
}: AdminProfileEditorFormProps) {
  return (
    <div className="grid gap-4">
      <div className="rounded-[0.9rem] border border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_72%,var(--card))] p-3">
        <AvatarUploadField
          canUpload={profile.canEdit}
          compact
          currentUrl={profile.avatarSecureUrl}
          displayName={profile.displayName}
          showLegacyAvatar={false}
          targetId={profile.id}
          targetType="admin_profile"
        />
      </div>

      <form action={updateAdminProfileAction} className="grid gap-3">
        <input name="adminProfileId" type="hidden" value={profile.id} />

        <label
          className="input-label"
          htmlFor={`admin-profile-name-${profile.id}`}
        >
          Display name
          <input
            defaultValue={profile.displayName}
            disabled={!profile.canEdit}
            id={`admin-profile-name-${profile.id}`}
            name="displayName"
            required
          />
        </label>

        <label
          className="input-label"
          htmlFor={`admin-profile-title-${profile.id}`}
        >
          Title
          <input
            defaultValue={profile.title || ""}
            disabled={!profile.canEdit}
            id={`admin-profile-title-${profile.id}`}
            name="title"
            placeholder="Admin title"
          />
        </label>

        <div className="rounded-[0.9rem] border border-[var(--line)] bg-[var(--surface-2)] p-3">
          <p className="section-kicker">Lifecycle</p>
          <p className="mt-1 text-sm font-semibold tracking-[0]">
            {profile.lifecycleLabel}
          </p>
        </div>

        {!profile.canEdit ? (
          <p className="section-copy text-sm">
            This profile metadata is read-only for your admin role.
          </p>
        ) : null}

        <button
          className="admin-btn admin-btn--primary justify-center"
          disabled={!profile.canEdit}
          type="submit"
        >
          Save admin profile
        </button>
      </form>
    </div>
  );
}