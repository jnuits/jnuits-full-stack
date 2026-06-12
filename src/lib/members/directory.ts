import { cookies } from "next/headers";
import type { Tables } from "@/lib/db/types";
import { isDirectoryVerifiedForUser } from "@/lib/auth/directory-verification";
import {
  getActiveDepartmentOptions,
  type DepartmentOption,
} from "@/lib/departments.server";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { createClient } from "@/lib/supabase/server";

export const MEMBER_DIRECTORY_PAGE_SIZE = 12;
const MEMBER_DIRECTORY_MAX_PAGE_SIZE = 36;
const LETTER_PATTERN = /^[A-Z]$/;
const DIRECTORY_OPERATOR_ROLES = new Set([
  "super_admin",
  "admin",
  "content_admin",
]);

export type MemberDirectoryTypeFilter = "all" | "current" | "alumni";

export type MemberDirectorySortKey = "name" | "batch" | "joined";

export type MemberDirectoryQueryInput = {
  type?: string | string[] | undefined;
  search?: string | string[] | undefined;
  letter?: string | string[] | undefined;
  department?: string | string[] | undefined;
  sort?: string | string[] | undefined;
  page?: string | string[] | undefined;
  perPage?: string | string[] | undefined;
  pageSize?: string | string[] | undefined;
};

type MemberDirectoryRow = Pick<
  Tables<"members">,
  | "id"
  | "jnuits_id"
  | "full_name"
  | "member_type"
  | "batch_no"
  | "department_code"
  | "facebook_url"
  | "linkedin_url"
  | "website_url"
  | "current_organization"
  | "designation"
  | "work_location"
  | "professional_visibility"
> & {
  avatar_secure_url?: string | null;
  departments?: { name?: string | null } | { name?: string | null }[] | null;
};

type ViewerContext = {
  userId: string | null;
  signedIn: boolean;
  directoryVerified: boolean;
  isOperator: boolean;
};

type NormalizedDirectoryQuery = {
  type: MemberDirectoryTypeFilter;
  search: string;
  letter: string;
  department: string;
  sort: MemberDirectorySortKey;
  page: number;
  pageSize: number;
};

export type MemberDirectoryEntry = {
  id: string;
  jnuitsId: string;
  fullName: string;
  memberType: "current" | "alumni";
  batchNo: number | null;
  departmentCode: string | null;
  departmentName: string | null;
  avatarSecureUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  workplace: {
    visibility: "public" | "members-only" | "private";
    visible: boolean;
    currentOrganization: string | null;
    designation: string | null;
    workLocation: string | null;
  };
};

export type MemberDirectoryResult = {
  filters: {
    type: MemberDirectoryTypeFilter;
    search: string;
    letter: string;
    department: string;
    sort: MemberDirectorySortKey;
  };
  counters: {
    total: number;
    current: number;
    alumni: number;
  };
  facets: {
    departments: Array<DepartmentOption & { count: number }>;
    types: {
      all: number;
      current: number;
      alumni: number;
    };
  };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
  };
  viewer: {
    signedIn: boolean;
    directoryVerified: boolean;
    canViewMembersOnly: boolean;
    isOperator: boolean;
  };
  departments: DepartmentOption[];
  members: MemberDirectoryEntry[];
};

const MEMBER_DIRECTORY_SELECT_CLAUSE =
  "id, jnuits_id, full_name, member_type, batch_no, department_code, avatar_secure_url, facebook_url, linkedin_url, website_url, current_organization, designation, work_location, professional_visibility, departments(name)";

function firstString(value: string | string[] | undefined) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return "";
}

function normalizePageValue(value: string, fallback: number, max: number) {
  const numeric = Number.parseInt(value, 10);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(1, numeric));
}

const VALID_SORT_KEYS = new Set<MemberDirectorySortKey>(["name", "batch", "joined"]);
const DEPT_CODE_PATTERN = /^[A-Z0-9_-]{1,80}$/i;

