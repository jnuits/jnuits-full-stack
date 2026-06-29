import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import {
  createProject,
  updateProject,
  deleteProject,
  saveDeveloperProfile,
} from "@/app/admin/content/actions";
import { getAllProjectsForAdmin } from "@/lib/content/projects";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { FolderOpen, User } from "lucide-react";

type DeveloperRecord = {
  id: string;
  name: string;
  role: string | null;
  focus: string | null;
  bio: string | null;
  status: string;
  is_lead: boolean;
  sort_order: number;
  media_asset_id: string | null;
  updated_at: string;
};

type MediaAssetOption = { id: string; title: string | null; public_id: string; media_kind: string };

export const metadata = { title: "Projects — Admin | JnUITS" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const resolved = await searchParams;
  const editProjectId = typeof resolved.editProject === "string" ? resolved.editProject : "";
  const editDeveloperId = typeof resolved.editDeveloper === "string" ? resolved.editDeveloper : "";

  const [projectsData, devsResult, mediaResult] = await Promise.all([
    getAllProjectsForAdmin(),
    admin
      .from("developer_profiles")
      .select("id, name, role, focus, bio, status, is_lead, sort_order, media_asset_id, updated_at")
      .order("sort_order", { ascending: true })
      .limit(20),
    admin.from("media_assets").select("id, title, public_id, media_kind").order("created_at", { ascending: false }).limit(50),
  ]);

  const projects = projectsData || [];
  const devProfiles = (devsResult.data || []) as DeveloperRecord[];
  const media = (mediaResult.data || []) as MediaAssetOption[];
  const selectedProject = projects.find((p: { id: string }) => p.id === editProjectId) as import("@/lib/content/projects").ProjectSummary | null || null;
  const selectedDev = devProfiles.find((d) => d.id === editDeveloperId) || null;

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Content</p>
          <h1 className="admin-page-header__title">Projects &amp; Developers</h1>
          <p className="admin-page-header__desc">
            Manage public projects and developer profiles that appear on the website.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="abadge abadge--info">{projects.length} projects</span>
          <span className="abadge abadge--draft">{devProfiles.length} developers</span>
        </div>
      </div>

      {flash && (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="admin-section-label">Operator feedback</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">{flash.title}</h2>
          <p className="mt-1 text-sm leading-7">{flash.message}</p>
        </section>
      )}

      {/* Metrics */}
      <div className="admin-metric-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))" }}>
        <div className="admin-metric-card" data-tone="info">
          <div className="admin-metric-card__icon"><FolderOpen size={16} /></div>
          <p className="admin-metric-card__label">Total projects</p>
          <p className="admin-metric-card__value">{projects.length}</p>
          <p className="admin-metric-card__sub">All statuses</p>
        </div>
        <div className="admin-metric-card" data-tone="success">
          <div className="admin-metric-card__icon"><User size={16} /></div>
          <p className="admin-metric-card__label">Developers</p>
          <p className="admin-metric-card__value">{devProfiles.length}</p>
          <p className="admin-metric-card__sub">Public profiles</p>
        </div>
      </div>

      {/* Projects list */}
      <section>
        <p className="admin-section-label">Projects ({projects.length})</p>
        {projects.length === 0 ? (
          <EmptyState title="No projects yet" description="Create your first project using the form below." />
        ) : (
          <div className="admin-card-list">
            {projects.map((project) => (
              <div key={project.id} className="admin-card-row">
                <div className="admin-hub-tile__icon" style={{ flexShrink: 0 }}>
                  <FolderOpen size={16} />
                </div>
                <div className="admin-card-row__body">
                  <p className="admin-card-row__title">{project.title}</p>
                  <p className="admin-card-row__meta">{project.slug} · {project.category}</p>
                </div>
                <div className="admin-card-row__actions">
                  <Link href={`/admin/content/projects?editProject=${project.id}`} className="admin-btn admin-btn--ghost" style={{ padding: "0.3rem 0.75rem", fontSize: "0.77rem" }}>Edit</Link>
                  <form style={{ display: "inline" }}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <ConfirmSubmitButton
                      className="admin-btn admin-btn--danger"
                      confirmLabel="Delete project"
                      description={`This permanently removes ${project.title} from the project showcase.`}
                      formAction={deleteProject}
                      style={{ padding: "0.3rem 0.75rem", fontSize: "0.77rem" }}
                      title="Delete project?"
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Project Create/Edit Form */}
      <section>
        <p className="admin-section-label">{selectedProject ? `Editing: ${selectedProject.title}` : "Create new project"}</p>
        <div className="admin-review-card">
          <form action={selectedProject ? updateProject : createProject} className="grid gap-4">
            {selectedProject && <input type="hidden" name="projectId" value={selectedProject.id} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="input-label sm:col-span-2">
                Title
                <input defaultValue={selectedProject?.title || ""} name="title" placeholder="Project name" required />
              </label>
              <label className="input-label">
                Slug
                <input defaultValue={selectedProject?.slug || ""} name="slug" placeholder="generated-if-empty" />
              </label>
              <label className="input-label">
                Tech stack (comma-separated)
                <input defaultValue={selectedProject?.techStack?.join(", ") || ""} name="techStack" placeholder="Next.js, Supabase, ..." />
              </label>
              <label className="input-label sm:col-span-2">
                Summary
                <textarea defaultValue={selectedProject?.description || ""} name="description" placeholder="Project description" rows={4} />
              </label>
              <label className="input-label">
                Live URL
                <input defaultValue={selectedProject?.demoUrl || ""} name="demoUrl" placeholder="https://..." />
              </label>
              <label className="input-label">
                Repo URL
                <input defaultValue={selectedProject?.githubUrl || ""} name="githubUrl" placeholder="https://github.com/..." />
              </label>
              <label className="input-label">
                Status
                <select defaultValue={selectedProject?.status || "draft"} name="status">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="input-label">
                Sort order
                <input defaultValue={100} name="sortOrder" type="number" />
              </label>
              <label className="input-label">
                Cover image (media asset)
                <select defaultValue="" name="mediaAssetId">
                  <option value="">No media</option>
                  {media.map((a) => (
                    <option key={a.id} value={a.id}>{a.title || a.public_id}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="admin-btn admin-btn--primary" type="submit">
                {selectedProject ? "Update project" : "Save project"}
              </button>
              {selectedProject && (
                <Link href="/admin/content/projects" className="admin-btn admin-btn--ghost">Clear editor</Link>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* Developer Profiles */}
      <section>
        <p className="admin-section-label">Developer profiles ({devProfiles.length})</p>
        {devProfiles.length === 0 ? (
          <EmptyState title="No developer profiles" description="Add developer profiles using the form below." />
        ) : (
          <div className="admin-card-list">
            {devProfiles.map((dev) => (
              <div key={dev.id} className="admin-card-row">
                <div className="admin-hub-tile__icon" style={{ flexShrink: 0 }}>
                  <User size={16} />
                </div>
                <div className="admin-card-row__body">
                  <p className="admin-card-row__title">{dev.name} {dev.is_lead && <span className="abadge abadge--active" style={{ marginLeft: "0.4rem", fontSize: "0.6rem" }}>Lead</span>}</p>
                  <p className="admin-card-row__meta">{dev.role || "No role"} · {dev.focus || "No focus"}</p>
                </div>
                <div className="admin-card-row__actions">
                  <span className={`abadge abadge--${dev.status === "active" ? "approved" : "draft"}`}>{dev.status}</span>
                  <Link href={`/admin/content/projects?editDeveloper=${dev.id}`} className="admin-btn admin-btn--ghost" style={{ padding: "0.3rem 0.75rem", fontSize: "0.77rem" }}>Edit</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Developer Profile Form */}
      <section>
        <p className="admin-section-label">{selectedDev ? `Editing developer: ${selectedDev.name}` : "Add / update developer profile"}</p>
        <div className="admin-review-card">
          <form action={saveDeveloperProfile} className="grid gap-4">
            <input type="hidden" name="developerId" value={selectedDev?.id || ""} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="input-label sm:col-span-2">
                Name
                <input defaultValue={selectedDev?.name || ""} name="name" placeholder="Full name" required />
              </label>
              <label className="input-label">
                Role title
                <input defaultValue={selectedDev?.role || ""} name="role" placeholder="Software Engineer" />
              </label>
              <label className="input-label">
                Focus area
                <input defaultValue={selectedDev?.focus || ""} name="focus" placeholder="Frontend, Backend..." />
              </label>
              <label className="input-label sm:col-span-2">
                Bio
                <textarea defaultValue={selectedDev?.bio || ""} name="bio" placeholder="Short bio" rows={3} />
              </label>
              <label className="input-label">
                Status
                <select defaultValue={selectedDev?.status || "active"} name="status">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="input-label">
                Sort order
                <input defaultValue={selectedDev?.sort_order || 100} name="sortOrder" type="number" />
              </label>
              <label className="input-label">
                Is lead?
                <select defaultValue={selectedDev?.is_lead ? "true" : "false"} name="isLead">
                  <option value="false">No</option>
                  <option value="true">Yes — Lead developer</option>
                </select>
              </label>
              <label className="input-label">
                Media asset
                <select defaultValue={selectedDev?.media_asset_id || ""} name="mediaAssetId">
                  <option value="">No photo</option>
                  {media.map((a) => (
                    <option key={a.id} value={a.id}>{a.title || a.public_id}</option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <button className="admin-btn admin-btn--primary" type="submit">
                {selectedDev ? "Update developer profile" : "Save developer profile"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
