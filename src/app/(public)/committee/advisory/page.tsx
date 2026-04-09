import { redirect } from "next/navigation";
import { resolveCommitteeAliasSlug } from "@/lib/committee/public";

export default async function CommitteeAdvisoryAliasPage() {
  const slug = await resolveCommitteeAliasSlug("advisory");
  redirect(slug ? `/committee/${slug}` : "/committee");
}
