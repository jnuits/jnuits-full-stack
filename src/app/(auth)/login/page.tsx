import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  resolveLoginPathForRoute,
  resolveSafeNextPath,
} from "@/lib/auth/session";

function asSingleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

export default async function LegacyLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const explicitNext = asSingleParam(resolvedSearchParams.next);
  const referer = requestHeaders.get("referer");
  let inferredNext: null | string = null;

  if (!explicitNext && referer) {
    try {
      const refererUrl = new URL(referer);
      inferredNext = `${refererUrl.pathname}${refererUrl.search}`;
    } catch {
      inferredNext = null;
    }
  }

  const nextPath = resolveSafeNextPath(explicitNext ?? inferredNext, "/portal/dashboard");
  const targetLoginPath = resolveLoginPathForRoute(nextPath);
  const redirectParams = new URLSearchParams();
  const error = asSingleParam(resolvedSearchParams.error);
  const message = asSingleParam(resolvedSearchParams.message);

  if (error) {
    redirectParams.set("error", error);
  }

  if (message) {
    redirectParams.set("message", message);
  }

  if (explicitNext ?? inferredNext) {
    redirectParams.set("next", nextPath);
  }

  redirect(
    redirectParams.size > 0
      ? `${targetLoginPath}?${redirectParams.toString()}`
      : targetLoginPath
  );
}
