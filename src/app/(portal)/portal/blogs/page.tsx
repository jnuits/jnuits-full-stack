import Link from "next/link";
import {
  saveMemberBlogDraft,
  submitMemberBlogDraft,
} from "@/app/(portal)/portal/blogs/actions";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { PortalShell } from "@/components/portal/portal-shell";
import { requirePortalUser } from "@/lib/auth/session";
import { getPortalBlogAuthorSnapshot } from "@/lib/portal/blogs";
import { BookOpen, FilePen, Info, SendHorizonal } from "lucide-react";

export const metadata = { title: "Draft Blogs | JnUITS Portal" };

const messageMap: Record<string, string> = {
  "draft-saved": "Draft saved. You can continue editing or submit it for operator review.",
  "draft-submitted": "Draft submitted. It is now waiting in the admin editorial review queue.",
};

const errorMap: Record<string, string> = {
  "draft-missing": "That draft could not be found in your authoring space.",
  "draft-required": "Title, summary, and body are required before a blog draft can be saved.",
  "draft-save": "The draft could not be saved. Try again.",
  "draft-submit": "The draft could not be submitted for review.",
  "author-required": "This account needs a linked member or advisor profile before authoring can be used.",
  "member-required": "This account needs a linked member or advisor profile before authoring can be used.",
};

type PortalDraft = {
  body: null | string;
  category: null | string;
  excerpt: null | string;
  id: string;
  read_time: null | string;
  review_note: null | string;
  slug: string;
  status: string;
  summary: null | string;
  title: string;
  updated_at: string;
};

function statusBadgeClass(status: string): string {
  if (status === "pending_review") return "portal-badge--submitted";
  if (status === "approved" || status === "published") return "portal-badge--verified";
  if (status === "change_requested") return "portal-badge--returned";
  return "portal-badge--draft";
}

