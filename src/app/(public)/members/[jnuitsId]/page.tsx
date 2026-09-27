import Link from "next/link";
import { notFound } from "next/navigation";

import { MemberProfileCard } from "@/components/members/member-profile-card";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
import { getPublicMemberProfileByJnuitsId } from "@/lib/members/public-profile";

function getBackHref(from: string | string[] | undefined) {
  const value = Array.isArray(from) ? from[0] : from;

  if (typeof value === "string" && value.startsWith("/members")) {
    return value;
  }

  return "/members";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ jnuitsId: string }>;
}) {
  const { jnuitsId } = await params;
  const displayId = formatMembershipIdForDisplay(decodeURIComponent(jnuitsId));

  return {
    title: `${displayId} | Members Directory | JnUITS`,
  };
}

export default async function MemberProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ jnuitsId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ jnuitsId }, sp] = await Promise.all([params, searchParams]);
  const member = await getPublicMemberProfileByJnuitsId(jnuitsId);

  if (!member) {
    notFound();
  }

  return (
    <main className="profile-page">
      <Link className="back-link" href={getBackHref(sp.from)}>
        ← Back to directory
      </Link>

      <MemberProfileCard member={member} />
    </main>
  );
}
