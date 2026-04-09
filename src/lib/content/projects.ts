import { createAdminClient } from "@/lib/supabase/admin";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectContributor {
  memberId: string;
  jnuitsId: string | null;
  fullName: string;
  role: string;
  batchNo: number | null;
  departmentName: string | null;
  joinedAt: string | null;
}

export interface ProjectSummary {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string;
  techStack: string[];
  category: string;
  status: string;
  coverImageUrl: string | null;
  githubUrl: string | null;
  demoUrl: string | null;
  isFeatured: boolean;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  contributorCount: number;
}

export interface ProjectDetail extends ProjectSummary {
  contributors: ProjectContributor[];
}

// ── Normalise DB row → ProjectSummary ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseProject(row: any, contributorCount = 0): ProjectSummary {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    tagline: (row.tagline as string | null) ?? null,
    description: (row.description as string) || "",
    techStack: Array.isArray(row.tech_stack) ? (row.tech_stack as string[]) : [],
    category: (row.category as string) || "other",
    status: (row.status as string) || "active",
    coverImageUrl: (row.cover_image_url as string | null) ?? null,
    githubUrl: (row.github_url as string | null) ?? null,
    demoUrl: (row.demo_url as string | null) ?? null,
    isFeatured: Boolean(row.is_featured),
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    createdAt: row.created_at as string,
    contributorCount,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseContributor(row: any): ProjectContributor {
  const member = Array.isArray(row.members) ? row.members[0] : row.members;
  return {
    memberId: row.member_id as string,
    jnuitsId: (member?.jnuits_id as string | null) ?? null,
    fullName: (member?.full_name as string | null) ?? "Unknown member",
    role: (row.role as string) || "contributor",
    batchNo: (member?.batch_no as number | null) ?? null,
    departmentName: (member?.department_name as string | null) ?? null,
    joinedAt: (row.joined_at as string | null) ?? null,
  };
}

// ── Public queries ─────────────────────────────────────────────────────────────

export interface ProjectFilters {
  category?: string | undefined;
  status?: string | undefined;
}

/** Returns non-archived projects, optional category/status filter. */
export async function getPublishedProjects(
  filters?: ProjectFilters
): Promise<ProjectSummary[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  let query = admin
    .from("projects")
    .select("id, slug, title, tagline, description, tech_stack, category, status, cover_image_url, github_url, demo_url, is_featured, started_at, completed_at, created_at, project_contributors(id)")
    .neq("status", "archived")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters?.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((row) => {
    const contributors = Array.isArray(row.project_contributors)
      ? row.project_contributors
      : [];
    return normaliseProject(row, contributors.length);
  });
}

/** Returns a single project with its full contributor list. */
export async function getProjectBySlug(slug: string): Promise<ProjectDetail | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: projectData, error: projectError } = await admin
    .from("projects")
    .select("id, slug, title, tagline, description, tech_stack, category, status, cover_image_url, github_url, demo_url, is_featured, started_at, completed_at, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (projectError || !projectData) return null;

  const { data: contributorData } = await admin
    .from("project_contributors")
    .select("member_id, role, joined_at, members(jnuits_id, full_name, batch_no, department_name)")
    .eq("project_id", projectData.id)
    .order("joined_at", { ascending: true, nullsFirst: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contributors = ((contributorData ?? []) as any[]).map(normaliseContributor);

  return {
    ...normaliseProject(projectData, contributors.length),
    contributors,
  };
}

/** Returns projects a given member contributed to. */
export async function getMemberProjects(memberId: string): Promise<ProjectSummary[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data, error } = await admin
    .from("project_contributors")
    .select("role, projects(id, slug, title, tagline, description, tech_stack, category, status, cover_image_url, github_url, demo_url, is_featured, started_at, completed_at, created_at)")
    .eq("member_id", memberId)
    .neq("projects.status", "archived")
    .order("created_at", { referencedTable: "projects", ascending: false });

  if (error || !data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[])
    .map((row) => {
      const proj = Array.isArray(row.projects) ? row.projects[0] : row.projects;
      return proj ? normaliseProject(proj) : null;
    })
    .filter((p): p is ProjectSummary => p !== null);
}

/** Returns all projects for admin (including archived). */
export async function getAllProjectsForAdmin(): Promise<ProjectSummary[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data, error } = await admin
    .from("projects")
    .select("id, slug, title, tagline, description, tech_stack, category, status, cover_image_url, github_url, demo_url, is_featured, started_at, completed_at, created_at, project_contributors(id)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((row) => {
    const contributors = Array.isArray(row.project_contributors)
      ? row.project_contributors
      : [];
    return normaliseProject(row, contributors.length);
  });
}