function normalizeDirectoryQuery(
  input: MemberDirectoryQueryInput
): NormalizedDirectoryQuery {
  const typeRaw = firstString(input.type).trim().toLowerCase();
  const searchRaw = firstString(input.search).trim();
  const letterRaw = firstString(input.letter).trim().toUpperCase();
  const deptRaw = firstString(input.department).trim().toLowerCase();
  const sortRaw = firstString(input.sort).trim().toLowerCase() as MemberDirectorySortKey;
  const type: MemberDirectoryTypeFilter =
    typeRaw === "current" || typeRaw === "alumni" ? typeRaw : "all";

  const sanitizedSearch = searchRaw
    .replaceAll(",", " ")
    .replaceAll("%", " ")
    .replaceAll("*", " ")
    .replaceAll("  ", " ")
    .trim()
    .slice(0, 80);

  return {
    type,
    search: sanitizedSearch,
    letter: LETTER_PATTERN.test(letterRaw) ? letterRaw : "",
    department: DEPT_CODE_PATTERN.test(deptRaw) ? deptRaw : "",
    sort: VALID_SORT_KEYS.has(sortRaw) ? sortRaw : "name",
    page: normalizePageValue(firstString(input.page), 1, 500),
    pageSize: normalizePageValue(
      firstString(input.perPage) || firstString(input.pageSize),
      MEMBER_DIRECTORY_PAGE_SIZE,
      Math.max(MEMBER_DIRECTORY_MAX_PAGE_SIZE, 48)
    ),
  };
}

function resolveDepartmentName(member: MemberDirectoryRow) {
  if (!member.departments) {
    return null;
  }

  if (Array.isArray(member.departments)) {
    return member.departments[0]?.name || null;
  }

  return member.departments.name || null;
}

function extractRoleCodes(rows: Array<{ rbac_platform_roles?: unknown }>) {
  return rows
    .map((row) => {
      const record = row.rbac_platform_roles;

      if (!record) {
        return null;
      }

      if (Array.isArray(record)) {
        const firstRole = record[0];

        if (
          firstRole &&
          typeof firstRole === "object" &&
          "code" in firstRole &&
          typeof (firstRole as { code?: unknown }).code === "string"
        ) {
          return (firstRole as { code: string }).code;
        }

        return null;
      }

      if (
        typeof record === "object" &&
        "code" in record &&
        typeof (record as { code?: unknown }).code === "string"
      ) {
        return (record as { code: string }).code;
      }

      return null;
    })
    .filter((value): value is string => Boolean(value));
}

async function resolveViewerContext(): Promise<ViewerContext> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (!userId) {
    return {
      userId: null,
      signedIn: false,
      directoryVerified: false,
      isOperator: false,
    };
  }

  const cookieStore = await cookies();
  const directoryVerified = isDirectoryVerifiedForUser(cookieStore, userId);
  const admin = createAdminClient();

  const roleRowsResult = await admin
    .from("rbac_user_platform_roles")
    .select("rbac_platform_roles(code)")
    .eq("user_id", userId)
    .is("revoked_at", null);

  const roleRows = (roleRowsResult.data || []) as Array<{
    rbac_platform_roles?: unknown;
  }>;
  const roles = extractRoleCodes(roleRows);
  const isOperator = roles.some((role) => DIRECTORY_OPERATOR_ROLES.has(role));

  return {
    userId,
    signedIn: true,
    directoryVerified,
    isOperator,
  };
}

function isWorkplaceVisible(member: MemberDirectoryRow, viewer: ViewerContext) {
  const visibility = member.professional_visibility;

  if (visibility === "public") {
    return true;
  }

  if (visibility === "members-only") {
    return viewer.directoryVerified || viewer.isOperator;
  }

  if (visibility === "private") {
    return false;
  }

  return false;
}

function canViewMembersOnlyProfile(viewer: ViewerContext) {
  return viewer.directoryVerified || viewer.isOperator;
}

function getVisibility(value: string): "public" | "members-only" | "private" {
  if (value === "public" || value === "members-only" || value === "private") {
    return value;
  }

  return "members-only";
}

