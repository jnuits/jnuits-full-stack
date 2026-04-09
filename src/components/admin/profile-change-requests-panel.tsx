import {
  approveProfileChangeRequest,
  rejectProfileChangeRequest,
} from "@/app/admin/actions";
import { EmptyState } from "@/components/ui/empty-state";

type ProfileChangeRequestRecord = {
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
        email?: string | null;
        full_name?: string | null;
        jnuits_id?: string | null;
        phone?: string | null;
        linkedin_url?: string | null;
        website_url?: string | null;
      }
    | {
        email?: string | null;
        full_name?: string | null;
        jnuits_id?: string | null;
        phone?: string | null;
        linkedin_url?: string | null;
        website_url?: string | null;
      }[]
    | null;
};

function resolveRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

function parseProfilePayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      fullName: null,
      linkedinUrl: null,
      phone: null,
      websiteUrl: null,
    };
  }

  const record = payload as Record<string, unknown>;

  return {
    fullName:
      typeof record.fullName === "string" && record.fullName.trim()
        ? record.fullName.trim()
        : null,
    linkedinUrl:
      typeof record.linkedinUrl === "string" && record.linkedinUrl.trim()
        ? record.linkedinUrl.trim()
        : null,
    phone:
      typeof record.phone === "string" && record.phone.trim()
        ? record.phone.trim()
        : null,
    websiteUrl:
      typeof record.websiteUrl === "string" && record.websiteUrl.trim()
        ? record.websiteUrl.trim()
        : null,
  };
}

export function ProfileChangeRequestsPanel({
  requests,
}: {
  requests: ProfileChangeRequestRecord[];
}) {
  return (
    <section id="profile-requests" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Profile moderation queue</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
            Moderated profile changes now sit beside workplace reviews
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-7 text-[var(--muted)]">
          Review each member-requested name, phone, and social link edit before
          it is applied to the member record.
        </p>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="No pending profile change requests"
          description="The moderated profile queue is empty. When members request name, phone, or social link edits, they will appear here."
        />
      ) : (
        requests.map((request) => {
          const member = resolveRelation(request.members);
          const payload = parseProfilePayload(request.payload);

          return (
            <article key={request.id} className="application-card">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(320px,0.98fr)]">
                <div className="application-card__meta">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="eyebrow">Pending moderation</span>
                    {member?.jnuits_id ? (
                      <span className="detail-chip">{member.jnuits_id}</span>
                    ) : null}
                  </div>
                  <div>
                    <h3 className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-[-0.04em]">
                      {member?.full_name || "Linked member"}
                    </h3>
                    <p className="mt-2 text-base font-semibold text-[var(--brand-blue)]">
                      {member?.email || "Email unavailable"}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="route-tile">
                      <h3>Requested full name</h3>
                      <p>{payload.fullName || member?.full_name || "No change"}</p>
                    </div>
                    <div className="route-tile">
                      <h3>Requested phone</h3>
                      <p>{payload.phone || member?.phone || "No change"}</p>
                    </div>
                    <div className="route-tile">
                      <h3>LinkedIn URL</h3>
                      <p>{payload.linkedinUrl || member?.linkedin_url || "No change"}</p>
                    </div>
                    <div className="route-tile">
                      <h3>Website URL</h3>
                      <p>{payload.websiteUrl || member?.website_url || "No change"}</p>
                    </div>
                  </div>
                </div>

                <form className="application-card__actions">
                  <input type="hidden" name="requestId" value={request.id} />
                  <label className="input-label" htmlFor={`pcr-review-note-${request.id}`}>
                    Review note
                    <textarea
                      id={`pcr-review-note-${request.id}`}
                      name="reviewNote"
                      placeholder="Operator rationale or follow-up context"
                      rows={4}
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="primary-button"
                      formAction={approveProfileChangeRequest}
                    >
                      Approve profile update
                    </button>
                    <button
                      className="secondary-button"
                      formAction={rejectProfileChangeRequest}
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
