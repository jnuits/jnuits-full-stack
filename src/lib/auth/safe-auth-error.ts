function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "";
}

/**
 * Maps expected authentication failures to safe copy and hides provider details.
 */
export function getSafeAuthErrorMessage(error: unknown, fallback: string) {
  const message = getErrorMessage(error);

  if (/captcha|captcha_token|turnstile|request disallowed/i.test(message)) {
    return "Complete the verification challenge and try again.";
  }

  if (/invalid login credentials|invalid grant/i.test(message)) {
    return "Invalid email or password.";
  }

  if (/email not confirmed|email not verified/i.test(message)) {
    return "Confirm your email address, then try again.";
  }

  if (/rate limit|too many requests|too many attempts/i.test(message)) {
    return "Too many attempts. Try again later.";
  }

  return fallback;
}