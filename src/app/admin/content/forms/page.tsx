import { requireAdminPagePermission as requireAdminPermission } from "@/lib/admin/activity/page-access";
import { FormInventoryProvider } from "@/components/admin/form-inventory-context";
import { FormLifecyclePanel } from "@/components/admin/form-lifecycle-panel";
import { ModernFormStudioScreen } from "@/components/admin/modern-form-studio-screen";
import { FormSubmissionReviewPanel } from "@/components/admin/form-submission-review-panel";
import { getAppBaseUrl } from "@/lib/env";

export const metadata = { title: "Form Studio — Admin | JnUITS" };

export default async function FormStudioPage() {
  await requireAdminPermission("cms.forms.manage", { fallbackPath: "/admin/dashboard" });
  // Resolved here, in a server component, because APP_BASE_URL is not inlined
  // into client bundles. A client component calling getAppBaseUrl() would fall
  // through to a weaker source and produce a link for the wrong host.
  return (
    <FormInventoryProvider publicBaseUrl={getAppBaseUrl()}>
      <ModernFormStudioScreen />
      <FormLifecyclePanel />
      <FormSubmissionReviewPanel />
    </FormInventoryProvider>
  );
}
