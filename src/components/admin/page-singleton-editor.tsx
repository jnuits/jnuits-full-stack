"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Save } from "lucide-react";
import { saveContentPage } from "@/app/admin/content/actions";

type ContentPageRecord = {
  body: unknown;
  eyebrow: string | null;
  slug: string;
  status: string;
  summary: string | null;
  title: string;
  updated_at: string;
};

type PageSingletonEditorProps = {
  selected: ContentPageRecord | null;
  initialSlug?: string;
};

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function lineJoin(
  items: unknown,
  mapItem: (item: Record<string, unknown>) => string
) {
  return asArray(items)
    .map((item) => (item && typeof item === "object" && !Array.isArray(item) ? mapItem(item as Record<string, unknown>) : ""))
    .filter(Boolean)
    .join("\n");
}

function splitRows(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parsePipedRows(value: string, fallbackThird = "") {
  return splitRows(value).map((line) => {
    const [title = "", description = "", third = fallbackThird] = line
      .split("|")
      .map((part) => part.trim());
    return { description, third, title };
  });
}

function initialHomeFields(body: Record<string, unknown>) {
  const firstSlide = asObject(asArray(body.heroSlides)[0]);
  const about = asObject(body.aboutSection);
  const achievements = asObject(body.achievements);
  const recent = asObject(body.recentActivities);

  return {
    aboutButtonLink: asString(about.buttonLink, "/about"),
    aboutButtonText: asString(about.buttonText, "About JnUITS"),
    aboutDescription: asString(about.description),
    aboutImageSrc: asString(about.imageSrc),
    aboutTitle: asString(about.title),
    achievementsImageSrc: asString(achievements.imageSrc),
    achievementsLines: lineJoin(achievements.items, (item) =>
      [asString(item.title), asString(item.description), asString(item.icon, "Sparkles")].join(" | ")
    ),
    achievementsTitle: asString(achievements.title),
    heroButtonLink: asString(firstSlide.buttonLink, "/about"),
    heroButtonText: asString(firstSlide.buttonText, "Learn more"),
    heroDescription: asString(firstSlide.description),
    heroImageSrc: asString(firstSlide.imageSrc),
    heroTitle: asString(firstSlide.title),
    recentActivitiesImageSrc: asString(recent.imageSrc),
    recentActivitiesLines: lineJoin(recent.activities, (item) =>
      [asString(item.title), asString(item.description), asString(item.link, "/events")].join(" | ")
    ),
    recentActivitiesTitle: asString(recent.title),
  };
}

function initialContactFields(body: Record<string, unknown>) {
  return {
    address: asString(body.address),
    email: asString(body.email),
    foundedLabel: asString(body.foundedLabel),
    googleBusinessHref: asString(body.googleBusinessHref),
    location: asString(body.location),
    organizationType: asString(body.organizationType),
    phone: asString(body.phone),
    socialLinks: lineJoin(body.socialLinks, (item) =>
      [asString(item.label), asString(item.href)].join(" | ")
    ),
    university: asString(body.university),
  };
}

function initialFooterFields(body: Record<string, unknown>) {
  return {
    email: asString(body.email),
    location: asString(body.location),
    phone: asString(body.phone),
    subtitle: asString(body.subtitle),
    university: asString(body.university),
  };
}

export function PageSingletonEditor({ selected, initialSlug = "home" }: PageSingletonEditorProps) {
  const router = useRouter();
  const body = useMemo(() => asObject(selected?.body), [selected?.body]);
  const slug = selected?.slug || initialSlug;
  const [status, setStatus] = useState(selected?.status || "draft");
  const [title, setTitle] = useState(selected?.title || "");
  const [eyebrow, setEyebrow] = useState(selected?.eyebrow || "");
  const [summary, setSummary] = useState(selected?.summary || "");
  const [home, setHome] = useState(() => initialHomeFields(body));
  const [contact, setContact] = useState(() => initialContactFields(body));
  const [footer, setFooter] = useState(() => initialFooterFields(body));

  const bodyJson = useMemo(() => {
    if (slug === "home") {
      return JSON.stringify({
        aboutSection: {
          buttonLink: home.aboutButtonLink,
          buttonText: home.aboutButtonText,
          description: home.aboutDescription,
          imageSrc: home.aboutImageSrc,
          title: home.aboutTitle,
        },
        achievements: {
          imageSrc: home.achievementsImageSrc,
          items: parsePipedRows(home.achievementsLines, "Sparkles").map((row) => ({
            description: row.description,
            icon: row.third || "Sparkles",
            title: row.title,
          })),
          title: home.achievementsTitle,
        },
        heroSlides: [
          {
            buttonLink: home.heroButtonLink,
            buttonText: home.heroButtonText,
            description: home.heroDescription,
            imageSrc: home.heroImageSrc,
            title: home.heroTitle,
          },
        ],
        recentActivities: {
          activities: parsePipedRows(home.recentActivitiesLines, "/events").map((row) => ({
            description: row.description,
            link: row.third || "/events",
            title: row.title,
          })),
          imageSrc: home.recentActivitiesImageSrc,
          title: home.recentActivitiesTitle,
        },
      });
    }

    if (slug === "contact") {
      return JSON.stringify({
        address: contact.address,
        email: contact.email,
        foundedLabel: contact.foundedLabel,
        googleBusinessHref: contact.googleBusinessHref,
        location: contact.location,
        organizationType: contact.organizationType,
        phone: contact.phone,
        socialLinks: splitRows(contact.socialLinks).map((line) => {
          const [label = "", href = ""] = line.split("|").map((part) => part.trim());
          return { href, label };
        }),
        university: contact.university,
      });
    }

    if (slug === "footer") {
      return JSON.stringify({
        email: footer.email,
        location: footer.location,
        phone: footer.phone,
        subtitle: footer.subtitle,
        university: footer.university,
      });
    }

    return JSON.stringify(body);
  }, [body, contact, footer, home, slug]);

  return (
    <div className="admin-review-card">
      <p className="mb-4 text-sm text-[var(--muted-foreground)]">This editor preserves dedicated content and checks for newer edits before saving.</p>
      {slug === "home" ? <Link className="queue-link mb-4 inline-flex" href="/admin/content/slider">Manage the full Slider collection</Link> : null}
      <form action={saveContentPage} className="grid gap-5">
        <input name="bodyJson" type="hidden" value={bodyJson} />
        <input name="expectedUpdatedAt" type="hidden" value={selected?.updated_at || ""} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="input-label">
            Page
            <select name="slug" onChange={(event) => router.push(`/admin/content/pages?edit=${encodeURIComponent(event.target.value)}`)} value={slug}>
              <option value="home">Home</option>
              <option value="contact">Contact</option>
              <option value="footer">Footer</option>
              <option value="about">About</option>
            </select>
          </label>
          <label className="input-label">
            Status
            <select name="status" onChange={(event) => setStatus(event.target.value)} value={status}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
          <label className="input-label sm:col-span-2">
            Eyebrow
            <input name="eyebrow" onChange={(event) => setEyebrow(event.target.value)} value={eyebrow} />
          </label>
          <label className="input-label sm:col-span-2">
            Title
            <input name="title" onChange={(event) => setTitle(event.target.value)} required value={title} />
          </label>
          <label className="input-label sm:col-span-2">
            Summary
            <textarea name="summary" onChange={(event) => setSummary(event.target.value)} rows={4} value={summary} />
          </label>
        </div>

        {slug === "home" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Hero title" value={home.heroTitle} onChange={(value) => setHome((current) => ({ ...current, heroTitle: value }))} />
            <Field label="Hero image URL" value={home.heroImageSrc} onChange={(value) => setHome((current) => ({ ...current, heroImageSrc: value }))} />
            <Area label="Hero description" value={home.heroDescription} onChange={(value) => setHome((current) => ({ ...current, heroDescription: value }))} />
            <Field label="Hero button text" value={home.heroButtonText} onChange={(value) => setHome((current) => ({ ...current, heroButtonText: value }))} />
            <Field label="Hero button link" value={home.heroButtonLink} onChange={(value) => setHome((current) => ({ ...current, heroButtonLink: value }))} />
            <Field label="About title" value={home.aboutTitle} onChange={(value) => setHome((current) => ({ ...current, aboutTitle: value }))} />
            <Area label="About description" value={home.aboutDescription} onChange={(value) => setHome((current) => ({ ...current, aboutDescription: value }))} />
            <Field label="About image URL" value={home.aboutImageSrc} onChange={(value) => setHome((current) => ({ ...current, aboutImageSrc: value }))} />
            <Field label="Achievements title" value={home.achievementsTitle} onChange={(value) => setHome((current) => ({ ...current, achievementsTitle: value }))} />
            <Area label="Achievements" value={home.achievementsLines} onChange={(value) => setHome((current) => ({ ...current, achievementsLines: value }))} />
            <Field label="Recent activities title" value={home.recentActivitiesTitle} onChange={(value) => setHome((current) => ({ ...current, recentActivitiesTitle: value }))} />
            <Area label="Recent activities" value={home.recentActivitiesLines} onChange={(value) => setHome((current) => ({ ...current, recentActivitiesLines: value }))} />
          </div>
        ) : null}

        {slug === "contact" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Email" value={contact.email} onChange={(value) => setContact((current) => ({ ...current, email: value }))} />
            <Field label="Phone" value={contact.phone} onChange={(value) => setContact((current) => ({ ...current, phone: value }))} />
            <Field label="Address" value={contact.address} onChange={(value) => setContact((current) => ({ ...current, address: value }))} />
            <Field label="Location" value={contact.location} onChange={(value) => setContact((current) => ({ ...current, location: value }))} />
            <Field label="University" value={contact.university} onChange={(value) => setContact((current) => ({ ...current, university: value }))} />
            <Field label="Organization type" value={contact.organizationType} onChange={(value) => setContact((current) => ({ ...current, organizationType: value }))} />
            <Field label="Founded label" value={contact.foundedLabel} onChange={(value) => setContact((current) => ({ ...current, foundedLabel: value }))} />
            <Field label="Google business URL" value={contact.googleBusinessHref} onChange={(value) => setContact((current) => ({ ...current, googleBusinessHref: value }))} />
            <Area label="Social links" value={contact.socialLinks} onChange={(value) => setContact((current) => ({ ...current, socialLinks: value }))} />
          </div>
        ) : null}

        {slug === "footer" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Email" value={footer.email} onChange={(value) => setFooter((current) => ({ ...current, email: value }))} />
            <Field label="Phone" value={footer.phone} onChange={(value) => setFooter((current) => ({ ...current, phone: value }))} />
            <Field label="Location" value={footer.location} onChange={(value) => setFooter((current) => ({ ...current, location: value }))} />
            <Field label="University" value={footer.university} onChange={(value) => setFooter((current) => ({ ...current, university: value }))} />
            <Field label="Subtitle" value={footer.subtitle} onChange={(value) => setFooter((current) => ({ ...current, subtitle: value }))} />
          </div>
        ) : null}

        {slug === "about" ? (
          <div className="route-tile">
            <h3>About page has a dedicated editor</h3>
            <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
              Use the About page workspace for mission, vision, timeline, stats, and community reach sections.
            </p>
            <Link className="queue-link mt-3 inline-flex" href="/admin/content/about">
              Open About editor
            </Link>
          </div>
        ) : null}

        <section className="route-tile">
          <div className="flex flex-wrap items-center gap-2">
            <Eye size={15} />
            <h3>Preview</h3>
          </div>
          <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
            {eyebrow ? `${eyebrow} · ` : ""}{title || "Untitled page"}
          </p>
          <p className="mt-2 text-sm leading-7">{summary || "No summary yet."}</p>
        </section>

        <div className="flex flex-wrap gap-3">
          <button className="admin-btn admin-btn--primary" type="submit">
            <Save size={14} /> Save content page
          </button>
          <Link href="/admin/content/pages" className="admin-btn admin-btn--ghost">
            Clear editor
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="input-label">
      {label}
      <input onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

function Area({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="input-label">
      {label}
      <textarea onChange={(event) => onChange(event.target.value)} rows={4} value={value} />
    </label>
  );
}