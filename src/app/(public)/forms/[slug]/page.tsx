import { notFound } from "next/navigation";

import { PublicFormScreen } from "@/components/forms/public-form-screen";
import { loadPublishedForm } from "@/lib/forms/repository";
import { getAuthCaptchaUiConfig } from "@/lib/security/captcha";

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let form;

  try {
    form = await loadPublishedForm(slug);
  } catch {
    notFound();
  }

  if (!form) {
    notFound();
  }

  return (
    <div className="shell py-12">
      <PublicFormScreen
        captcha={getAuthCaptchaUiConfig()}
        kind={form.kind}
        linkedEventId={form.linkedEventId}
        form={{
          definition: form.definition,
          description: form.description,
          emailFieldId: form.applicationBehavior.fieldMapping.email,
          slug: form.slug,
          title: form.title,
        }}
      />
    </div>
  );
}