function mapDirectoryMember(member: MemberDirectoryRow, viewer: ViewerContext) {
  const workplaceVisible = isWorkplaceVisible(member, viewer);

  return {
    id: member.id,
    jnuitsId: formatMembershipIdForDisplay(member.jnuits_id),
    fullName: member.full_name,
    memberType: member.member_type === "alumni" ? "alumni" : "current",
    batchNo: member.batch_no,
    departmentCode: member.department_code,
    departmentName: resolveDepartmentName(member),
    avatarSecureUrl: member.avatar_secure_url ?? null,
    facebookUrl: member.facebook_url ?? null,
    linkedinUrl: member.linkedin_url,
    websiteUrl: member.website_url,
    workplace: {
      visibility: getVisibility(member.professional_visibility),
      visible: workplaceVisible,
      currentOrganization: workplaceVisible ? member.current_organization : null,
      designation: workplaceVisible ? member.designation : null,
      workLocation: workplaceVisible ? member.work_location : null,
    },
  } satisfies MemberDirectoryEntry;
}

export async function getPublicMemberDirectory(
  input: MemberDirectoryQueryInput
): Promise<MemberDirectoryResult> {
  const query = normalizeDirectoryQuery(input);
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const viewer = await resolveViewerContext();

  const applyPublicMemberFilters = (
    request: ReturnType<typeof flexibleAdmin.from>
  ) => {
    let result = request
      .in("lifecycle_status", ["current", "alumni"])
      .eq("portal_access_status", "active")
      .not("jnuits_id", "ilike", "JNUITS-ADMIN-%");

    if (canViewMembersOnlyProfile(viewer)) {
      result = result.or(
        "professional_visibility.eq.public,professional_visibility.eq.members-only,professional_visibility.is.null"
      );
    } else {
      result = result.eq("professional_visibility", "public");
    }

    return result;
  };

  const buildMembersQuery = () => {
    const request = flexibleAdmin.from("members" as string).select(MEMBER_DIRECTORY_SELECT_CLAUSE, {
      count: "exact",
    });

    let result = applyPublicMemberFilters(request);

    if (query.type !== "all") {
      result = result.eq("member_type", query.type);
    }

    if (query.department) {
      result = result.eq("department_code", query.department);
    }

    if (query.letter) {
      result = result.ilike("full_name", `${query.letter}%`);
    }

    if (query.search) {
      const pattern = `%${query.search}%`;
      result = result.or(`full_name.ilike.${pattern},jnuits_id.ilike.${pattern}`);
    }

    return result;
  };

  const applySearchAndLetterFilters = (
    request: ReturnType<typeof flexibleAdmin.from>
  ) => {
    let result = applyPublicMemberFilters(request);

    if (query.letter) {
      result = result.ilike("full_name", `${query.letter}%`);
    }

    if (query.search) {
      const pattern = `%${query.search}%`;
      result = result.or(`full_name.ilike.${pattern},jnuits_id.ilike.${pattern}`);
    }

    return result;
  };

  const fetchPage = async (page: number) => {
    const from = (page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;

    const orderCol =
      query.sort === "batch" ? "batch_no"
      : query.sort === "joined" ? "created_at"
      : "full_name";
    const ascending = query.sort !== "joined";

    return buildMembersQuery()
      .order(orderCol, { ascending })
      .order("full_name", { ascending: true }) // secondary stable sort
      .range(from, to);
  };

  let currentPage = query.page;
  let membersResult = await fetchPage(currentPage);

  if (membersResult.error) {
    throw new Error("Unable to load members directory.");
  }

  const filteredCount = membersResult.count || 0;
  const totalPages = Math.max(1, Math.ceil(filteredCount / query.pageSize));

  if (currentPage > totalPages) {
    currentPage = totalPages;
    membersResult = await fetchPage(currentPage);

    if (membersResult.error) {
      throw new Error("Unable to load members directory.");
    }
  }

  const [
    totalMembersResult,
    currentMembersResult,
    alumniMembersResult,
    departments,
    departmentFacetResult,
    typeFacetResult,
  ] =
    await Promise.all([
      applyPublicMemberFilters(
        flexibleAdmin.from("members" as string).select("id", { head: true, count: "exact" })
      ),
      applyPublicMemberFilters(
        flexibleAdmin
          .from("members" as string)
          .select("id", { head: true, count: "exact" })
          .eq("member_type", "current")
      ),
      applyPublicMemberFilters(
        flexibleAdmin
          .from("members" as string)
          .select("id", { head: true, count: "exact" })
          .eq("member_type", "alumni")
      ),
      getActiveDepartmentOptions(),
      (() => {
        let result = applyPublicMemberFilters(
          flexibleAdmin
            .from("members" as string)
            .select("id, member_type, department_code")
        );

        if (query.type !== "all") {
          result = result.eq("member_type", query.type);
        }

        return result;
      })(),
      (() => {
        let result = applySearchAndLetterFilters(
          flexibleAdmin
            .from("members" as string)
            .select("id, member_type, department_code")
        );

        if (query.department) {
          result = result.eq("department_code", query.department);
        }

        return result;
      })(),
    ]);

  const members = ((membersResult.data || []) as MemberDirectoryRow[]).map((member) =>
    mapDirectoryMember(member, viewer)
  );

  if (departmentFacetResult.error || typeFacetResult.error) {
    throw new Error("Unable to load members directory facets.");
  }

  const departmentFacetRows = (departmentFacetResult.data || []) as Array<{
    department_code?: string | null;
  }>;
  const typeFacetRows = (typeFacetResult.data || []) as Array<{
    member_type?: string | null;
  }>;
  const departmentCounts = new Map<string, number>();
  const typeCounts = {
    all: typeFacetRows.length,
    alumni: 0,
    current: 0,
  };

  for (const row of departmentFacetRows) {
    if (row.department_code) {
      departmentCounts.set(
        row.department_code,
        (departmentCounts.get(row.department_code) || 0) + 1
      );
    }
  }

  for (const row of typeFacetRows) {
    if (row.member_type === "alumni") {
      typeCounts.alumni += 1;
    } else {
      typeCounts.current += 1;
    }
  }

  return {
    filters: {
      type: query.type,
      search: query.search,
      letter: query.letter,
      department: query.department,
      sort: query.sort,
    },
    counters: {
      total: totalMembersResult.count || 0,
      current: currentMembersResult.count || 0,
      alumni: alumniMembersResult.count || 0,
    },
    facets: {
      departments: departments.map((department) => ({
        ...department,
        count: departmentCounts.get(department.code) || 0,
      })),
      types: typeCounts,
    },
    pagination: {
      page: currentPage,
      pageSize: query.pageSize,
      totalItems: filteredCount,
      totalPages,
      hasPrevious: currentPage > 1,
      hasNext: currentPage < totalPages,
    },
    viewer: {
      signedIn: viewer.signedIn,
      directoryVerified: viewer.directoryVerified,
      canViewMembersOnly: canViewMembersOnlyProfile(viewer),
      isOperator: viewer.isOperator,
    },
    departments,
    members,
  };
}

export async function getPublicMemberByJnuitsId(
  jnuitsId: string
): Promise<MemberDirectoryEntry | null> {
  const displayId = formatMembershipIdForDisplay(decodeURIComponent(jnuitsId));

  if (!displayId) {
    return null;
  }

  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const viewer = await resolveViewerContext();
  let request = flexibleAdmin
    .from("members" as string)
    .select(MEMBER_DIRECTORY_SELECT_CLAUSE)
    .in("lifecycle_status", ["current", "alumni"])
    .eq("portal_access_status", "active")
    .not("jnuits_id", "ilike", "JNUITS-ADMIN-%");

  if (canViewMembersOnlyProfile(viewer)) {
    request = request.or(
      "professional_visibility.eq.public,professional_visibility.eq.members-only,professional_visibility.is.null"
    );
  } else {
    request = request.eq("professional_visibility", "public");
  }

  const { data, error } = await request
    .ilike("jnuits_id", displayId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapDirectoryMember(data as MemberDirectoryRow, viewer);
}
