import { TicketsScreen } from "@/components/portal/tickets-screen";

export const metadata = { title: "Tickets | JnUITS Member Portal" };

export default async function PortalTicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;

  return (
    <TicketsScreen
      error={typeof resolved.error === "string" ? resolved.error : null}
      message={typeof resolved.message === "string" ? resolved.message : null}
    />
  );
}
