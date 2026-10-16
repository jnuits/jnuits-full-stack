import { requireAdminPagePermission as requireAdminPermission } from "@/lib/admin/activity/page-access";
import { notFound } from "next/navigation";
import { EventOperationsScreen } from "@/components/admin/event-operations-screen";
import { getAdminEventById } from "@/lib/content/events";

export const metadata = { title: "Event Operations — Admin | JnUITS" };

export default async function EventOperationsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  await requireAdminPermission("cms.events.manage", { fallbackPath: "/admin/dashboard" });
  const { eventId } = await params;
  const event = await getAdminEventById(eventId);

  if (!event) {
    notFound();
  }

  return <EventOperationsScreen eventId={event.id} eventTitle={event.title} />;
}
