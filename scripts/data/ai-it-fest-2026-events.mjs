export const AI_IT_FEST_2026_CAMPAIGN_ID = "jnu-ai-it-fest-2026";

const VERIFIED_AT = "2026-08-14";
const FEST_HOMEPAGE_URL = "https://itfest.jnuits.org.bd/";
const FEST_INDEX_URL = "https://itfest.jnuits.org.bd/events";
const FEST_API_URL = "https://festapi.jnuits.org.bd/api/events";
const BRAINCHILD_OVERVIEW_URL = "https://brainchild.jnuits.org.bd/";
const BRAINCHILD_REGISTER_URL = "https://brainchild.jnuits.org.bd/register";
const BRAINCHILD_TRACK_URL = "https://brainchild.jnuits.org.bd/track";
const BRAINCHILD_RULEBOOK_URL =
  "https://drive.google.com/file/d/1txSeyWJIOFxNW3XFUmjYZMrkN6uEemFj/view?usp=sharing";
const CAMPAIGN_MEDIA_FOLDER =
  "jnuits/jnuits-full-stack/campaigns/ai-it-fest-2026";
const STARTS_AT = "2026-08-30T03:00:00Z";
const STANDARD_DEADLINE = "2026-08-15T17:59:00Z";

const sharedProvenance = {
  campaignId: AI_IT_FEST_2026_CAMPAIGN_ID,
  officialIndexUrl: FEST_INDEX_URL,
  verifiedAt: VERIFIED_AT,
};

function mediaDefinition(key, filename, title, altText, sourceUrl) {
  return {
    altText,
    key,
    metadata: {
      campaignId: AI_IT_FEST_2026_CAMPAIGN_ID,
      sourceUrl,
      verifiedAt: VERIFIED_AT,
    },
    publicId: `${CAMPAIGN_MEDIA_FOLDER}/${filename}`,
    sourceUrl,
    title,
  };
}

export const AI_IT_FEST_2026_MEDIA = [
  mediaDefinition(
    "fest",
    "jnu-ai-it-fest-2026",
    "JnU AI & IT Fest 2026",
    "JnU AI & IT Fest 2026 official campaign artwork",
    "https://res.cloudinary.com/dbwbwwteo/image/upload/v1786029922/ChatGPT_Image_Aug_6_2026_09_24_46_PM_hrzm6x.png"
  ),
  mediaDefinition(
    "ai-it-olympiad",
    "ai-it-olympiad",
    "AI & IT Olympiad",
    "AI & IT Olympiad official event artwork",
    "https://res.cloudinary.com/dbwbwwteo/image/upload/v1786288217/events/wppftrsdjijguyzoboal.png"
  ),
  mediaDefinition(
    "techuncut",
    "techuncut",
    "TechUncut",
    "TechUncut official event artwork",
    "https://res.cloudinary.com/dbwbwwteo/image/upload/v1786206237/events/pqoqykn18hkodiyp5fdx.png"
  ),
  mediaDefinition(
    "techcare-zone",
    "techcare-zone",
    "TechCare Zone",
    "TechCare Zone official event artwork",
    "https://res.cloudinary.com/dbwbwwteo/image/upload/v1786206072/events/frz69uze8rulzkytkj4p.png"
  ),
  mediaDefinition(
    "ai-ad-venture",
    "ai-ad-venture",
    "AI Ad-Venture",
    "AI Ad-Venture official event artwork",
    "https://res.cloudinary.com/dbwbwwteo/image/upload/v1786205719/events/m0bgyijodaq89sb2rcor.png"
  ),
  mediaDefinition(
    "brainchild-season-2-0",
    "brainchild-season-2-0",
    "BrainChild Season 2.0",
    "BrainChild Season 2.0 official campaign artwork",
    "https://res.cloudinary.com/dqmpifybz/image/upload/c_fill,w_1200,h_630,q_auto/v1786561665/BrainChild_Season_2.0_1_gj3qld.png"
  ),
];

function standardApiProvenance({ id, slug }) {
  return {
    ...sharedProvenance,
    deadlinePrecision: "minute",
    deadlineSourceUrl: FEST_API_URL,
    deadlineSourceValue: "2026-08-15T23:59",
    officialApiId: id,
    officialApiSlug: slug,
    officialApiUrl: FEST_API_URL,
    officialDetailUrl: `${FEST_INDEX_URL}/${slug}`,
    sourceEventDateValue: "2026-08-30T09:00",
    sourceKind: "official-fest-api",
  };
}

const sharedEvent = {
  capacity: null,
  deliveryMode: "offline",
  endsAt: null,
  locationMode: "venue",
  onlineUrl: null,
  registrationOpen: false,
  startsAt: STARTS_AT,
  timezone: "Asia/Dhaka",
  venueAddress: null,
};

