import Link from "next/link";

export default function MembersPage() {
  return (
    <div className="shell py-12">
      <div className="glass-card grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="eyebrow">Privacy-aware directory</span>
          <h1 className="section-title mt-4">
            Members and alumni stay public-facing, but sensitive workplace data
            keeps a verification gate.
          </h1>
          <p className="section-copy mt-4">
            The new directory preserves the legacy privacy model: safe public
            identity fields can be listed openly, while protected workplace
            details require both authentication and a scoped member-directory
            verification step.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/membership-form" className="primary-button">
              Apply for membership
            </Link>
            <Link href="/register" className="secondary-button">
              Claim existing profile
            </Link>
          </div>
        </div>

        <div className="route-grid content-start">
          <article className="route-tile">
            <h3>Directory gate</h3>
            <p>
              The extra verification-code gate remains a first-class requirement
              for workplace visibility.
            </p>
          </article>
          <article className="route-tile">
            <h3>Claimed members</h3>
            <p>
              Claimed members can unlock scoped workplace visibility without
              exposing the raw verification secret.
            </p>
          </article>
          <article className="route-tile">
            <h3>Transition intake</h3>
            <p>
              Temporary public membership application intake is preserved at
              `/membership-form` during the transition.
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}
