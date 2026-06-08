import { getSafeErrorMessage, logServerError } from "@/lib/errors/api-error";

type SafeAdminActionErrorOptions = {
  context: string;
  fallback: string;
};

export class SafeAdminActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeAdminActionError";
  }
}

export function getSafeAdminActionErrorMessage(
  error: unknown,
  options: SafeAdminActionErrorOptions
) {
  if (error instanceof SafeAdminActionError) {
    return error.message;
  }

  const validationMessage = getValidationMessage(error);

  if (validationMessage) {
    return validationMessage;
  }

  logServerError(`admin.${options.context}`, error);
  return getSafeErrorMessage(error, options.fallback);
}

function getValidationMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("issues" in error)) {
    return null;
  }

  const issues = (error as { issues?: Array<{ message?: unknown }> }).issues;
  const message = Array.isArray(issues) ? issues[0]?.message : null;

  return typeof message === "string" ? message : null;
}

export function isUniqueConstraintError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  return /duplicate key|unique constraint|23505/i.test(message);
}
