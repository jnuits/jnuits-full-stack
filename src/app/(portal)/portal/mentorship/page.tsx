import { MentorshipScreen } from "@/components/portal/mentorship-screen";

export const metadata = { title: "Mentorship | JnUITS Member Portal" };

export default async function PortalMentorshipPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;

  return (
    <MentorshipScreen
      error={typeof resolved.error === "string" ? resolved.error : null}
      message={typeof resolved.message === "string" ? resolved.message : null}
    />
  );
}
