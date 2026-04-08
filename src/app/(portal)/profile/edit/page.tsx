import { PortalShell } from "@/components/portal/portal-shell";

export default function EditProfilePage() {
  return (
    <PortalShell
      title="Edit profile"
      summary="Sensitive edits will require step-up verification before mutation. This route is reserved for that flow."
    >
      <form className="grid gap-4">
        <input placeholder="Full name" />
        <input placeholder="Phone number" />
        <input placeholder="Current organization" />
        <input placeholder="LinkedIn URL" />
        <input type="password" placeholder="Current password for step-up verification" />
        <button type="button" className="primary-button w-full sm:w-fit">
          Save changes
        </button>
      </form>
    </PortalShell>
  );
}
