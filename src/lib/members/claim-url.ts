import { getPublicAppBaseUrl } from "@/lib/env";

export function buildClaimProfileUrl(options: {
  email?: null | string;
  invitationCode: string;
  jnuitsId: string;
}) {
  void options;
  return new URL("/register", getPublicAppBaseUrl()).toString();
}
