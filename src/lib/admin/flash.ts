export const ADMIN_FLASH_COOKIE_NAME = "jnuits-admin-flash";

export type AdminFlash = {
  tone: "success" | "error";
  title: string;
  message: string;
  invitationCode?: string;
  jnuitsId?: string;
};

export function parseAdminFlash(value: string | undefined): AdminFlash | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<AdminFlash>;

    if (
      (parsed.tone === "success" || parsed.tone === "error") &&
      typeof parsed.title === "string" &&
      typeof parsed.message === "string"
    ) {
      return {
        tone: parsed.tone,
        title: parsed.title,
        message: parsed.message,
        invitationCode:
          typeof parsed.invitationCode === "string" ? parsed.invitationCode : undefined,
        jnuitsId: typeof parsed.jnuitsId === "string" ? parsed.jnuitsId : undefined,
      };
    }
  } catch {}

  return null;
}
