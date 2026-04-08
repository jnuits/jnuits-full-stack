import { RoutePanel } from "@/components/marketing/route-panel";

export default function NoticesPage() {
  return (
    <RoutePanel
      eyebrow="Operator publishing"
      title="Notices stay public, but publishing is moderated and audited."
      summary="This route is ready for the notices collection that will replace the legacy Strapi proxy. The unified app keeps public readability while moving draft/publish controls into the privileged operator surface."
      highlights={[
        "Public notice visibility will be controlled by explicit content status.",
        "Download and file-attachment handling will use safe storage metadata rather than opaque proxying.",
        "Publishing actions will be tied to RBAC and audit events.",
      ]}
    />
  );
}