export default async function PortalBlogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requirePortalUser({ fallbackPath: "/portal/blogs" });
  if (!auth.user) return null;

  const resolvedSearchParams = await searchParams;
  const selectedDraftId =
    typeof resolvedSearchParams.edit === "string" ? resolvedSearchParams.edit : "";
  const message =
    typeof resolvedSearchParams.message === "string"
      ? messageMap[resolvedSearchParams.message] || null
      : null;
  const error =
    typeof resolvedSearchParams.error === "string"
      ? errorMap[resolvedSearchParams.error] || null
      : null;

  const snapshot = await getPortalBlogAuthorSnapshot(auth.user.id);
  const author = snapshot.member || snapshot.advisor;
  const isAdvisor = snapshot.authorKind === "advisor";
  const drafts = snapshot.drafts as PortalDraft[];
  const selectedDraft =
    drafts.find((d) => d.id === selectedDraftId) ||
    drafts[0] ||
    null;

  return (
    <PortalShell
      avatarUrl={snapshot.member?.avatar_secure_url ?? snapshot.advisor?.avatar_secure_url ?? null}
      memberName={snapshot.member?.full_name ?? snapshot.advisor?.full_name ?? null}
      jnuitsId={snapshot.member?.jnuits_id ?? null}
      portalRole={isAdvisor ? "advisor" : auth.user.portalRole}
    >
      {/* Page header */}
      <div className="portal-page-header">
        <div>
          <p className="portal-page-header__breadcrumb">
            {isAdvisor ? "Advisor Workspace" : "Member Services"}
          </p>
          <h1 className="portal-page-header__title">Draft Blogs</h1>
          <p className="portal-page-header__desc">
            Write and submit {isAdvisor ? "advisor" : "member"} blog posts for editorial review. Publication stays admin-controlled.
          </p>
        </div>
        {snapshot.member && (
          <span className="portal-badge portal-badge--member">{snapshot.member.jnuits_id}</span>
        )}
        {snapshot.advisor && (
          <span className="portal-badge portal-badge--member">
            {snapshot.advisor.advisor_jnuits_id ||
              snapshot.advisor.advisor_type?.replaceAll("_", " ") ||
              "advisor"}
          </span>
        )}
      </div>

      {/* No author profile linked */}
      {!author ? (
        <div className="portal-section">
          <div className="portal-section__header">
            <div className="portal-section__header-left">
              <div className="portal-section__icon"><Info size={14} /></div>
              <p className="portal-section__title">Linked author profile required</p>
            </div>
          </div>
          <div className="portal-section__body">
            <p style={{ fontSize: "0.88rem", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
              Blog authoring requires a connected member or advisor record. Ask an admin
              to link this account before writing drafts.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Flash messages */}
          {message && (
            <div className="flash-panel" data-tone="success">
              <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--muted-foreground)", marginBottom: "0.4rem" }}>
                Portal feedback
              </p>
              <p style={{ fontSize: "0.9rem", fontWeight: 700, lineHeight: 1.5 }}>Draft workflow updated</p>
              <p style={{ fontSize: "0.84rem", color: "var(--muted-foreground)", marginTop: "0.3rem", lineHeight: 1.65 }}>{message}</p>
            </div>
          )}
          {error && (
            <div className="flash-panel" data-tone="error">
              <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--muted-foreground)", marginBottom: "0.4rem" }}>
                Portal feedback
              </p>
              <p style={{ fontSize: "0.9rem", fontWeight: 700, lineHeight: 1.5 }}>Action failed</p>
              <p style={{ fontSize: "0.84rem", color: "var(--muted-foreground)", marginTop: "0.3rem", lineHeight: 1.65 }}>{error}</p>
            </div>
          )}

          {/* Editor + submit area */}
          <div
            style={{
              display: "grid",
              gap: "1.25rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 28rem), 1fr))",
              alignItems: "start",
            }}
          >
            {/* Editor form */}
            <div className="portal-section">
              <div className="portal-section__header">
                <div className="portal-section__header-left">
                  <div className="portal-section__icon"><FilePen size={14} /></div>
                  <p className="portal-section__title">
                    {selectedDraft ? "Edit draft" : "New draft"}
                  </p>
                </div>
                {selectedDraft && (
                  <span className={`portal-badge ${statusBadgeClass(selectedDraft.status)}`}>
                    {selectedDraft.status.replaceAll("_", " ")}
                  </span>
                )}
              </div>
              <div className="portal-section__body">
                <form action={saveMemberBlogDraft} style={{ display: "grid", gap: "0.9rem" }}>
                  <input name="postId" type="hidden" value={selectedDraft?.id || ""} />

                  <label className="input-label" htmlFor="blog-title">
                    Title *
                    <input
                      id="blog-title"
                      defaultValue={selectedDraft?.title || ""}
                      name="title"
                      placeholder="Write a public-facing story title"
                      required
                    />
                  </label>

                  <div className="portal-form-grid-2col">
                    <label className="input-label" htmlFor="blog-slug">
                      Slug
                      <input
                        id="blog-slug"
                        defaultValue={selectedDraft?.slug || ""}
                        name="slug"
                        placeholder="auto-generated"
                      />
                    </label>
                    <label className="input-label" htmlFor="blog-category">
                      Category
                      <input
                        id="blog-category"
                        defaultValue={selectedDraft?.category || ""}
                        name="category"
                        placeholder="Workshop, Community…"
                      />
                    </label>
                  </div>

                  <label className="input-label" htmlFor="blog-summary">
                    Summary *
                    <textarea
                      id="blog-summary"
                      defaultValue={selectedDraft?.summary || ""}
                      name="summary"
                      placeholder="Short summary for cards and review queues"
                      rows={3}
                      required
                    />
                  </label>

                  <label className="input-label" htmlFor="blog-excerpt">
                    Excerpt
                    <textarea
                      id="blog-excerpt"
                      defaultValue={selectedDraft?.excerpt || ""}
                      name="excerpt"
                      placeholder="Optional excerpt for featured cards"
                      rows={2}
                    />
                  </label>

                  <label className="input-label" htmlFor="blog-read-time">
                    Read time
                    <input
                      id="blog-read-time"
                      defaultValue={selectedDraft?.read_time || ""}
                      name="readTime"
                      placeholder="5 min read"
                    />
                  </label>

                  <MarkdownEditor
                    defaultValue={selectedDraft?.body || ""}
                    guidance="Markdown preview for editorial review"
                    inputLabel="Blog body markdown"
                    name="body"
                    placeholder="Write the full body of your member post in Markdown..."
                    previewLabel="Draft preview"
                    previewTitle="Rendered member blog"
                    required
                    rows={14}
                  />

                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    <button className="primary-button" type="submit">
                      {selectedDraft ? "Update draft" : "Create draft"}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right column: submit + info */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Submit draft */}
              <div className="portal-section">
                <div className="portal-section__header">
                  <div className="portal-section__header-left">
                    <div className="portal-section__icon"><SendHorizonal size={14} /></div>
                    <p className="portal-section__title">Editorial handoff</p>
                  </div>
                </div>
                <div className="portal-section__body" style={{ display: "grid", gap: "0.85rem" }}>
                  <p style={{ fontSize: "0.83rem", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
                    Once the draft is ready, submit it for admin review. Publication
                    remains operator-controlled — editors may publish or return your post
                    with a review note.
                  </p>
                  <form action={submitMemberBlogDraft}>
                    <input name="postId" type="hidden" value={selectedDraft?.id || ""} />
                    <button
                      className="secondary-button"
                      disabled={!selectedDraft || selectedDraft.status === "pending_review"}
                      type="submit"
                      style={{ width: "100%" }}
                    >
                      {selectedDraft?.status === "pending_review"
                        ? "Already submitted"
                        : "Submit selected draft for review"}
                    </button>
                  </form>
                </div>
              </div>

              {/* Authoring guides */}
              <div className="portal-section">
                <div className="portal-section__header">
                  <div className="portal-section__header-left">
                    <div className="portal-section__icon"><Info size={14} /></div>
                    <p className="portal-section__title">Authoring guidelines</p>
                  </div>
                </div>
                <div className="portal-section__body" style={{ display: "grid", gap: "0.65rem" }}>
                  <div className="portal-info-row">
                    <span className="portal-info-row__label">Markdown</span>
                    <span className="portal-info-row__value" style={{ fontSize: "0.82rem", lineHeight: 1.6 }}>
                      Use headings, lists, links, quotes, tables, and inline code. Raw HTML is not supported.
                    </span>
                  </div>
                  <div className="portal-markdown-examples">
                    <code>## বাংলা সেকশন শিরোনাম</code>
                    <code>- Workshop outcome</code>
                    <code>[JnUITS link](https://jnuits.org.bd)</code>
                    <code>&gt; Short quote or reflection</code>
                  </div>
                  <div className="portal-info-row">
                    <span className="portal-info-row__label">Safe boundary</span>
                    <span className="portal-info-row__value" style={{ fontSize: "0.82rem", lineHeight: 1.6 }}>
                      Authors can only manage their own drafts. Publishing and moderation stay outside the portal.
                    </span>
                  </div>
                  <div className="portal-info-row">
                    <span className="portal-info-row__label">Feedback</span>
                    <span className="portal-info-row__value" style={{ fontSize: "0.82rem", lineHeight: 1.6 }}>
                      Review notes from admins appear inline on returned drafts so you can revise and resubmit.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Drafts list */}
          <div className="portal-section">
            <div className="portal-section__header">
              <div className="portal-section__header-left">
                <div className="portal-section__icon"><BookOpen size={14} /></div>
                <p className="portal-section__title">Your drafts</p>
              </div>
              <span className="portal-badge portal-badge--draft">{drafts.length} total</span>
            </div>
            <div className="portal-section__body">
              {drafts.length === 0 ? (
                <p style={{ fontSize: "0.86rem", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
                  No drafts yet. Use the editor above to write and save your first {isAdvisor ? "advisor" : "member"} post.
                </p>
              ) : (
                <div style={{ display: "grid", gap: "0.65rem" }}>
                  {drafts.slice(0, 5).map((draft) => (
                    <div key={draft.id} className="portal-draft-card">
                      <div className="portal-draft-card__header">
                        <p className="portal-draft-card__title">{draft.title}</p>
                        <span className={`portal-badge ${statusBadgeClass(draft.status)}`}>
                          {draft.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      {draft.summary && (
                        <p className="portal-draft-card__summary">{draft.summary}</p>
                      )}
                      {draft.review_note && (
                        <p
                          className="portal-draft-card__summary"
                          style={{
                            borderLeft: "2px solid var(--brand-gold)",
                            paddingLeft: "0.75rem",
                            marginTop: "0.5rem",
                            color: "var(--foreground)",
                          }}
                        >
                          <strong>Editor note:</strong> {draft.review_note}
                        </p>
                      )}
                      <div className="portal-draft-card__footer">
                        <span className="portal-draft-card__date">
                          {new Date(draft.updated_at).toLocaleDateString("en-BD", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <Link className="queue-link" href={`/portal/blogs?edit=${draft.id}`}>
                          Edit draft →
                        </Link>
                      </div>
                    </div>
                  ))}
                  {drafts.length > 5 ? (
                    <details className="portal-disclosure">
                      <summary className="portal-disclosure__summary">
                        Show {drafts.length - 5} older draft{drafts.length - 5 === 1 ? "" : "s"}
                      </summary>
                      <div style={{ display: "grid", gap: "0.65rem", marginTop: "0.65rem" }}>
                        {drafts.slice(5).map((draft) => (
                          <div key={draft.id} className="portal-draft-card">
                            <div className="portal-draft-card__header">
                              <p className="portal-draft-card__title">{draft.title}</p>
                              <span className={`portal-badge ${statusBadgeClass(draft.status)}`}>
                                {draft.status.replaceAll("_", " ")}
                              </span>
                            </div>
                            {draft.summary && (
                              <p className="portal-draft-card__summary">{draft.summary}</p>
                            )}
                            {draft.review_note && (
                              <p
                                className="portal-draft-card__summary"
                                style={{
                                  borderLeft: "2px solid var(--brand-gold)",
                                  paddingLeft: "0.75rem",
                                  marginTop: "0.5rem",
                                  color: "var(--foreground)",
                                }}
                              >
                                <strong>Editor note:</strong> {draft.review_note}
                              </p>
                            )}
                            <div className="portal-draft-card__footer">
                              <span className="portal-draft-card__date">
                                {new Date(draft.updated_at).toLocaleDateString("en-BD", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                              <Link className="queue-link" href={`/portal/blogs?edit=${draft.id}`}>
                                Edit draft →
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </PortalShell>
  );
}
