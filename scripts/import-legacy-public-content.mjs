#!/usr/bin/env node

import process from "node:process";
import {
  buildLegacyMysqlConnection,
  buildSupabaseAdminClient,
  deriveReadTime,
  deriveSummary,
  ensureCloudinaryImageAsset,
  ensureLegacyDownloadCopy,
  extractPlainText,
  getLegacyRoots,
  resolveLegacyAssetSource,
  resolveReportPath,
  slugify,
  writeJsonReport,
} from "./lib/legacy-content.mjs";

function parseArgs(argv) {
  const options = {
    apply: false,
    report: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--apply") options.apply = true;
    if (token === "--dry-run") options.apply = false;
    if (token === "--report" && argv[index + 1]) {
      options.report = argv[index + 1];
      index += 1;
    }
    if (token.startsWith("--report=")) {
      options.report = token.split("=")[1] || "";
    }
  }

  return options;
}

function firstParagraph(value) {
  const normalized = String(value || "")
    .split(/\n{2,}/)
    .map((entry) => extractPlainText(entry))
    .find(Boolean);

  return normalized || deriveSummary(value);
}

function determineEventCategory(title) {
  const normalized = String(title || "").toLowerCase();

  if (normalized.includes("workshop")) return "Workshop";
  if (normalized.includes("course")) return "Course";
  if (normalized.includes("election")) return "Election";
  return "Program";
}

function extractFirstUrl(value) {
  const match = String(value || "").match(/https?:\/\/[^\s)]+/);
  return match?.[0] || null;
}

async function fetchLegacyPayloads(connection) {
  const [homeRows] = await connection.query(
    "select * from homepages where published_at is not null order by published_at desc limit 1"
  );
  const [aboutRows] = await connection.query(
    "select * from abouts where published_at is not null order by published_at desc limit 1"
  );
  const [contactRows] = await connection.query(
    "select * from contacts where published_at is not null order by published_at desc limit 1"
  );
  const [developerRows] = await connection.query(
    "select * from developer_infos where published_at is not null order by published_at desc limit 1"
  );
  const [blogRows] = await connection.query(`
    select
      blogs.*,
      files.name as media_name,
      files.alternative_text as media_alt_text,
      files.caption as media_caption,
      files.url as media_url
    from blogs
    left join files_related_mph
      on files_related_mph.related_type = 'api::blog.blog'
      and files_related_mph.related_id = blogs.id
      and files_related_mph.field = 'media'
    left join files on files.id = files_related_mph.file_id
    where blogs.published_at is not null
    order by blogs.published_at desc
  `);
  const [eventRows] = await connection.query(
    "select * from events where published_at is not null order by published_at desc"
  );
  const [noticeRows] = await connection.query(`
    select
      notices.*,
      files.name as media_name,
      files.url as media_url
    from notices
    left join files_related_mph
      on files_related_mph.related_type = 'api::notice.notice'
      and files_related_mph.related_id = notices.id
      and files_related_mph.field = 'media'
    left join files on files.id = files_related_mph.file_id
    where notices.published_at is not null
    order by notices.published_at desc
  `);

  return {
    about: aboutRows[0] || null,
    blogs: blogRows || [],
    contact: contactRows[0] || null,
    developers: developerRows[0] || null,
    events: eventRows || [],
    home: homeRows[0] || null,
    notices: noticeRows || [],
  };
}

async function ensureImportedAsset(supabase, report, spec) {
  const source = resolveLegacyAssetSource(spec.source);

  if (!source) {
    report.assets.skipped.push({
      publicId: spec.publicId,
      reason: `Source not found: ${spec.source}`,
      title: spec.title,
    });
    return null;
  }

  const asset = await ensureCloudinaryImageAsset({
    altText: spec.altText,
    metadata: {
      legacySource: spec.source,
      ...spec.metadata,
    },
    publicId: spec.publicId,
    source,
    supabase,
    title: spec.title,
  });

  report.assets.imported.push({
    id: asset.id,
    publicId: asset.public_id,
    secureUrl: asset.secure_url,
    title: spec.title,
  });

  return asset;
}

async function upsertContentPage(supabase, payload) {
  const { data, error } = await supabase
    .from("content_pages")
    .upsert(payload, { onConflict: "slug" })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || `Unable to save content page ${payload.slug}.`);
  }

  return data.id;
}

async function upsertContentPost(supabase, payload) {
  const { data, error } = await supabase
    .from("content_posts")
    .upsert(payload, { onConflict: "slug" })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || `Unable to save content post ${payload.slug}.`);
  }

  return data.id;
}

