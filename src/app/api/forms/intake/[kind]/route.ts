import { NextResponse } from "next/server";

import { loadPublishedFormByKind } from "@/lib/forms/repository";
import { withApiGuard } from "@/lib/security/with-api-guard";

const intakeKinds = {
  alumni: "alumni_onboarding",
  membership: "membership_application",
} as const;

export const GET = withApiGuard(async (_request, context) => {
  const { kind: rawKind } = await context.params;
  const kind = typeof rawKind === "string" ? intakeKinds[rawKind as keyof typeof intakeKinds] : null;

  if (!kind) {
    return NextResponse.json({ error: "Form not found." }, { status: 404 });
  }

  const form = await loadPublishedFormByKind(kind);
  if (!form) {
    return NextResponse.json({ error: "Form not found." }, { status: 404 });
  }

  return NextResponse.json({ href: `/forms/${form.slug}`, title: form.title });
});
