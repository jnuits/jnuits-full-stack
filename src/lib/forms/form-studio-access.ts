import type { FormKind } from "@/lib/forms/definition";

export type FormStudioKindScope = "all" | "event_registration" | null;

export function getFormStudioKindScope(
  roles: readonly string[]
): FormStudioKindScope {
  if (roles.includes("super_admin") || roles.includes("admin")) return "all";
  if (roles.includes("content_admin")) return "event_registration";
  return null;
}

export function canAccessFormStudioKind(
  roles: readonly string[],
  kind: FormKind
) {
  const scope = getFormStudioKindScope(roles);
  return scope === "all" || scope === kind;
}

export function formStudioKindFilter(roles: readonly string[]) {
  const scope = getFormStudioKindScope(roles);
  return scope === "event_registration" ? scope : undefined;
}
