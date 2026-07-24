import { FormLifecyclePanel } from "@/components/admin/form-lifecycle-panel";
import { ModernFormStudioScreen } from "@/components/admin/modern-form-studio-screen";
import { FormSubmissionReviewPanel } from "@/components/admin/form-submission-review-panel";

export const metadata = { title: "Form Studio — Admin | JnUITS" };

export default function FormStudioPage() {
  return (
    <>
      <ModernFormStudioScreen />
      <FormLifecyclePanel />
      <FormSubmissionReviewPanel />
    </>
  );
}
