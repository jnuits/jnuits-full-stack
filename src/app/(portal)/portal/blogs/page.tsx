import {
  saveMemberBlogDraft,
  submitMemberBlogDraft,
} from "@/app/(portal)/portal/blogs/actions";
import { PortalShell } from "@/components/portal/portal-shell";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getPortalBlogAuthorSnapshot } from "@/lib/portal/blogs";

const messageMap: Record<string, string> = {
  "draft-saved":
    "Draft saved. You can continue editing or submit it for operator review.",
  "draft-submitted":
    "Draft submitted. It is now waiting in the admin editorial review queue.",
};

const errorMap: Record<string, string> = {
  "draft-missing": "That draft could not be found in your authoring space.",
  "draft-required":
    "Title, summary, and body are required before a blog draft can be saved.",
  "draft-save": "The draft could not be saved. Try again.",
  "draft-submit": "The draft could not be submitted for review.",
  "member-required":
    "This account needs a linked member profile before authoring can be used.",
};

export default async function PortalBlogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireAuthenticatedUser({ fallbackPath: "/portal" });

  if (!auth.user) {
    return null;
  }

  const resolvedSearchParams = await searchParams;
  const selectedDraftId =
    typeof resolvedSearchParams.edit === "string"
      ? resolvedSearchParams.edit
      : "";
  const message =
    typeof resolvedSearchParams.message === "string"
      ? messageMap[resolvedSearchParams.message] || null
      : null;
  const error =
    typeof resolvedSearchParams.error === "string"
      ? errorMap[resolvedSearchParams.error] || null
      : null;
  const snapshot = await getPortalBlogAuthorSnapshot(auth.user.id);
  const selectedDraft =
    snapshot.drafts.find((draft) => draft.id === selectedDraftId) ||
    snapshot.drafts[0] ||
    null;

  return (
    <PortalShell
      title="Draft blogs"
      summary="Member blog authoring is now live inside the portal. Contributors can save drafts, submit them for review, and track editorial feedback without entering the admin workspace."
    >
      {!snapshot.member ? (
        <section className="section-band grid gap-4">
          <span className="eyebrow">Linked member required</span>
          <h2 className="font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]">
            Blog authoring stays disabled until this account is linked to a member
          </h2>
          <p className="section-copy">
            Member authoring is role-limited, but it still needs a real linked
            member profile before drafts can be associated with the correct
            contributor and review trail.
          </p>
        </section>
      ) : (
        <div className="grid gap-4">
          {message ? (
            <section className="flash-panel" data-tone="success">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
                Portal feedback
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[-0.03em]">
                Draft workflow updated
              </h2>
              <p className="section-copy mt-2">{message}</p>
            </section>
          ) : null}

          {error ? (
            <section className="flash-panel" data-tone="error">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
                Portal feedback
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[-0.03em]">
                Authoring action failed
              </h2>
              <p className="section-copy mt-2">{error}</p>
            </section>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
            <form action={saveMemberBlogDraft} className="section-band grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="eyebrow">Member authoring</span>
                  <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.9rem,3vw,2.5rem)] leading-[0.96] tracking-[-0.04em]">
                    Draft a member blog without entering the operator workspace
                  </h2>
                </div>
                <span className="status-pill">{snapshot.member.jnuits_id}</span>
              </div>

              <input name="postId" type="hidden" value={selectedDraft?.id || ""} />

              <div className="portal-form-grid">
                <label className="input-label sm:col-span-2">
                  Title
                  <input
                    defaultValue={selectedDraft?.title || ""}
                    name="title"
                    placeholder="Write a public-facing story title"
                    required
                  />
                </label>
                <label className="input-label">
                  Slug
                  <input
                    defaultValue={selectedDraft?.slug || ""}
                    name="slug"
                    placeholder="generated-if-empty"
                  />
                </label>
                <label className="input-label">
                  Category
                  <input
                    defaultValue={selectedDraft?.category || ""}
                    name="category"
                    placeholder="Workshop, Platform, Community"
                  />
                </label>
                <label className="input-label sm:col-span-2">
                  Summary
                  <textarea
                    defaultValue={selectedDraft?.summary || ""}
                    name="summary"
                    placeholder="Short summary for cards and review queues"
                    rows={3}
                    required
                  />
                </label>
                <label className="input-label sm:col-span-2">
                  Excerpt
                  <textarea
                    defaultValue={selectedDraft?.excerpt || ""}
                    name="excerpt"
                    placeholder="Optional excerpt for featured cards"
                    rows={3}
                  />
                </label>
                <label className="input-label">
                  Read time
                  <input
                    defaultValue={selectedDraft?.read_time || ""}
                    name="readTime"
                    placeholder="5 min read"
                  />
                </label>
                <div className="route-tile">
                  <h3>Review state</h3>
                  <p className="mt-2">
                    {selectedDraft?.status
                      ? selectedDraft.status.replaceAll("_", " ")
                      : "New draft"}
                  </p>
                </div>
                <label className="input-label sm:col-span-2">
                  Body
                  <textarea
                    defaultValue={selectedDraft?.body || ""}
                    name="body"
                    placeholder="Write the body of your member post"
                    rows={12}
                    required
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <button className="primary-button" type="submit">
                  {selectedDraft ? "Update draft" : "Create draft"}
                </button>
              </div>
            </form>

            <div className="section-band grid gap-4">
              <div>
                <span className="eyebrow">Editorial handoff</span>
                <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.3rem)] leading-[0.96] tracking-[-0.04em]">
                  Submit only when the draft is ready for operator review
                </h2>
              </div>
              <p className="section-copy">
                Publication remains admin-controlled. Submitted drafts move into
                the `/admin/content` review queue, where operators can publish or
                return them with a note.
              </p>
              <form action={submitMemberBlogDraft} className="grid gap-3">
                <input
                  name="postId"
                  type="hidden"
                  value={selectedDraft?.id || ""}
                />
                <button
                  className="secondary-button"
                  disabled={!selectedDraft || selectedDraft.status === "submitted"}
                  type="submit"
                >
                  {selectedDraft?.status === "submitted"
                    ? "Already submitted"
                    : "Submit selected draft"}
                </button>
              </form>
              <div className="route-grid">
                <article className="route-tile">
                  <h3>Safe authoring boundary</h3>
                  <p>
                    Members can only manage their own drafts here. Publishing,
                    moderation, and audits stay outside the portal.
                  </p>
                </article>
                <article className="route-tile">
                  <h3>Editorial feedback</h3>
                  <p>
                    Review notes from admins come back into this page with the
                    draft so contributors can revise safely.
                  </p>
                </article>
              </div>
            </div>
          </section>

          <section className="section-band">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="eyebrow">Your drafts</span>
                <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]">
                  Draft and review history for this member account
                </h2>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {snapshot.drafts.length === 0 ? (
                <div className="empty-state md:col-span-2 xl:col-span-3">
                  No drafts yet. Your first saved member post will appear here.
                </div>
              ) : (
                snapshot.drafts.map((draft) => (
                  <article key={draft.id} className="route-tile">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3>{draft.title}</h3>
                      <span className="status-pill">
                        {draft.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      {draft.summary || "No summary saved yet."}
                    </p>
                    {draft.review_note ? (
                      <p className="mt-3 rounded-[1rem] border border-[var(--line)] px-3 py-3 text-sm leading-7 text-[var(--muted)]">
                        {draft.review_note}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                      <span>{new Date(draft.updated_at).toLocaleString("en-BD")}</span>
                      <a className="queue-link" href={`/portal/blogs?edit=${draft.id}`}>
                        Edit draft
                      </a>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </PortalShell>
  );
}
