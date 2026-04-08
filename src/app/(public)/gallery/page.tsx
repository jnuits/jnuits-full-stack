import { RoutePanel } from "@/components/marketing/route-panel";

export default function GalleryPage() {
  return (
    <RoutePanel
      eyebrow="Media phase"
      title="Gallery migration is staged after certificates and the site shell."
      summary="The route exists now so navigation, previews, and deployment smoke tests are stable. Gallery data and asset metadata will be lifted into the unified content/media phase."
      highlights={[
        "Public media will be delivered through Cloudinary metadata.",
        "Private or operator-only files stay out of public delivery paths.",
        "The final route will preserve current public URLs during migration.",
      ]}
    />
  );
}
