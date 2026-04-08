export default function AdminPage() {
  return (
    <div>
      <span className="eyebrow">Technical operator workspace</span>
      <h1 className="section-title mt-4 text-[2.5rem]">Admin queues, migration tooling, and protected operations.</h1>
      <p className="section-copy mt-3">
        This area is intended for technical moderators and admins. It can expose
        richer operational context than the member portal, but still centers the
        important queues: invitations, profile moderation, certificates, and
        migration evidence.
      </p>

      <div className="route-grid mt-8">
        <article className="route-tile" id="invitations">
          <h3>Invitation operations</h3>
          <p>Batch send, correction, resend, and claim-progress tracking land here in later phases.</p>
        </article>
        <article className="route-tile" id="moderation">
          <h3>Moderation queue</h3>
          <p>Workplace and profile update review stays explicit and auditable.</p>
        </article>
        <article className="route-tile" id="certificates">
          <h3>Certificates</h3>
          <p>Import reports, parity evidence, and recovery tooling stay operator-facing.</p>
        </article>
        <article className="route-tile" id="reconcile">
          <h3>Reconcile + CSV onboarding</h3>
          <p>Dry-run and apply workflows will replace the legacy scripts with deterministic reports.</p>
        </article>
      </div>
    </div>
  );
}
