import { FormConfirmationScreen } from "@/components/forms/form-confirmation-screen";
import { getAuthCaptchaUiConfig } from "@/lib/security/captcha";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default async function FormConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const submissionId = typeof resolved.submission === "string" ? resolved.submission : "";
  const token = typeof resolved.token === "string" ? resolved.token : "";
  const rawFormSlug = typeof resolved.form === "string" ? resolved.form : "";
  const formSlug = slugPattern.test(rawFormSlug) ? rawFormSlug : null;

  return (
    <div className="shell py-12">
      <FormConfirmationScreen
        captcha={getAuthCaptchaUiConfig()}
        formSlug={formSlug}
        submissionId={submissionId}
        token={token}
        valid={uuidPattern.test(submissionId) && tokenPattern.test(token)}
      />
    </div>
  );
}
