import { cookies } from "next/headers";
import { EventEditorScreen } from "@/components/admin/event-editor-screen";
import {
  ADMIN_FLASH_COOKIE_NAME,
  parseAdminFlash,
} from "@/lib/admin/flash";

export const metadata = { title: "New Event — Admin | JnUITS" };

export default async function NewEventPage() {
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);

  return (
    <div className="grid gap-6">
      {flash ? (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="admin-section-label">Operator feedback</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">
            {flash.title}
          </h2>
          <p className="mt-1 text-sm leading-7">{flash.message}</p>
        </section>
      ) : null}
      <EventEditorScreen event={null} />
    </div>
  );
}
