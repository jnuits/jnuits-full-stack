import { RoutePanel } from "@/components/marketing/route-panel";

export default function DevelopersPage() {
  return (
    <RoutePanel
      eyebrow="Singleton content"
      title="Developer credits remain a public singleton route."
      summary="The legacy site exposed a dedicated development-team page. That remains in scope and will be migrated as a simple public content model once the site shell and content collections are wired."
      highlights={[
        "Public credits page remains routable from day one.",
        "Source data will move from singleton proxying to direct content reads.",
        "This page stays separate from operator/admin identity data.",
      ]}
    />
  );
}
