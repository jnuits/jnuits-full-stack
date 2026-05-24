import { getAppBaseUrl } from "@/lib/env";

export function buildClaimProfileUrl(options: {
  email?: null | string;
  invitationCode: string;
  jnuitsId: string;
}) {
  const url = new URL("/register", getAppBaseUrl());

  url.searchParams.set("jnuitsId", options.jnuitsId);
  url.searchParams.set("code", options.invitationCode);

  const email = options.email?.trim().toLowerCase();

  if (email) {
    url.searchParams.set("email", email);
  }

  return url.toString();
}
