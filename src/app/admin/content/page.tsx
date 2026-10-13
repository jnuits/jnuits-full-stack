import Link from "next/link";
import { BookOpen, Calendar, Image as ImageIcon, FolderOpen, FileText, Upload, BarChart2 } from "lucide-react";
import { hasPermission, requireAdminPermission } from "@/lib/auth/session";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCloudinaryConfigured } from "@/lib/cloudinary/config";

export const metadata = { title: "Content Hub — Admin | JnUITS" };
const workspaces = [
  {href:"/admin/content/media",permission:"cms.media.manage",icon:Upload,label:"Media & Assets",desc:"Upload photos and videos to Cloudinary, register asset IDs",table:"media_assets"},
  {href:"/admin/content/blogs",permission:"cms.blogs.review",icon:BookOpen,label:"Blogs",desc:"Review member submissions and manage published blogs",table:"content_posts",contentType:"blog"},
  {href:"/admin/content/notices",permission:"cms.notices.manage",icon:FileText,label:"Notices",desc:"Publish official announcements and stable notice routes",table:"content_posts",contentType:"notice"},
  {href:"/admin/content/events",permission:"cms.events.manage",icon:Calendar,label:"Events",desc:"Manage public events, dates and locations",table:"events"},
  {href:"/admin/content/gallery",permission:"cms.gallery.manage",icon:ImageIcon,label:"Gallery",desc:"Manage gallery albums and Cloudinary-backed items",table:"gallery_albums"},
  {href:"/admin/content/projects",permission:"cms.projects.manage",icon:FolderOpen,label:"Projects",desc:"Projects and developer profile management",table:"projects"},
  {href:"/admin/content/pages",permission:"cms.pages.manage",icon:FileText,label:"Advanced page content",desc:"Singleton copy for Home, Contact and Footer",table:"content_pages"},
  {href:"/admin/content/about",permission:"cms.pages.manage",icon:FileText,label:"About",desc:"Mission, vision, timeline, stats and community reach"},
  {href:"/admin/content/slider",permission:"cms.pages.manage",icon:ImageIcon,label:"Slider",desc:"Manage the complete public slider collection"},
  {href:"/admin/content/forms",permission:"cms.forms.manage",icon:FileText,label:"Forms",desc:"Form Studio definitions and response workflows"},
  {href:"/admin/settings/contact",permission:"admin.settings.read",icon:FileText,label:"Contact Settings",desc:"Organization contact and communication settings"},
] as const;

export default async function ContentHubPage() {
  await requireAdminPermission("admin.dashboard.read", {fallbackPath:"/admin/dashboard"});
  const capabilities = new Map(await Promise.all([...new Set(workspaces.map(w=>w.permission))].map(async permission=>[permission,await hasPermission(permission)] as const)));
  const allowed = workspaces.filter(w=>capabilities.get(w.permission));
  const admin=asFlexibleClient(createAdminClient());
  const tiles=await Promise.all(allowed.map(async workspace=>{
    if (!("table" in workspace)) return {...workspace,count:null,pending:null};
    let query=admin.from(workspace.table).select("id",{count:"exact",head:true});
    if ("contentType" in workspace) query=query.eq("content_type",workspace.contentType);
    const result=await query;
    const pending=workspace.href === "/admin/content/blogs" ? await admin.from("content_posts").select("id",{count:"exact",head:true}).eq("content_type","blog").eq("status","pending_review") : null;
    return {...workspace,count:result.error ? "Unavailable" : result.count ?? "Unavailable",pending:pending?.error ? null : pending?.count ?? null};
  }));
  const cloudinaryConfigured=isCloudinaryConfigured();
  return <div className="grid gap-8">
    <div className="admin-page-header"><div>
      <p className="admin-page-header__breadcrumb">Admin</p><h1 className="admin-page-header__title">Content</h1>
      <p className="admin-page-header__desc">Select an available workspace to manage its content. Each workspace retains its own permissions and workflow.</p>
    </div>{capabilities.get("cms.media.manage") ? <span className={`abadge ${cloudinaryConfigured ? "abadge--active" : "abadge--draft"}`}><BarChart2 size={10}/>{cloudinaryConfigured ? "Cloudinary configured" : "Cloudinary unconfigured"}</span> : null}</div>
    <div className="admin-hub-grid">{tiles.map(tile=><Link key={tile.href} href={tile.href} className="admin-hub-tile">
      <div className="flex items-center justify-between gap-2"><div className="admin-hub-tile__icon"><tile.icon size={20}/></div>{tile.pending ? <span className="abadge abadge--pending">{tile.pending} pending</span> : null}</div>
      <div>{tile.count !== null ? <p className="admin-hub-tile__count">{tile.count}</p> : null}<p className="admin-hub-tile__label">{tile.label}</p><p className="admin-hub-tile__desc">{tile.desc}</p></div>
    </Link>)}</div>
    {tiles.length === 0 ? <p className="route-tile">No content workspace is assigned to your account. My Profile and your other permitted areas remain available in navigation.</p> : null}
  </div>;
}
