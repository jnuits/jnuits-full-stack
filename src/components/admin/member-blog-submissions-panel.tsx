import {
  publishMemberBlogSubmission,
  returnMemberBlogSubmission,
} from "@/app/admin/content/actions";
import { BlogMarkdown } from "@/components/blogs/blog-markdown";
import { EmptyState } from "@/components/ui/empty-state";

type MemberBlogSubmission = {
  author_member_id: string | null;
  body: string | null;
  category: string | null;
  excerpt: string | null;
  id: string;
  read_time: string | null;
  review_note: string | null;
  slug: string;
  submitted_at: string | null;
  summary: string | null;
  title: string;
  updated_at: string;
  members?:
    | {
        email?: string | null;
        full_name?: string | null;
        jnuits_id?: string | null;
      }
    | {
        email?: string | null;
        full_name?: string | null;
        jnuits_id?: string | null;
      }[]
    | null;
};

function resolveRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

export function MemberBlogSubmissionsPanel({
  submissions,
}: {
  submissions: MemberBlogSubmission[];
}) {
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Member blog review</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
            Submitted portal drafts waiting for editorial review
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-7 text-[var(--muted-foreground)]">
          Members can now draft inside the portal. Publishing still stays in the
          admin workspace with review notes and audit evidence.
        </p>
      </div>

      {submissions.length === 0 ? (
        <EmptyState
          title="No blogs waiting for review"
          description="When portal authors submit drafts for editorial review, they will appear here ready to publish or return."
        />
      ) : (
        submissions.map((submission) => {
          const author = resolveRelation(submission.members);

          return (
            <article key={submission.id} className="application-card">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)]">
                <div className="application-card__meta">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="eyebrow">Editorial review</span>
                    {author?.jnuits_id ? (
                      <span className="detail-chip">{author.jnuits_id}</span>
                    ) : null}
                    {submission.category ? (
                      <span className="detail-chip">{submission.category}</span>
                    ) : null}
                  </div>
                  <div>
                    <h3 className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-[-0.04em]">
                      {submission.title}
                    </h3>
                    <p className="mt-2 text-base font-semibold text-[var(--brand-blue)]">
                      {author?.full_name || "Linked member author"}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="route-tile">
                      <h3>Submitted</h3>
                      <p>
                        {new Date(
                          submission.submitted_at || submission.updated_at
                        ).toLocaleString("en-BD")}
                      </p>
                    </div>
                    <div className="route-tile">
                      <h3>Read time</h3>
                      <p>{submission.read_time || "Not set"}</p>
                    </div>
                    <div className="route-tile sm:col-span-2">
                      <h3>Summary</h3>
                      <p>{submission.summary || "No summary provided."}</p>
                    </div>
                    <div className="route-tile sm:col-span-2">
                      <h3>Excerpt</h3>
                      <p>{submission.excerpt || "No excerpt provided."}</p>
                    </div>
                    <div className="route-tile sm:col-span-2">
                      <h3>Slug</h3>
                      <p>{submission.slug}</p>
                    </div>
                  </div>
                  <div className="blog-review-preview">
                    <p className="admin-section-label">Submitted markdown preview</p>
                    {submission.body ? (
                      <BlogMarkdown source={submission.body} />
                    ) : (
                      <p>No body content submitted.</p>
                    )}
                  </div>
                </div>

                <form className="application-card__actions">
                  <input name="postId" type="hidden" value={submission.id} />
                  <label className="input-label">
                    Review note
                    <textarea
                      defaultValue={submission.review_note || ""}
                      name="reviewNote"
                      placeholder="Editorial feedback or moderation context"
                      rows={5}
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="input-label">
                      Publish at
                      <input name="publishedAt" type="datetime-local" />
                    </label>
                    <label className="input-label">
                      Review status
                      <input readOnly value="pending_review" />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="primary-button"
                      formAction={publishMemberBlogSubmission}
                    >
                      Publish blog
                    </button>
                    <button
                      className="secondary-button"
                      formAction={returnMemberBlogSubmission}
                    >
                      Request changes
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
