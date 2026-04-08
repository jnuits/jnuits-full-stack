import { PortalShell } from "@/components/portal/portal-shell";

export default function ChangePasswordPage() {
  return (
    <PortalShell
      title="Change password"
      summary="Password changes will be handled through Supabase Auth while keeping the portal route stable for users."
    >
      <form className="grid gap-4">
        <input type="password" placeholder="Current password" />
        <input type="password" placeholder="New password" />
        <input type="password" placeholder="Confirm new password" />
        <button type="button" className="primary-button w-full sm:w-fit">
          Update password
        </button>
      </form>
    </PortalShell>
  );
}
