import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  ADMIN_FLASH_COOKIE_NAME,
  parseAdminFlash,
} from "@/lib/admin/flash";
import { getNoticeEditorData } from "@/lib/content/notices";
import { NoticeEditorForm } from "../notice-editor-form";

export const metadata = { title: "Notice Editor — Admin | JnUITS" };

export default async function NoticeEditorPage({
  params,
}: {
  params: Promise<{ noticeId: string }>;
}) {
  const { noticeId } = await params;
  const [{ notice }, cookieStore] = await Promise.all([
    getNoticeEditorData(noticeId),
    cookies(),
  ]);
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);

  if (!notice) {
    notFound();
  }

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
      <NoticeEditorForm initialSaved={flash?.tone === "success"} notice={notice} />
    </div>
  );
}