export const AI_IT_FEST_2026_EVENTS = [
  {
    ...sharedEvent,
    bodyMarkdown: `## Where Ideas Meet Intelligence

Jagannath University IT Society presents JnU AI & IT Fest 2026 on 30 August 2026 at Jagannath University.

The official programme includes AI & IT Olympiad, TechUncut, TechCare Zone, AI Ad-Venture, and the core event, BrainChild Season 2.0.

[Explore the official Fest event index](${FEST_INDEX_URL}).`,
    category: "institutional",
    coverAltTextOverride: "JnU AI & IT Fest 2026 official campaign artwork",
    ctaLabel: "Explore all Fest events",
    ctaUrl: FEST_INDEX_URL,
    locationLabel:
      "Ground Floor, Shahid Sajid Building and Central Auditorium, Jagannath University",
    mediaKey: "fest",
    registrationClosesAt: null,
    registrationMode: "none",
    registrationUrl: null,
    slug: "jnu-ai-it-fest-2026",
    source: FEST_HOMEPAGE_URL,
    sourceMetadata: {
      ...sharedProvenance,
      officialHomepageUrl: FEST_HOMEPAGE_URL,
      sourceKind: "official-fest-site",
    },
    summary:
      "Where Ideas Meet Intelligence: JnUITS presents a day of AI, technology, creativity, support, and student innovation at Jagannath University.",
    title: "JnU AI & IT Fest 2026",
    venueName: "Jagannath University",
  },
  {
    ...sharedEvent,
    bodyMarkdown: `## Unleash Your Tech Potential

A national-level technology challenge for the next generation of technology enthusiasts.

- Junior segment: school and college
- Senior segment: university
- Participation: solo
- Registration fee: BDT 200

[View the official event and registration page](${FEST_INDEX_URL}/ai-it-olympiad).`,
    category: "competition",
    coverAltTextOverride: "AI & IT Olympiad official event artwork",
    ctaLabel: null,
    ctaUrl: null,
    locationLabel: "Ground Floor of Shahid Sajid Building",
    mediaKey: "ai-it-olympiad",
    registrationClosesAt: STANDARD_DEADLINE,
    registrationMode: "external",
    registrationUrl: `${FEST_INDEX_URL}/ai-it-olympiad`,
    slug: "ai-it-olympiad",
    source: FEST_API_URL,
    sourceMetadata: standardApiProvenance({
      id: "7c4f4aa2-61c5-4f62-a982-d86119e53602",
      slug: "ai-it-olympiad",
    }),
    summary:
      "A national-level AI and IT challenge with junior and senior solo segments for school, college, and university participants.",
    title: "AI & IT Olympiad",
    venueName: "Ground Floor of Shahid Sajid Building",
  },
  {
    ...sharedEvent,
    bodyMarkdown: `## Talks with Creators & AI Pioneers

TechUncut is the flagship conference of JnU AI & IT Fest 2026, featuring keynote speeches, fireside conversations, and panel discussions.

Confirmed speakers:

- M Manjur Mahmud, President, DataSoft Systems
- Nabila Khalid, Brand & Marketing Leader

Topics include artificial intelligence, software engineering, startups, the future of work, career development, research, innovation, and the Bangladesh technology ecosystem.

- Participation: solo admission
- Registration fee: BDT 200

[View the official event and registration page](${FEST_INDEX_URL}/techuncut).`,
    category: "institutional",
    coverAltTextOverride: "TechUncut official event artwork",
    ctaLabel: null,
    ctaUrl: null,
    locationLabel: "Central Auditorium, Jagannath University",
    mediaKey: "techuncut",
    registrationClosesAt: STANDARD_DEADLINE,
    registrationMode: "external",
    registrationUrl: `${FEST_INDEX_URL}/techuncut`,
    slug: "techuncut",
    source: FEST_API_URL,
    sourceMetadata: standardApiProvenance({
      id: "68891743-1928-4ea4-be5f-43d8a5c9d3da",
      slug: "techuncut",
    }),
    summary:
      "The Fest's flagship conference, bringing creators and AI pioneers together for talks on technology, careers, research, and innovation.",
    title: "TechUncut",
    venueName: "Central Auditorium, Jagannath University",
  },
  {
    ...sharedEvent,
    bodyMarkdown: `## Software Installation & System Setup Booth

TechCare Zone provides software installation and computer setup support throughout the festival, including operating systems, productivity software, development tools, drivers, configuration, optimization, and genuine software consultation.

- Registered Fest participants: free
- General visitors: BDT 100 service token

[View the official event and registration page](${FEST_INDEX_URL}/techcare-zone).`,
    category: "other-real-event",
    coverAltTextOverride: "TechCare Zone official event artwork",
    ctaLabel: null,
    ctaUrl: null,
    locationLabel: "Ground Floor of Shahid Sajid Building",
    mediaKey: "techcare-zone",
    registrationClosesAt: STANDARD_DEADLINE,
    registrationMode: "external",
    registrationUrl: `${FEST_INDEX_URL}/techcare-zone`,
    slug: "techcare-zone",
    source: FEST_API_URL,
    sourceMetadata: standardApiProvenance({
      id: "8ac9320d-5eba-46dd-8ffa-4ffe267285b6",
      slug: "techcare-zone",
    }),
    summary:
      "A festival support booth for software installation and system setup—free for registered participants, with a BDT 100 visitor token.",
    title: "TechCare Zone",
    venueName: "Ground Floor of Shahid Sajid Building",
  },
  {
    ...sharedEvent,
    bodyMarkdown: `## Prompt to Production Challenge

A national AI-powered creative competition where teams transform prompts into professional promotional advertisements with generative AI tools.

- Team size: 2-5 members
- Registration fee: BDT 300 per team
- The top 10 advertisements will be showcased inside the Central Auditorium

Evaluation covers creativity, prompt engineering, storytelling, marketing effectiveness, technical quality, and overall impact.

[View the official event and registration page](${FEST_INDEX_URL}/ai-ad-venture).`,
    category: "competition",
    coverAltTextOverride: "AI Ad-Venture official event artwork",
    ctaLabel: null,
    ctaUrl: null,
    locationLabel: "Ground Floor of Shahid Sajid Building",
    mediaKey: "ai-ad-venture",
    registrationClosesAt: STANDARD_DEADLINE,
    registrationMode: "external",
    registrationUrl: `${FEST_INDEX_URL}/ai-ad-venture`,
    slug: "ai-ad-venture",
    source: FEST_API_URL,
    sourceMetadata: standardApiProvenance({
      id: "f39fdeb0-dc99-4a6a-ba37-6396f086f329",
      slug: "ai-ad-venture",
    }),
    summary:
      "A national prompt-to-production challenge where teams of 2-5 create promotional advertisements using generative AI tools.",
    title: "AI Ad-Venture",
    venueName: "Ground Floor of Shahid Sajid Building",
  },
  {
    ...sharedEvent,
    bodyMarkdown: `## National App, Web & AI Project Expo

BrainChild Season 2.0 is the core software exhibition of JnU AI & IT Fest 2026. Student teams present applications, web platforms, AI-powered solutions, and other original software projects.

- Team size: 2-3 members
- Registration fee: BDT 2,000 per team
- Top 15 shortlisted teams are invited to exhibit
- Teams not shortlisted receive an 80% refund of the registration fee

[Explore BrainChild](${BRAINCHILD_OVERVIEW_URL}) · [Register](${BRAINCHILD_REGISTER_URL}) · [Track a registration](${BRAINCHILD_TRACK_URL}) · [Read the rulebook](${BRAINCHILD_RULEBOOK_URL})`,
    category: "competition",
    coverAltTextOverride: "BrainChild Season 2.0 official campaign artwork",
    ctaLabel: "Explore BrainChild",
    ctaUrl: BRAINCHILD_OVERVIEW_URL,
    locationLabel:
      "Ground Floor of Shahid Sajid Building, Jagannath University",
    mediaKey: "brainchild-season-2-0",
    registrationClosesAt: "2026-08-20T17:59:59Z",
    registrationMode: "external",
    registrationUrl: BRAINCHILD_REGISTER_URL,
    slug: "brainchild-season-2-0",
    source: BRAINCHILD_OVERVIEW_URL,
    sourceMetadata: {
      ...sharedProvenance,
      deadlineAuthority:
        "Dedicated BrainChild structured Offer.validThrough and timeline",
      deadlinePrecision: "second",
      deadlineSourceUrl: BRAINCHILD_OVERVIEW_URL,
      deadlineSourceValue: "2026-08-20T23:59:59+06:00",
      dedicatedOverviewUrl: BRAINCHILD_OVERVIEW_URL,
      dedicatedRegistrationUrl: BRAINCHILD_REGISTER_URL,
      dedicatedTrackUrl: BRAINCHILD_TRACK_URL,
      officialApiId: "f2ac1957-5f43-4116-abad-58a6b8ff9cea",
      officialApiSlug: "brainchild-season-20",
      officialApiUrl: FEST_API_URL,
      rulebookUrl: BRAINCHILD_RULEBOOK_URL,
      secondaryDeadlineSourceValue: "2026-08-15T23:59",
      sourceConflictResolution:
        "The dedicated BrainChild page is the event-specific authority and publishes 20 August 2026 consistently; the Fest API's 15 August value is retained as secondary provenance.",
      sourceEventDateValue: "2026-08-30T09:00",
      sourceKind: "official-brainchild-site",
    },
    summary:
      "The Fest's core national app, web, and AI project expo for student teams of 2-3, with the top 15 shortlisted for the live exhibition.",
    title: "BrainChild Season 2.0",
    venueName: "Ground Floor of Shahid Sajid Building, Jagannath University",
  },
];
