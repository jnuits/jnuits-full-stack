import { FormLifecyclePanel } from "@/components/admin/form-lifecycle-panel";
import { FormStudioScreen } from "@/components/admin/form-studio-screen";

export const metadata = { title: "Form Studio — Admin | JnUITS" };

export default function FormStudioPage() {
  return (
    <>
      <FormStudioScreen />
      <FormLifecyclePanel />
    </>
  );
}
