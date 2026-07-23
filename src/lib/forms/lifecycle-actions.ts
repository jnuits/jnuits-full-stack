export type ManagedFormLifecycle = "archived" | "closed" | "draft" | "published";
export type FormLifecycleAction = "archived" | "closed" | "published";

export function availableFormLifecycleActions(
  lifecycle: ManagedFormLifecycle,
  hasPublishedVersion: boolean
): FormLifecycleAction[] {
  if (lifecycle === "archived") return [];
  if (lifecycle === "published") return ["closed", "archived"];
  if (lifecycle === "closed") {
    return hasPublishedVersion ? ["published", "archived"] : ["archived"];
  }
  return ["archived"];
}

export function formLifecycleActionLabel(action: FormLifecycleAction) {
  if (action === "closed") return "Close intake";
  if (action === "published") return "Reopen intake";
  return "Archive form";
}
