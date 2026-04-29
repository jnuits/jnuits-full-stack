import { PortalOverviewScreen } from "@/components/portal/portal-overview-screen";

export const metadata = { title: "Portal - Member Workspace | JnUITS" };

export default async function PortalOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : null;
  const error = typeof params.error === "string" ? params.error : null;
  const access = typeof params.access === "string" ? params.access : null;

  return PortalOverviewScreen({ access, error, message });
}
