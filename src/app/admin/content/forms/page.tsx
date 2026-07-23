import { FormFieldOrderPanel } from "@/components/admin/form-field-order-panel";
import { FormLifecyclePanel } from "@/components/admin/form-lifecycle-panel";
import { FormStudioScreen } from "@/components/admin/form-studio-screen";
import { FormSubmissionReviewPanel } from "@/components/admin/form-submission-review-panel";

export const metadata = { title: "Form Studio — Admin | JnUITS" };

export default function FormStudioPage() {
  return (
    <>
      <FormStudioScreen />
      <FormFieldOrderPanel />
      <FormLifecyclePanel />
      <FormSubmissionReviewPanel />
    </>
  );
}
