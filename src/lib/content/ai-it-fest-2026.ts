export const AI_IT_FEST_2026_EVENT_SLUGS = [
  "jnu-ai-it-fest-2026",
  "ai-it-olympiad",
  "techuncut",
  "techcare-zone",
  "ai-ad-venture",
  "brainchild-season-2-0",
] as const;

export const AI_IT_FEST_2026_UMBRELLA_SLUG = "jnu-ai-it-fest-2026";
export const AI_IT_FEST_2026_STANDARD_EVENT_SLUGS = [
  "ai-it-olympiad",
  "techuncut",
  "techcare-zone",
  "ai-ad-venture",
] as const;
export const AI_IT_FEST_2026_CORE_EVENT_SLUG = "brainchild-season-2-0";

export const AI_IT_FEST_2026_URLS = {
  brainchildOverview: "https://brainchild.jnuits.org.bd/",
  brainchildRulebook:
    "https://drive.google.com/file/d/1txSeyWJIOFxNW3XFUmjYZMrkN6uEemFj/view?usp=sharing",
  brainchildTrack: "https://brainchild.jnuits.org.bd/track",
  festEvents: "https://itfest.jnuits.org.bd/events",
  festOverview: "https://itfest.jnuits.org.bd/",
} as const;

export const AI_IT_FEST_2026_PRESENTATION = {
  "ai-it-olympiad": { fee: "BDT 200", participation: "Solo" },
  "techuncut": { fee: "BDT 200", participation: "Solo admission" },
  "techcare-zone": {
    fee: "Free for Fest participants · BDT 100 visitor token",
    participation: "Individual service",
  },
  "ai-ad-venture": { fee: "BDT 300 per team", participation: "Team of 2-5" },
  "brainchild-season-2-0": {
    fee: "BDT 2,000 per team",
    participation: "Team of 2-3",
  },
} as const;
