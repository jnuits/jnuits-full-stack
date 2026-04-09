import { redirect } from "next/navigation";
import { resolveCommitteeAliasSlug } from "@/lib/committee/public";

export default async function CommitteeFifthAliasPage() {
  const slug = await resolveCommitteeAliasSlug("5th");
  redirect(slug ? `/committee/${slug}` : "/committee");
}
