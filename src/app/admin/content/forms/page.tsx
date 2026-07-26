import { FormInventoryProvider } from "@/components/admin/form-inventory-context";
import { FormLifecyclePanel } from "@/components/admin/form-lifecycle-panel";
import { ModernFormStudioScreen } from "@/components/admin/modern-form-studio-screen";
import { FormSubmissionReviewPanel } from "@/components/admin/form-submission-review-panel";

export const metadata = { title: "Form Studio — Admin | JnUITS" };

export default function FormStudioPage() {
  return (
    <FormInventoryProvider>
      <ModernFormStudioScreen />
      <FormLifecyclePanel />
      <FormSubmissionReviewPanel />
    </FormInventoryProvider>
  );
}
