const PWNED_PASSWORDS_RANGE_URL = "https://api.pwnedpasswords.com/range";
const DEFAULT_TIMEOUT_MS = 4_000;

export type PasswordExposureResult =
  | { count: number; status: "pwned" }
  | { status: "safe" }
  | { status: "unavailable" };

type PasswordExposureOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    clear: () => clearTimeout(timeout),
    signal: controller.signal,
  };
}

/**
 * Hashes locally with Web Crypto. The plaintext password never leaves this process.
 */
export async function sha1PasswordHash(password: string) {
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) {
    throw new Error("Web Crypto is unavailable.");
  }

  const digest = await subtle.digest("SHA-1", new TextEncoder().encode(password));
  return toHex(new Uint8Array(digest)).toUpperCase();
}

function findSuffixCount(body: string, suffix: string) {
  for (const line of body.split(/\r?\n/)) {
    const [candidate, rawCount] = line.split(":", 2);

    if (candidate?.trim().toUpperCase() !== suffix) continue;

    const count = Number.parseInt(rawCount?.trim() || "0", 10);
    return Number.isFinite(count) && count > 0 ? count : 0;
  }

  return 0;
}

/**
 * Queries HIBP's free range API using k-anonymity: only five SHA-1 hash characters
 * are sent to HIBP and the complete suffix comparison stays local.
 */
export async function checkPasswordExposure(
  password: string,
  options: PasswordExposureOptions = {}
): Promise<PasswordExposureResult> {
  try {
    const hash = await sha1PasswordHash(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const timeout = createTimeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const response = await (options.fetchImpl ?? fetch)(
        `${PWNED_PASSWORDS_RANGE_URL}/${prefix}`,
        {
          headers: {
            // HIBP pads the response so response size leaks less about the searched range.
            "Add-Padding": "true",
          },
          signal: timeout.signal,
        }
      );

      if (!response.ok) return { status: "unavailable" };

      const count = findSuffixCount(await response.text(), suffix);
      return count > 0 ? { count, status: "pwned" } : { status: "safe" };
    } finally {
      timeout.clear();
    }
  } catch {
    return { status: "unavailable" };
  }
}

export async function getPasswordExposureError(password: string) {
  const result = await checkPasswordExposure(password);

  if (result.status === "pwned") {
    return "This password has appeared in known data breaches. Choose a different password.";
  }

  if (result.status === "unavailable") {
    return "Password security verification is unavailable. Please try again shortly.";
  }

  return null;
}
