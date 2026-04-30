import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type DepartmentOption = {
  code: string;
  name: string;
};

export async function getActiveDepartmentOptions(): Promise<DepartmentOption[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("departments")
    .select("code, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Unable to load departments.");
  }

  return ((data || []) as DepartmentOption[]).map((department) => ({
    code: department.code,
    name: department.name,
  }));
}

export async function isActiveDepartmentCode(code: string) {
  const normalized = code.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("departments")
    .select("code")
    .eq("code", normalized)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to validate department.");
  }

  return Boolean(data?.code);
}