async function upsertNamedRow(supabase, table, keyField, keyValue, payload) {
  const { data: existing, error: readError } = await supabase
    .from(table)
    .select("id")
    .eq(keyField, keyValue)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message || `Unable to update ${table} row.`);
    }

    return data.id;
  }

  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || `Unable to insert ${table} row.`);
  }

  return data.id;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const reportPath = resolveReportPath(
    "content",
    "legacy-public-content-import-report",
    options.report
  );
  const mysqlConnection = await buildLegacyMysqlConnection();
  const supabase = buildSupabaseAdminClient();
  const legacyData = await fetchLegacyPayloads(mysqlConnection);
  const { legacyFrontendRoot } = getLegacyRoots();
  const report = {
    generatedAt: new Date().toISOString(),
    legacySource: {
      frontendRoot: legacyFrontendRoot,
      hasAbout: Boolean(legacyData.about),
      hasContact: Boolean(legacyData.contact),
      hasDeveloperInfo: Boolean(legacyData.developers),
      hasHome: Boolean(legacyData.home),
      publishedBlogs: legacyData.blogs.length,
      publishedEvents: legacyData.events.length,
      publishedNotices: legacyData.notices.length,
    },
    mode: options.apply ? "apply" : "dry-run",
    assets: {
      imported: [],
      skipped: [],
    },
    pages: [],
    posts: [],
    developers: [],
    gallery: [],
    downloads: [],
  };

  const assetSpecs = {
    aboutIntro: {
      altText: "JnUITS members gathered for a society program",
      metadata: { legacySurface: "about-intro" },
      publicId: "jnuits/legacy/about/intro",
      source:
        legacyData.about?.body?.intro?.imageUrl ||
        "/images/458184850_1828665914292568_3599971598568655445_n.jpg",
      title: "About intro image",
    },
    achievementBanner: {
      altText: "JnUITS achievement banner",
      metadata: { legacySurface: "home-achievements" },
      publicId: "jnuits/legacy/home/achievements",
      source:
        legacyData.home?.achievements?.image || "/images/achivement.jpg",
      title: "Homepage achievements banner",
    },
    bccCourse: {
      altText: "JnUITS Basic Computer Course artwork",
      metadata: { legacySurface: "event-bcc-course" },
      publicId: "jnuits/legacy/events/bcc-course",
      source: "/images/bccCourse.jpg",
      title: "BCC course feature image",
    },
    groupPic1: {
      altText: "JnUITS group photo 1",
      metadata: { legacySurface: "gallery" },
      publicId: "jnuits/legacy/gallery/group-pic-1",
      source: "/images/grouppic1.jpg",
      title: "Group photo 1",
    },
    groupPic2: {
      altText: "JnUITS group photo 2",
      metadata: { legacySurface: "gallery" },
      publicId: "jnuits/legacy/gallery/group-pic-2",
      source: "/images/grouppic2.jpg",
      title: "Group photo 2",
    },
    groupPic3: {
      altText: "JnUITS group photo 3",
      metadata: { legacySurface: "gallery" },
      publicId: "jnuits/legacy/gallery/group-pic-3",
      source: "/images/grouppic3.jpg",
      title: "Group photo 3",
    },
    groupPic4: {
      altText: "JnUITS group photo 4",
      metadata: { legacySurface: "gallery" },
      publicId: "jnuits/legacy/gallery/group-pic-4",
      source: "/images/grouppic4.jpg",
      title: "Group photo 4",
    },
    homeHeroOne: {
      altText: "Welcome to JnUITS slide artwork",
      metadata: { legacySurface: "home-hero" },
      publicId: "jnuits/legacy/home/hero-slide-1",
      source: legacyData.home?.hero_slides?.[0]?.image || "/images/c1.jpg",
      title: "Homepage hero slide 1",
    },
    recentActivityBanner: {
      altText: "JnUITS recent activity photo",
      metadata: { legacySurface: "home-recent-activities" },
      publicId: "jnuits/legacy/home/recent-activities",
      source: "/uploads/475134784_1042854600934793_5133630148471809740_n_5c4d9987b4.jpg",
      title: "Homepage recent activities banner",
    },
    speakUpWorkshop: {
      altText: "Speak Up public speaking workshop group photo",
      metadata: { legacySurface: "event-speak-up" },
      publicId: "jnuits/legacy/events/speak-up-workshop",
      source: "/uploads/IMG_4975_8aab96b417.jpeg",
      title: "Speak Up workshop photo",
    },
    waImage01: {
      altText: "JnUITS archive photo 01",
      metadata: { legacySurface: "gallery" },
      publicId: "jnuits/legacy/gallery/archive-01",
      source: "/images/IMG-20241024-WA0001.jpg",
      title: "Archive photo 01",
    },
    waImage02: {
      altText: "JnUITS archive photo 02",
      metadata: { legacySurface: "gallery" },
      publicId: "jnuits/legacy/gallery/archive-02",
      source: "/images/IMG-20241024-WA0002.jpg",
      title: "Archive photo 02",
    },
  };

  if (!options.apply) {
    writeJsonReport(reportPath, report);
    console.log("");
    console.log("Legacy public content import report generated.");
    console.log(`Mode: ${report.mode}`);
    console.log(`Report: ${reportPath}`);
    console.log(`Published blogs: ${legacyData.blogs.length}`);
    console.log(`Published events: ${legacyData.events.length}`);
    console.log(`Published notices: ${legacyData.notices.length}`);
    await mysqlConnection.end();
    return;
  }

  const importedAssets = {};

  for (const [key, spec] of Object.entries(assetSpecs)) {
    importedAssets[key] = await ensureImportedAsset(supabase, report, spec);
  }

  const homePageId = await upsertContentPage(supabase, {
    body: {
      aboutSection: {
        buttonLink:
          legacyData.home?.about_section?.buttonLink || "/about",
        buttonText:
          legacyData.home?.about_section?.buttonText || "Learn More",
        description:
          legacyData.home?.about_section?.description ||
          "Learn more about JnUITS and its mission.",
        imageSrc: importedAssets.aboutIntro?.secure_url || importedAssets.groupPic4?.secure_url,
        title: legacyData.home?.about_section?.title || "About Us",
      },
      achievements: {
        imageSrc:
          importedAssets.achievementBanner?.secure_url || importedAssets.groupPic1?.secure_url,
        items: legacyData.home?.achievements?.items || [],
        title: legacyData.home?.achievements?.title || "Our Achievements",
      },
      heroSlides: [
        {
          buttonLink:
            legacyData.home?.hero_slides?.[0]?.buttonLink || "/membership-form",
          buttonText:
            legacyData.home?.hero_slides?.[0]?.buttonText || "Explore More",
          description:
            legacyData.home?.hero_slides?.[0]?.description ||
            "Discover the work, people, and programs of JnUITS.",
          imageSrc:
            importedAssets.homeHeroOne?.secure_url || importedAssets.groupPic4?.secure_url,
          title:
            legacyData.home?.hero_slides?.[0]?.title || "Welcome to JnUITS",
        },
        {
          buttonLink:
            legacyData.home?.hero_slides?.[1]?.buttonLink || "/membership-form",
          buttonText:
            legacyData.home?.hero_slides?.[1]?.buttonText || "Join Now",
          description:
            legacyData.home?.hero_slides?.[1]?.description ||
            "Become a part of the JnUITS community.",
          imageSrc: importedAssets.groupPic4?.secure_url,
          title:
            legacyData.home?.hero_slides?.[1]?.title || "Join Our Community",
        },
      ],
      recentActivities: {
        activities: legacyData.home?.recent_activities?.activities || [],
        imageSrc:
          importedAssets.recentActivityBanner?.secure_url || importedAssets.groupPic2?.secure_url,
        title:
          legacyData.home?.recent_activities?.title || "Recent Activities",
      },
    },
    eyebrow: "Official JnUITS homepage",
    slug: "home",
    status: "published",
    summary:
      legacyData.home?.hero_slides?.[0]?.description ||
      legacyData.home?.about_section?.description ||
      "Discover the official public site of Jagannath University IT Society.",
    title:
      legacyData.home?.hero_slides?.[0]?.title || "Welcome to JnUITS",
  });
  report.pages.push({ id: homePageId, slug: "home", title: "Welcome to JnUITS" });

  const aboutBody = legacyData.about?.body || {};
  const aboutPageId = await upsertContentPage(supabase, {
    body: {
      imageSrc: importedAssets.aboutIntro?.secure_url || importedAssets.groupPic4?.secure_url,
      missionPoints: (aboutBody.keyFeatures?.features || []).map(
        (feature) =>
          `${String(feature.title || "").trim()} ${String(
            feature.description || ""
          ).trim()}`.trim()
      ),
      missionTitle:
        aboutBody.keyFeatures?.title || "Key Features of the IT Society",
      story: [
        aboutBody.intro?.description ||
          "Jagannath University IT Society is a prominent student organization at Jagannath University.",
        aboutBody.keyFeatures?.conclusion ||
          "This society helps prepare students for the evolving demands of the global tech industry.",
      ],
      values: aboutBody.values || [],
    },
    eyebrow: "Institutional profile",
    slug: "about",
    status: "published",
    summary:
      aboutBody.intro?.description ||
      "Learn about the mission, values, and initiatives of JnUITS.",
    title: aboutBody.intro?.title || "About Our JnUITS Society",
  });
  report.pages.push({ id: aboutPageId, slug: "about", title: aboutBody.intro?.title || "About Our JnUITS Society" });

  const contactFooter = legacyData.contact?.footer || {};
  const contactPagePayload = {
    body: {
      email: contactFooter.email || "info@jnuits.org.bd",
      location: contactFooter.location || "Jagannath University, Dhaka, Bangladesh",
      phone: "+880 1XXX-XXXXXX",
      socialLinks: [
        { href: "https://www.facebook.com/jnuitsbd", label: "Facebook" },
        { href: "https://www.linkedin.com", label: "LinkedIn" },
      ],
      university:
        contactFooter.university || "Jagannath University IT Society (JnUITS)",
    },
    eyebrow: "Contact",
    slug: "contact",
    status: "published",
    summary:
      "Reach the JnUITS team for events, membership, and collaboration.",
    title: "Contact JnUITS",
  };

  const contactPageId = await upsertContentPage(supabase, contactPagePayload);
  const footerPageId = await upsertContentPage(supabase, {
    ...contactPagePayload,
    body: {
      email: contactFooter.email || "info@jnuits.org.bd",
      location: contactFooter.location || "Jagannath University, Dhaka, Bangladesh",
      subtitle: "Unified website, portal, and operator stack",
      university:
        contactFooter.university || "Jagannath University IT Society (JnUITS)",
    },
    slug: "footer",
    summary:
      "Official JnUITS contact and institution details for the rebuilt platform.",
    title:
      contactFooter.university || "Jagannath University IT Society (JnUITS)",
  });
  report.pages.push({ id: contactPageId, slug: "contact", title: "Contact JnUITS" });
  report.pages.push({
    id: footerPageId,
    slug: "footer",
    title: contactFooter.university || "Jagannath University IT Society (JnUITS)",
  });

  for (const developer of legacyData.developers?.members || []) {
    const mediaAsset = developer.image
      ? await ensureImportedAsset(supabase, report, {
          altText: `${developer.name} profile photo`,
          metadata: { legacySurface: "developer-profile" },
          publicId: `jnuits/legacy/developers/${slugify(developer.name)}`,
          source: developer.image,
          title: `${developer.name} profile photo`,
        })
      : null;

    const developerId = await upsertNamedRow(
      supabase,
      "developer_profiles",
      "name",
      developer.name,
      {
        bio: developer.bio || "Developer profile imported from the legacy site.",
        focus:
          developer.github || developer.linkedin || developer.facebook || developer.role,
        is_lead: Boolean(developer.isChief),
        media_asset_id: mediaAsset?.id || null,
        name: developer.name,
        role: developer.role || "Contributor",
        sort_order: developer.isChief ? 10 : 100,
        status: "published",
      }
    );

    report.developers.push({
      id: developerId,
      isLead: Boolean(developer.isChief),
      name: developer.name,
    });
  }

  for (const blog of legacyData.blogs) {
    const mediaAsset = blog.media_url
      ? await ensureImportedAsset(supabase, report, {
          altText: blog.media_alt_text || blog.title,
          metadata: { legacySourceTable: "blogs" },
          publicId: `jnuits/legacy/blogs/${slugify(blog.title)}/cover`,
          source: blog.media_url,
          title: blog.media_name || `${blog.title} cover`,
        })
      : null;

    const slug = slugify(blog.title);
    const postId = await upsertContentPost(supabase, {
      body: blog.body || null,
      category: "Blog",
      content_type: "blog",
      cta_href: null,
      excerpt: firstParagraph(blog.body),
      location: null,
      media_asset_id: mediaAsset?.id || null,
      published_at: blog.published_at,
      read_time: deriveReadTime(blog.body),
      slug,
      starts_at: null,
      status: "published",
      summary: deriveSummary(blog.body),
      title: blog.title,
    });

    report.posts.push({
      id: postId,
      slug,
      title: blog.title,
      type: "blog",
    });
  }

  for (const event of legacyData.events) {
    const eventPublicId = slugify(event.name);
    const eventMediaSpec =
      event.name?.toLowerCase().includes("speak up")
        ? assetSpecs.speakUpWorkshop
        : assetSpecs.bccCourse;
    const mediaAsset = await ensureImportedAsset(supabase, report, eventMediaSpec);
    const slug = eventPublicId;
    const postId = await upsertContentPost(supabase, {
      body: event.blog || null,
      category: determineEventCategory(event.name),
      content_type: "event",
      cta_href: event.facebook || extractFirstUrl(event.blog),
      excerpt: firstParagraph(event.blog || event.description),
      location: "Jagannath University, Dhaka",
      media_asset_id: mediaAsset?.id || null,
      published_at: event.published_at,
      read_time: null,
      slug,
      starts_at: event.start,
      status: "published",
      summary: event.description || deriveSummary(event.blog),
      title: event.name,
      ends_at: event.end,
    });

    report.posts.push({
      id: postId,
      slug,
      title: event.name,
      type: "event",
    });
  }

  for (const notice of legacyData.notices) {
    let ctaHref = notice.external_link || null;

    if (!ctaHref && notice.media_url?.endsWith(".pdf")) {
      try {
        ensureLegacyDownloadCopy(notice.media_url, "/downloads/viva-notice.pdf");
        ctaHref = "/downloads/viva-notice.pdf";
        report.downloads.push({
          source: notice.media_url,
          status: "copied",
          target: "/downloads/viva-notice.pdf",
        });
      } catch (error) {
        report.downloads.push({
          reason:
            error instanceof Error
              ? error.message
              : "Legacy download copy failed.",
          source: notice.media_url,
          status: "missing",
          target: null,
        });
      }
    }

    const slug = slugify(notice.title);
    const postId = await upsertContentPost(supabase, {
      body: notice.description || null,
      category: notice.category || "Notice",
      content_type: "notice",
      cta_href: ctaHref,
      excerpt: notice.description || null,
      location: null,
      media_asset_id: null,
      published_at: notice.published_at || notice.datetime,
      read_time: null,
      slug,
      starts_at: null,
      status: "published",
      summary: notice.description || null,
      title: notice.title,
      ends_at: null,
    });

    report.posts.push({
      id: postId,
      slug,
      title: notice.title,
      type: "notice",
    });
  }

  const galleryItems = [
    {
      assetKey: "groupPic1",
      caption: "A legacy group photograph carried forward into the new gallery archive.",
      title: "Legacy group photo 1",
    },
    {
      assetKey: "groupPic2",
      caption: "Another archival public-facing image from the previous website.",
      title: "Legacy group photo 2",
    },
    {
      assetKey: "groupPic3",
      caption: "Program and community atmosphere from the older public site.",
      title: "Legacy group photo 3",
    },
    {
      assetKey: "groupPic4",
      caption: "A featured society gathering image reused from the previous frontend.",
      title: "Legacy group photo 4",
    },
    {
      assetKey: "waImage01",
      caption: "Imported from the older static gallery image set.",
      title: "Archive photo 01",
    },
    {
      assetKey: "waImage02",
      caption: "Imported from the older static gallery image set.",
      title: "Archive photo 02",
    },
  ];

  for (const [index, item] of galleryItems.entries()) {
    const mediaAsset = importedAssets[item.assetKey];

    if (!mediaAsset) {
      continue;
    }

    const galleryId = await upsertNamedRow(
      supabase,
      "gallery_entries",
      "title",
      item.title,
      {
        caption: item.caption,
        media_asset_id: mediaAsset.id,
        sort_order: (index + 1) * 10,
        status: "published",
        title: item.title,
      }
    );

    report.gallery.push({
      id: galleryId,
      title: item.title,
    });
  }

  await supabase.from("operator_reports").insert({
    report: report,
    report_type: "content_inventory",
    status: "completed",
    summary: "Legacy public content, Cloudinary media, and notice attachments were imported into the unified stack.",
    title: "Legacy public content import",
  });

  await supabase.from("audit_events").insert({
    action: "content.legacy_public_imported",
    entity_type: "content_import",
    metadata: {
      assetsImported: report.assets.imported.length,
      developersImported: report.developers.length,
      galleryImported: report.gallery.length,
      pagesImported: report.pages.length,
      postsImported: report.posts.length,
    },
  });

  writeJsonReport(reportPath, report);

  console.log("");
  console.log("Legacy public content import completed.");
  console.log(`Mode: ${report.mode}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Assets imported: ${report.assets.imported.length}`);
  console.log(`Pages imported: ${report.pages.length}`);
  console.log(`Posts imported: ${report.posts.length}`);
  console.log(`Developer profiles imported: ${report.developers.length}`);
  console.log(`Gallery entries imported: ${report.gallery.length}`);

  await mysqlConnection.end();
}

main().catch((error) => {
  console.error("Legacy public content import failed.");
  console.error(String(error));
  process.exitCode = 1;
});
