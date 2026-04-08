import { RoutePanel } from "@/components/marketing/route-panel";

export default function BlogsPage() {
  return (
    <RoutePanel
      eyebrow="Public content"
      title="Blogs are planned as published content, with portal drafting for members."
      summary="Published articles remain public, but ordinary committee and member authors draft from the portal rather than a broad admin screen. Moderation and publishing stay with privileged operators."
      highlights={[
        "Public listing route is reserved now for cutover-safe linking.",
        "Drafting will live in `/portal/blogs` with role-limited access.",
        "Publishing and moderation will stay in `/admin` with audit coverage.",
      ]}
    />
  );
}
