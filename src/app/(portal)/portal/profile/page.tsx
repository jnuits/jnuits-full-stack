import { ProfileScreen } from "@/components/portal/profile-screen";

export const metadata = { title: "My Profile | JnUITS Member Portal" };

export default async function PortalProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <ProfileScreen
      error={typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : null}
      message={typeof resolvedSearchParams.message === "string" ? resolvedSearchParams.message : null}
    />
  );
}
