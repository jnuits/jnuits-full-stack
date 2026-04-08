import type { Database } from "@/lib/db/types";
import {
  fallbackDeveloperCredits,
  fallbackPublicBlogs,
  fallbackPublicEvents,
  fallbackPublicGallery,
  fallbackPublicNotices,
} from "@/lib/content/public-content";
import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient<Database>;

function exactCount(result: { count: number | null } | null | undefined) {
  return typeof result?.count === "number" ? result.count : 0;
}

export async function buildOperationalSnapshot(admin: AdminClient) {
  const [
    pendingApplications,
    activeInvitations,
    pendingWorkplaceRequests,
    pendingProfileChangeRequests,
    totalMembers,
    totalAuditEvents,
    activeCommitteeTerms,
    activeCommitteeAssignments,
    publishedBlogs,
    publishedEvents,
    publishedNotices,
    publishedGalleryEntries,
    publishedDeveloperProfiles,
    mediaAssets,
  ] = await Promise.all([
    admin
      .from("membership_applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("member_invitations")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .is("revoked_at", null),
    admin
      .from("profile_update_requests")
      .select("*", { count: "exact", head: true })
      .eq("request_type", "workplace_update")
      .eq("status", "pending"),
    admin
      .from("profile_update_requests")
      .select("*", { count: "exact", head: true })
      .eq("request_type", "profile_change")
      .eq("status", "pending"),
    admin.from("members").select("*", { count: "exact", head: true }),
    admin.from("audit_events").select("*", { count: "exact", head: true }),
    admin
      .from("committee_terms")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    admin
      .from("committee_assignments")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    admin
      .from("content_posts")
      .select("*", { count: "exact", head: true })
      .eq("content_type", "blog")
      .eq("status", "published"),
    admin
      .from("content_posts")
      .select("*", { count: "exact", head: true })
      .eq("content_type", "event")
      .eq("status", "published"),
    admin
      .from("content_posts")
      .select("*", { count: "exact", head: true })
      .eq("content_type", "notice")
      .eq("status", "published"),
    admin
      .from("gallery_entries")
      .select("*", { count: "exact", head: true })
      .eq("status", "published"),
    admin
      .from("developer_profiles")
      .select("*", { count: "exact", head: true })
      .eq("status", "published"),
    admin.from("media_assets").select("*", { count: "exact", head: true }),
  ]);

  const fallbackDeveloperCount =
    1 + fallbackDeveloperCredits.team.length;

  return {
    operations: {
      activeCommitteeAssignments: exactCount(activeCommitteeAssignments),
      activeCommitteeTerms: exactCount(activeCommitteeTerms),
      activeInvitations: exactCount(activeInvitations),
      auditEvents: exactCount(totalAuditEvents),
      members: exactCount(totalMembers),
      pendingApplications: exactCount(pendingApplications),
      pendingProfileChangeRequests: exactCount(pendingProfileChangeRequests),
      pendingWorkplaceRequests: exactCount(pendingWorkplaceRequests),
    },
    content: {
      mediaAssets: exactCount(mediaAssets),
      publishedBlogs: exactCount(publishedBlogs),
      publishedDevelopers: exactCount(publishedDeveloperProfiles),
      publishedEvents: exactCount(publishedEvents),
      publishedGalleryEntries: exactCount(publishedGalleryEntries),
      publishedNotices: exactCount(publishedNotices),
    },
    parity: {
      blogsRemaining: Math.max(
        0,
        fallbackPublicBlogs.length - exactCount(publishedBlogs)
      ),
      developersRemaining: Math.max(
        0,
        fallbackDeveloperCount - exactCount(publishedDeveloperProfiles)
      ),
      eventsRemaining: Math.max(
        0,
        fallbackPublicEvents.length - exactCount(publishedEvents)
      ),
      galleryRemaining: Math.max(
        0,
        fallbackPublicGallery.length - exactCount(publishedGalleryEntries)
      ),
      noticesRemaining: Math.max(
        0,
        fallbackPublicNotices.length - exactCount(publishedNotices)
      ),
    },
  };
}
