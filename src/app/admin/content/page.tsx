import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BookOpen,
  Calendar,
  Image as ImageIcon,
  FolderOpen,
  FileText,
  Upload,
  BarChart2,
} from "lucide-react";
import { isCloudinaryConfigured } from "@/lib/cloudinary/config";

export const metadata = { title: "Content Hub — Admin | JnUITS" };

export default async function ContentHubPage() {
  const admin = createAdminClient();
  const cloudinaryConfigured = isCloudinaryConfigured();

  const [mediaResult, pagesResult, postsResult, galleryResult, projectsResult] =
    await Promise.all([
      admin.from("media_assets").select("*", { count: "exact", head: true }),
      admin.from("content_pages").select("*", { count: "exact", head: true }),
      admin.from("content_posts").select("*", { count: "exact", head: true }),
      admin.from("gallery_albums").select("*", { count: "exact", head: true }),
      admin.from("projects").select("*", { count: "exact", head: true }),
    ]);

  const [blogCount, noticeCount, eventCount, submittedCount] = await Promise.all([
    admin
      .from("content_posts")
      .select("*", { count: "exact", head: true })
      .eq("content_type", "blog"),
    admin
      .from("content_posts")
      .select("*", { count: "exact", head: true })
      .eq("content_type", "notice"),
    admin.from("events").select("*", { count: "exact", head: true }),
    admin
      .from("content_posts")
      .select("*", { count: "exact", head: true })
      .eq("content_type", "blog")
      .eq("status", "pending_review"),
  ]);

  const tiles = [
    {
      href: "/admin/content/media",
      icon: <Upload size={20} />,
      count: mediaResult.count || 0,
      label: "Media & Assets",
      desc: "Upload photos and videos to Cloudinary, register asset IDs",
    },
    {
      href: "/admin/content/blogs",
      icon: <BookOpen size={20} />,
      count: blogCount.count || 0,
      label: "Blogs",
      desc: `${submittedCount.count || 0} member submission${(submittedCount.count || 0) !== 1 ? "s" : ""} pending review`,
      badge: (submittedCount.count || 0) > 0 ? submittedCount.count : null,
    },
    {
      href: "/admin/content/notices",
      icon: <FileText size={20} />,
      count: noticeCount.count || 0,
      label: "Notices",
      desc: "Publish official announcements and stable notice routes",
    },
    {
      href: "/admin/content/events",
      icon: <Calendar size={20} />,
      count: eventCount.count || 0,
      label: "Events",
      desc: "Create and manage public events with dates and locations",
    },
    {
      href: "/admin/content/gallery",
      icon: <ImageIcon size={20} />,
      count: galleryResult.count || 0,
      label: "Gallery",
      desc: "Manage gallery albums and Cloudinary-backed items",
    },
    {
      href: "/admin/content/projects",
      icon: <FolderOpen size={20} />,
      count: projectsResult.count || 0,
      label: "Projects",
      desc: "Projects and developer profile management",
    },
    {
      href: "/admin/content/pages",
      icon: <FileText size={20} />,
      count: pagesResult.count || 0,
      label: "Advanced page content",
      desc: "Advanced singleton copy for home, contact, and footer",
    },
  ];

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin</p>
          <h1 className="admin-page-header__title">Content</h1>
          <p className="admin-page-header__desc">
            Manage all public-facing content. Select a section below to access its dedicated management tools.
          </p>
        </div>
        <span className={`abadge ${cloudinaryConfigured ? "abadge--active" : "abadge--draft"}`}>
          <BarChart2 size={10} />
          {cloudinaryConfigured ? "Cloudinary configured" : "Cloudinary unconfigured"}
        </span>
      </div>

      {/* Hub tiles */}
      <div className="admin-hub-grid">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href} className="admin-hub-tile">
            <div className="flex items-center justify-between gap-2">
              <div className="admin-hub-tile__icon">{tile.icon}</div>
              {tile.badge && (
                <span className="abadge abadge--pending">{tile.badge} pending</span>
              )}
            </div>
            <div>
              <p className="admin-hub-tile__count">{tile.count}</p>
              <p className="admin-hub-tile__label">{tile.label}</p>
              <p className="admin-hub-tile__desc">{tile.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick stats */}
      <section>
        <p className="admin-section-label">Content at a glance</p>
        <div className="admin-metric-grid">
          <div className="admin-metric-card" data-tone="info">
            <p className="admin-metric-card__label">Total posts</p>
            <p className="admin-metric-card__value">{postsResult.count || 0}</p>
            <p className="admin-metric-card__sub">Blogs + notices</p>
          </div>
          <div className="admin-metric-card" data-tone="warning">
            <p className="admin-metric-card__label">Pending review</p>
            <p className="admin-metric-card__value">{submittedCount.count || 0}</p>
            <p className="admin-metric-card__sub">Member blog submissions</p>
          </div>
          <div className="admin-metric-card">
            <p className="admin-metric-card__label">Media assets</p>
            <p className="admin-metric-card__value">{mediaResult.count || 0}</p>
            <p className="admin-metric-card__sub">Cloudinary references</p>
          </div>
          <div className="admin-metric-card" data-tone="success">
            <p className="admin-metric-card__label">Pages live</p>
            <p className="admin-metric-card__value">{pagesResult.count || 0}</p>
            <p className="admin-metric-card__sub">Singleton pages</p>
          </div>
        </div>
      </section>
    </div>
  );
}
