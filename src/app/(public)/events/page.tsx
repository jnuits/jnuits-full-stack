import { RoutePanel } from "@/components/marketing/route-panel";

export default function EventsPage() {
  return (
    <RoutePanel
      eyebrow="Public parity"
      title="Events will move into Supabase-backed content collections."
      summary="This surface is scaffolded so the route is stable during the migration. Event listings, featured cards, and detail pages will connect to the new `events` model in the public content phase."
      highlights={[
        "SEO-safe route already exists for Vercel previews and cutover testing.",
        "Data source shifts from Strapi proxying to direct Supabase reads behind RLS-safe policies.",
        "Media handling will move to Cloudinary-backed metadata in the content/media phase.",
      ]}
    />
  );
}
