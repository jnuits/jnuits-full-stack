import { RoutePanel } from "@/components/marketing/route-panel";

export default function AboutPage() {
  return (
    <RoutePanel
      eyebrow="Why this rebuild"
      title="The goal is operationally simpler, safer, and easier for real users."
      summary="The legacy stack already proved the domain model. This rebuild collapses the public site, secure member flows, and operator tooling into one audited platform without dragging non-technical members into an unsafe admin experience."
      highlights={[
        "Public content, certificates, committee history, and directory parity stay visible.",
        "Moderators and admins get a technical workspace, but committee members author only through the safe portal surface.",
        "Security shifts from app-layer guesswork to SQL constraints, RLS, append-only audit trails, and explicit RBAC grants.",
      ]}
    />
  );
}
