import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

export type ActiveDepartmentCatalogEntry = {
  name: string;
  shortCode: string;
};

type DepartmentCatalogRow = {
  name: string;
  short_code: string;
  sort_order: number;
};

export async function getActiveDepartmentCatalog(): Promise<
  ActiveDepartmentCatalogEntry[]
> {
  const client = asFlexibleClient(createAdminClient());
  const { data, error } = await client
    .from("departments")
    .select("name, short_code, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Unable to load the active department catalog.");
  }

  return ((data ?? []) as DepartmentCatalogRow[])
    .slice()
    .sort(
      (left, right) =>
        left.sort_order - right.sort_order ||
        left.name.localeCompare(right.name, "en-US", { sensitivity: "base" })
    )
    .map((department) => ({
      name: department.name,
      shortCode: department.short_code,
    }));
}
