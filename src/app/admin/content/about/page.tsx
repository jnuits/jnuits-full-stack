import { cookies } from "next/headers";

import { saveAboutPageContent } from "@/app/admin/content/about/actions";
import {
  ADMIN_FLASH_COOKIE_NAME,
  parseAdminFlash,
} from "@/lib/admin/flash";
import { getAboutContent } from "@/lib/content/public-content";

export const metadata = { title: "About Page Content — Admin | JnUITS" };

const statRows = [
  ["active_members", "Active members"] as const,
  ["events_organized", "Events organized"] as const,
  ["years_active", "Years active"] as const,
  ["executive_terms", "Executive terms"] as const,
  ["alumni_community", "Alumni & community"] as const,
];

function getYear(value: string) {
  return value.match(/\b(19\d{2}|20\d{2})\b/)?.[1] || "";
}

export default async function AdminAboutContentPage() {
  const [aboutContent, cookieStore] = await Promise.all([
    getAboutContent(),
    cookies(),
  ]);
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Content</p>
          <h1 className="admin-page-header__title">About page content</h1>
          <p className="admin-page-header__desc">
            Edit the key fields that power the public About page.
          </p>
        </div>
        <span className="abadge abadge--published">Published singleton</span>
      </div>

      {flash && (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="admin-section-label">Operator feedback</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">
            {flash.title}
          </h2>
          <p className="mt-1 text-sm leading-7">{flash.message}</p>
        </section>
      )}

      <form action={saveAboutPageContent} className="grid gap-8">
        <section className="admin-review-card">
          <p className="admin-section-label">Hero</p>
          <div className="mt-4 grid gap-4">
            <label className="input-label">
              Heading
              <input
                defaultValue={aboutContent.title}
                name="heroHeading"
                required
              />
            </label>
            <label className="input-label">
              Body paragraph
              <textarea
                defaultValue={aboutContent.heroDescription}
                name="heroBody"
                required
                rows={5}
              />
            </label>
          </div>
        </section>

        <section className="admin-review-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="admin-section-label">Stats</p>
            <span className="abadge abadge--pending">
              These stats appear on both the homepage and About page.
            </span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {statRows.map(([key, label]) => (
              <div className="grid gap-3 rounded-xl border border-[var(--color-border-secondary)] p-4" key={key}>
                <label className="input-label">
                  Value
                  <input
                    defaultValue={aboutContent.stats[key]}
                    name={`stat_${key}_value`}
                    required
                  />
                </label>
                <label className="input-label">
                  Label
                  <input defaultValue={label} disabled />
                </label>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="admin-review-card">
            <p className="admin-section-label">Mission</p>
            <div className="mt-4 grid gap-4">
              <label className="input-label">
                Mission heading
                <input
                  defaultValue={aboutContent.missionTitle}
                  name="missionHeading"
                  required
                />
              </label>
              <label className="input-label">
                Mission body
                <textarea
                  defaultValue={aboutContent.missionStatement}
                  name="missionBody"
                  required
                  rows={6}
                />
              </label>
            </div>
          </div>

          <div className="admin-review-card">
            <p className="admin-section-label">Vision</p>
            <div className="mt-4 grid gap-4">
              <label className="input-label">
                Vision heading
                <input
                  defaultValue={aboutContent.visionTitle}
                  name="visionHeading"
                  required
                />
              </label>
              <label className="input-label">
                Vision body
                <textarea
                  defaultValue={aboutContent.vision}
                  name="visionBody"
                  required
                  rows={6}
                />
              </label>
            </div>
          </div>
        </section>

        <section className="admin-review-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="admin-section-label">Timeline milestones</p>
            <span className="abadge abadge--active">
              Founding Committee label is fixed from committee data.
            </span>
          </div>
          <div className="mt-4 grid gap-4">
            <div className="admin-card-row">
              <div className="admin-card-row__body">
                <p className="admin-card-row__title">Founding Committee elected</p>
                <p className="admin-card-row__meta">
                  Fixed milestone from the 1st committee term. Date: Nov 11, 2015.
                </p>
              </div>
              <span className="abadge abadge--draft">Locked</span>
            </div>

            {aboutContent.timeline.map((item, index) => (
              <div className="grid gap-3 rounded-xl border border-[var(--color-border-secondary)] p-4 md:grid-cols-[0.45fr_1fr_1.4fr]" key={`${item.date}-${item.event}`}>
                <label className="input-label">
                  Year
                  <input
                    defaultValue={getYear(item.date)}
                    inputMode="numeric"
                    name="timelineYear"
                    type="number"
                  />
                </label>
                <label className="input-label">
                  Date
                  <input defaultValue={item.date} name="timelineDate" />
                </label>
                <label className="input-label">
                  Title
                  <input defaultValue={item.event} name="timelineEvent" />
                </label>
                {index > 0 ? (
                  <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] md:col-span-3">
                    <input
                      name="timelineDeleteIndex"
                      type="checkbox"
                      value={index}
                    />
                    Delete this milestone
                  </label>
                ) : null}
              </div>
            ))}

            <div className="grid gap-3 rounded-xl border border-dashed border-[var(--color-border-secondary)] p-4 md:grid-cols-[0.45fr_1fr_1.4fr]">
              <label className="input-label">
                Year
                <input inputMode="numeric" name="timelineYear" type="number" />
              </label>
              <label className="input-label">
                Date
                <input name="timelineDate" placeholder="1 Jul 2025" />
              </label>
              <label className="input-label">
                Add new milestone
                <input name="timelineEvent" placeholder="Milestone title" />
              </label>
            </div>
          </div>
        </section>

        <section className="admin-review-card">
          <p className="admin-section-label">Community reach</p>
          <label className="input-label mt-4">
            Caption
            <textarea
              defaultValue={aboutContent.communityReachCaption}
              name="communityReachCaption"
              rows={3}
            />
          </label>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {aboutContent.communityReach.map((item, index) => (
              <div className="grid gap-3 rounded-xl border border-[var(--color-border-secondary)] p-4" key={item.platform}>
                <p className="admin-card-row__title">{item.platform}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="input-label">
                    Stat value
                    <input
                      defaultValue={item.stat}
                      name={`reach_${index}_stat`}
                    />
                  </label>
                  <label className="input-label">
                    Label
                    <input
                      defaultValue={item.label}
                      name={`reach_${index}_label`}
                    />
                  </label>
                </div>
                <label className="input-label">
                  Link
                  <input
                    defaultValue={item.link || ""}
                    name={`reach_${index}_link`}
                    placeholder="https://..."
                    type="url"
                  />
                </label>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <button className="admin-btn admin-btn--primary" type="submit">
            Save About page content
          </button>
        </div>
      </form>
    </div>
  );
}
