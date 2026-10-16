import { Phone } from "lucide-react";
import { ContactSettingsEditor } from "./contact-settings-editor";
import { getContactSettingRows } from "@/lib/contact-settings";
import { requireAdminPagePermission } from "@/lib/admin/activity/page-access";

export const metadata = { title: "Contact Page Settings | JnUITS" };

export default async function AdminContactSettingsPage() {
  await requireAdminPagePermission("admin.settings.read", {fallbackPath:"/admin"});
  const rows = await getContactSettingRows({ includePrivate: true });

  return (
    <section className="grid gap-6">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin settings</p>
          <h1 className="admin-page-header__title">Contact Page Settings</h1>
          <p className="admin-page-header__desc">
            Update contact information displayed on the public /contact page
            without editing code.
          </p>
        </div>
        <span className="status-pill w-fit">
          <Phone aria-hidden="true" size={13} />
          Public contact
        </span>
      </div>

      <ContactSettingsEditor rows={rows} />
    </section>
  );
}
