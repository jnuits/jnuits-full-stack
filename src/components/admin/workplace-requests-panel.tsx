import {
  approveWorkplaceUpdateRequest,
  rejectWorkplaceUpdateRequest,
} from "@/app/admin/actions";
import { getWorkplacePayloadEntries } from "@/lib/members/workplace-payload";

type WorkplaceRequestRecord = {
  id: string;
  member_id: string;
  payload: unknown;
  request_type: string;
  requested_at: string;
  review_note: string | null;
  reviewed_at: string | null;
  status: string;
  members?:
    | {
        current_organization?: string | null;
        designation?: string | null;
        email?: string | null;
        full_name?: string | null;
        jnuits_id?: string | null;
        member_type?: string | null;
        professional_visibility?: string | null;
        work_location?: string | null;
      }
    | {
        current_organization?: string | null;
        designation?: string | null;
        email?: string | null;
        full_name?: string | null;
        jnuits_id?: string | null;
        member_type?: string | null;
        professional_visibility?: string | null;
        work_location?: string | null;
      }[]
    | null;
};

function resolveRequestMember(request: WorkplaceRequestRecord) {
  if (Array.isArray(request.members)) {
    return request.members[0] || null;
  }

  return request.members || null;
}

export function WorkplaceRequestsPanel({
  requests,
}: {
  requests: WorkplaceRequestRecord[];
}) {
  return (
    <section id="workplace" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Workplace moderation</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,3rem)] leading-[0.96] tracking-[-0.04em]">
            Pending alumni workplace changes waiting for operator review
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-7 text-[var(--muted)]">
          Phase 06 now sends moderated workplace requests into a real queue.
          Approving a request updates the member record, writes audit evidence,
          and keeps the portal history in sync.
        </p>
      </div>

      {requests.length === 0 ? (
        <article className="route-tile">
          <h3>No workplace requests right now</h3>
          <p>
            When alumni submit moderated workplace updates from the portal, they
            will show up here for approval or rejection.
          </p>
        </article>
      ) : (
        requests.map((request) => {
          const member = resolveRequestMember(request);
          const payloadEntries = getWorkplacePayloadEntries(request.payload);

          return (
            <article key={request.id} className="application-card">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(320px,0.98fr)]">
                <div className="application-card__meta">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="eyebrow">Pending moderation</span>
                    <span className="detail-chip">
                      Requested{" "}
                      {new Date(request.requested_at).toLocaleDateString("en-BD")}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-[-0.04em]">
                      {member?.full_name || "Linked member"}
                    </h3>
                    <p className="mt-2 text-base font-semibold text-[var(--brand-blue)]">
                      {member?.jnuits_id || request.member_id}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {member?.email ? (
                      <span className="detail-chip">{member.email}</span>
                    ) : null}
                    {member?.member_type ? (
                      <span className="detail-chip">{member.member_type}</span>
                    ) : null}
                    <span className="detail-chip">{request.request_type.replaceAll("_", " ")}</span>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="route-tile">
                      <h3>Requested changes</h3>
                      <ul className="clean-list mt-3">
                        {payloadEntries.map((entry) => (
                          <li key={entry.key}>
                            <strong>{entry.label}</strong>
                            <span>{entry.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="route-tile">
                      <h3>Current member state</h3>
                      <ul className="clean-list mt-3">
                        <li>
                          <strong>Organization</strong>
                          <span>{member?.current_organization || "Not set"}</span>
                        </li>
                        <li>
                          <strong>Designation</strong>
                          <span>{member?.designation || "Not set"}</span>
                        </li>
                        <li>
                          <strong>Work location</strong>
                          <span>{member?.work_location || "Not set"}</span>
                        </li>
                        <li>
                          <strong>Visibility</strong>
                          <span>{member?.professional_visibility || "Not set"}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <form className="application-card__actions">
                  <input name="requestId" type="hidden" value={request.id} />
                  <label className="input-label">
                    Review note
                    <textarea
                      name="reviewNote"
                      placeholder="Explain the decision or any follow-up required"
                      rows={5}
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="primary-button"
                      formAction={approveWorkplaceUpdateRequest}
                    >
                      Approve workplace update
                    </button>
                    <button
                      className="secondary-button"
                      formAction={rejectWorkplaceUpdateRequest}
                    >
                      Reject request
                    </button>
                  </div>
                </form>
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
