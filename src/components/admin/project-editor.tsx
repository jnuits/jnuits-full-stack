"use client";

import Link from "next/link";
import { useState } from "react";
import { createProject, updateProject } from "@/app/admin/content/actions";
import { BlogMediaSelect, type BlogMediaOption } from "@/components/admin/blog-media-select";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { PROJECT_CATEGORIES, PROJECT_STATUSES } from "@/lib/content/project-fields";
import type { ProjectSummary } from "@/lib/content/projects";

export function ProjectEditor({ project, assets, canUpload }: {
  project: ProjectSummary | null;
  assets: BlogMediaOption[];
  canUpload: boolean;
}) {
  const [status, setStatus] = useState(project?.status || "active");
  const currentMediaId = assets.find(asset => asset.secure_url === project?.coverImageUrl)?.id || "";
  const visibilityChanges = project ? (project.status === "archived") !== (status === "archived") : status !== "archived";
  return (
    <form action={project ? updateProject : createProject} className="grid gap-4">
      {project ? <input type="hidden" name="projectId" value={project.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="input-label sm:col-span-2">Title<input defaultValue={project?.title || ""} name="title" required maxLength={180} /></label>
        <label className="input-label">Slug<input defaultValue={project?.slug || ""} name="slug" placeholder="generated-if-empty" readOnly={Boolean(project)} maxLength={180} />{project ? <span className="text-xs text-[var(--muted-foreground)]">The public address stays unchanged when you edit this project.</span> : null}</label>
        <label className="input-label">Tagline<input defaultValue={project?.tagline || ""} name="tagline" maxLength={300} /></label>
        <label className="input-label">Category<select defaultValue={project?.category || "other"} name="category">
          {project && !PROJECT_CATEGORIES.some(value => value === project.category) ? <option value={project.category}>{project.category} (existing)</option> : null}
          {PROJECT_CATEGORIES.map(value => <option key={value} value={value}>{value === "ai" ? "AI" : value.charAt(0).toUpperCase() + value.slice(1)}</option>)}
        </select></label>
        <label className="input-label">Status<select name="status" value={status} onChange={event => setStatus(event.target.value)}>
          {!PROJECT_STATUSES.some(value => value === status) ? <option value={status}>{status} (existing)</option> : null}
          {PROJECT_STATUSES.map(value => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}
        </select></label>
        <label className="input-label sm:col-span-2">Tech stack (comma-separated)<input defaultValue={project?.techStack.join(", ") || ""} name="techStack" maxLength={1000} /></label>
        <label className="input-label sm:col-span-2">Summary<textarea defaultValue={project?.description || ""} name="description" rows={4} maxLength={10000} /></label>
        <label className="input-label">Live URL<input defaultValue={project?.demoUrl || ""} name="demoUrl" type="url" maxLength={1000} /></label>
        <label className="input-label">Repo URL<input defaultValue={project?.githubUrl || ""} name="githubUrl" type="url" maxLength={1000} /></label>
        <label className="input-label">Started on<input defaultValue={project?.startedAt?.slice(0, 10) || ""} name="startedAt" type="date" /></label>
        <label className="input-label">Completed on<input defaultValue={project?.completedAt?.slice(0, 10) || ""} name="completedAt" type="date" /></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input defaultChecked={project?.isFeatured || false} name="isFeatured" type="checkbox" value="true" />Feature this project</label>
      {/* Keep the checkbox first: FormData.get picks true when checked, false otherwise. */}
      <input name="isFeatured" type="hidden" value="false" />
      <p className="text-sm text-[var(--muted-foreground)]">Active and completed projects are publicly visible. Archived projects remain available to admins.</p>
      <BlogMediaSelect assets={assets} defaultValue={currentMediaId} fallbackSecureUrl={project?.coverImageUrl} secureUrlFieldName="coverImageUrl" uploadEnabled={canUpload} context="project" />
      <div className="flex flex-wrap gap-3">
        {visibilityChanges ? <ConfirmSubmitButton className="admin-btn admin-btn--primary" title={status === "archived" ? "Archive this project?" : "Publish this project?"} confirmLabel={status === "archived" ? "Archive project" : "Publish project"} description={status === "archived" ? "This hides the project from the public showcase. Its details and contributors stay available to admins." : "This makes the project and its details visible in the public showcase. You can archive it later."}>{project ? "Update project" : "Save project"}</ConfirmSubmitButton> : <button className="admin-btn admin-btn--primary" type="submit">{project ? "Update project" : "Save project"}</button>}
        {project ? <Link href="/admin/content/projects" className="admin-btn admin-btn--ghost">Clear editor</Link> : null}
      </div>
    </form>
  );
}
