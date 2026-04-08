import { RoutePanel } from "@/components/marketing/route-panel";

export default function CommitteePage() {
  return (
    <RoutePanel
      eyebrow="Committee history"
      title="Committee, tenure, and role history will be rebuilt from normalized domain tables."
      summary="The committee route is reserved for the new tenure-driven directory and timeline context. Current, former, and future-tenure workflows will be implemented in the later operator phase but the public route is already stable."
      highlights={[
        "Legacy advisory and fifth committee data become migration inputs, not final schema design.",
        "Future-tenure and renewal workflows are treated as operational features, not just display data.",
        "Public pages will consume normalized committee, tenure, and role assignment reads.",
      ]}
    />
  );
}
