import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EventListItem } from "@/lib/content/events";
import { AiItFestCampaign } from "./AiItFestCampaign";

function eventFixture(
  slug: string,
  title: string,
  options: Partial<EventListItem> = {}
): EventListItem {
  return {
    category: "competition",
    cover: {
      alt: `${title} official artwork`,
      fullUrl: `https://res.cloudinary.com/example/image/upload/${slug}.png`,
      height: 630,
      id: `media-${slug}`,
      publicId: `campaign/${slug}`,
      rawUrl: `https://res.cloudinary.com/example/image/upload/${slug}.png`,
      thumbnailUrl: `https://res.cloudinary.com/example/image/upload/${slug}.png`,
      width: 1200,
    },
    ctaLabel: null,
    ctaUrl: null,
    deliveryMode: "offline",
    endsAt: null,
    id: `event-${slug}`,
    legacyContentPostId: null,
    lifecycle: "upcoming",
    lifecycleLabel: "Upcoming",
    locationLabel: "Jagannath University",
    publishedAt: "2026-08-14T12:00:00Z",
    registrationBadgeLabel: "External Registration",
    registrationClosesAt: "2026-08-15T17:59:00Z",
    registrationState: "external",
    registrationUrl: `https://itfest.jnuits.org.bd/events/${slug}`,
    slug,
    startsAt: "2026-08-30T03:00:00Z",
    status: "published",
    summary: `${title} verified event summary.`,
    timezone: "Asia/Dhaka",
    title,
    updatedAt: "2026-08-14T12:00:00Z",
    ...options,
  };
}

const campaignEvents = [
  eventFixture("jnu-ai-it-fest-2026", "JnU AI & IT Fest 2026", {
    category: "institutional",
    registrationBadgeLabel: null,
    registrationClosesAt: null,
    registrationState: "none",
    registrationUrl: null,
  }),
  eventFixture("ai-it-olympiad", "AI & IT Olympiad"),
  eventFixture("techuncut", "TechUncut", { category: "institutional" }),
  eventFixture("techcare-zone", "TechCare Zone", {
    category: "other-real-event",
    registrationBadgeLabel: "Registration Closed",
    registrationState: "closed",
  }),
  eventFixture("ai-ad-venture", "AI Ad-Venture"),
  eventFixture("brainchild-season-2-0", "BrainChild Season 2.0", {
    ctaLabel: "Explore BrainChild",
    ctaUrl: "https://brainchild.jnuits.org.bd/",
    registrationClosesAt: "2026-08-20T17:59:59Z",
    registrationUrl: "https://brainchild.jnuits.org.bd/register",
  }),
];

describe("AI and IT Fest homepage campaign", () => {
  it("renders one campaign heading and four standard event cards", () => {
    render(<AiItFestCampaign events={campaignEvents} />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "JnU AI & IT Fest 2026" })
    ).toBeInTheDocument();

    const showcase = screen.getByRole("region", {
      name: "Fest event showcase",
    });
    expect(within(showcase).getAllByRole("article")).toHaveLength(4);
    expect(
      within(showcase).getAllByRole("heading", { level: 3 }).map((heading) =>
        heading.textContent?.trim()
      )
    ).toEqual([
      "AI & IT Olympiad",
      "TechUncut",
      "TechCare Zone",
      "AI Ad-Venture",
    ]);
  });

  it("features BrainChild once in its own core-event region", () => {
    render(<AiItFestCampaign events={campaignEvents} />);

    const core = screen.getByRole("region", { name: "BrainChild core event" });

    expect(
      within(core).getByRole("heading", {
        level: 2,
        name: "BrainChild Season 2.0",
      })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { name: "BrainChild Season 2.0" })
    ).toHaveLength(1);
    expect(within(core).getByText("Team of 2-3")).toBeInTheDocument();
    expect(within(core).getByText("BDT 2,000 per team")).toBeInTheDocument();
  });

  it("shows official BrainChild actions and keeps registration lifecycle-aware", () => {
    render(<AiItFestCampaign events={campaignEvents} />);

    const core = screen.getByRole("region", { name: "BrainChild core event" });
    expect(within(core).getByRole("link", { name: "Register for BrainChild" })).toHaveAttribute(
      "href",
      "https://brainchild.jnuits.org.bd/register"
    );
    expect(within(core).getByRole("link", { name: "Track registration" })).toHaveAttribute(
      "href",
      "https://brainchild.jnuits.org.bd/track"
    );
    expect(within(core).getByRole("link", { name: "Read rulebook" })).toHaveAttribute(
      "href",
      expect.stringContaining("drive.google.com/file/d/")
    );

    const techCareCard = screen.getByRole("article", { name: "TechCare Zone" });
    expect(
      within(techCareCard).queryByRole("link", { name: "Register now" })
    ).not.toBeInTheDocument();
    expect(
      within(techCareCard).getByRole("link", { name: "View details" })
    ).toHaveAttribute("href", "/events/techcare-zone");
  });

  it("uses meaningful alt text for all six official artworks", () => {
    render(<AiItFestCampaign events={campaignEvents} />);

    expect(screen.getAllByRole("img")).toHaveLength(6);
    for (const event of campaignEvents) {
      expect(
        screen.getByRole("img", { name: `${event.title} official artwork` })
      ).toBeInTheDocument();
    }
  });

  it("renders nothing unless both the umbrella and core event are present", () => {
    const { container, rerender } = render(
      <AiItFestCampaign events={campaignEvents.slice(1)} />
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <AiItFestCampaign
        events={campaignEvents.filter(
          (event) => event.slug !== "brainchild-season-2-0"
        )}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
