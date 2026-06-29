import Link from "next/link";

import type { AdminProfileActivity } from "@/lib/admin/admin-profile-model";

type AdminProfileActivityListProps = {
  activities: AdminProfileActivity[];
  profileId: string;
  userId: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-BD", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLabel(value: string) {
  return value.replace(/[._-]+/g, " ");
}

function shortId(value?: null | string) {
  if (!value) {
    return "none";
  }
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

export function AdminProfileActivityList({
  activities,
  profileId,
  userId,
}: AdminProfileActivityListProps) {
  const actorHref = `/admin/audit?actor=${encodeURIComponent(userId)}`;
  const entityHref = `/admin/audit?entityType=admin_profile&q=${encodeURIComponent(profileId)}`;

  return (
    <section className="grid gap-3 rounded-[0.9rem] border border-[var(--line)] bg-[color-mix(in_oklab,var(--background)_72%,var(--card))] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-kicker">Recent activity</p>
          <h3 className="mt-1 font-[family-name:var(--font-heading)] text-xl font-semibold tracking-[0]">
            Audit and security context
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="admin-btn admin-btn--ghost"
            href={actorHref}
            prefetch={false}
          >
            Actor audit
          </Link>
          <Link
            className="admin-btn admin-btn--ghost"
            href={entityHref}
            prefetch={false}
          >
            Profile audit
          </Link>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="empty-state m-0 max-w-none py-6">
          No recent security or audit activity for this admin identity.
        </div>
      ) : (
        <div className="grid gap-2">
          {activities.map((activity) => (
            <article
              className="rounded-[0.8rem] border border-[var(--line)] bg-[var(--card)] p-3"
              key={`${activity.kind}-${activity.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold capitalize tracking-[0]">
                    {formatLabel(activity.label)}
                  </p>
                  <p className="section-copy mt-1 text-xs">
                    {formatDate(activity.createdAt)} / actor{" "}
                    {shortId(activity.actorUserId)}
                    {activity.kind === "security"
                      ? ` / target ${shortId(activity.targetUserId)}`
                      : ""}
                    {activity.kind === "audit"
                      ? ` / ${activity.entityType || "entity"} ${shortId(activity.entityId)}`
                      : ""}
                  </p>
                </div>
                <span className="status-pill capitalize">
                  {activity.kind === "security"
                    ? activity.severity || "security"
                    : "audit"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
