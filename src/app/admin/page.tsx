export default function AdminPage() {
  return (
    <div>
      <div className="workspace-topbar">
        <span className="eyebrow">Technical operator workspace</span>
        <span className="status-pill">Phases 07-08 not completed yet</span>
      </div>
      <h1 className="section-title text-[2.5rem]">Admin queues, migration tooling, and protected operations.</h1>
      <p className="section-copy mt-3">
        This area is intended for technical moderators and admins. It can expose
        richer operational context than the member portal, but still centers the
        important queues: invitations, profile moderation, certificates, and
        migration evidence.
      </p>

      <div className="route-grid mt-8">
        <article className="route-tile" id="invitations">
          <h3>Invitation operations</h3>
          <p>Batch send, correction, resend, and claim-progress tracking land here in the next operator pass.</p>
        </article>
        <article className="route-tile" id="moderation">
          <h3>Moderation queue</h3>
          <p>Workplace and profile update review stays explicit, auditable, and separate from member self-service.</p>
        </article>
        <article className="route-tile" id="certificates">
          <h3>Certificates</h3>
          <p>Import reports, parity evidence, verification recovery, and audit traces stay operator-facing.</p>
        </article>
        <article className="route-tile" id="reconcile">
          <h3>Reconcile + CSV onboarding</h3>
          <p>Dry-run and apply workflows will replace the legacy scripts with deterministic reports and archived evidence.</p>
        </article>
        <article className="route-tile">
          <h3>What this is not yet</h3>
          <p>The panel is now branded, but the deep queue mechanics are still coming in later implementation phases.</p>
        </article>
      </div>
    </div>
  );
}
