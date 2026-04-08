const STANDARD_JNUITS_ID_PATTERN = /^JNUITS-(\d+)$/i;
const DIGITS_ONLY_PATTERN = /^(\d+)$/;

function normalizePositiveNumber(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "";
  }

  return String(parsed);
}

export function normalizeJnuitsIdForCreation(value: string) {
  const raw = value.trim().toUpperCase();

  if (!raw) {
    return "";
  }

  const standardMatch = raw.match(STANDARD_JNUITS_ID_PATTERN);

  if (standardMatch) {
    const numericPart = normalizePositiveNumber(standardMatch[1]);
    return numericPart ? `JNUITS-${numericPart}` : "";
  }

  const digitsOnlyMatch = raw.match(DIGITS_ONLY_PATTERN);

  if (digitsOnlyMatch) {
    const numericPart = normalizePositiveNumber(digitsOnlyMatch[1]);
    return numericPart ? `JNUITS-${numericPart}` : "";
  }

  return "";
}

export function buildGeneratedJnuitsId(existingIds: string[], now = new Date()) {
  const yearPrefix = String(now.getUTCFullYear());
  let maxSequence = 0;

  for (const value of existingIds) {
    const normalized = normalizeJnuitsIdForCreation(value);

    if (!normalized) {
      continue;
    }

    const numericPart = normalized.replace("JNUITS-", "");

    if (!numericPart.startsWith(yearPrefix)) {
      continue;
    }

    const yearSequence = Number.parseInt(numericPart.slice(yearPrefix.length), 10);

    if (Number.isFinite(yearSequence) && yearSequence > maxSequence) {
      maxSequence = yearSequence;
    }
  }

  return `JNUITS-${yearPrefix}${String(maxSequence + 1).padStart(3, "0")}`;
}

export function extractBatchNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/^(\d+)\s*(st|nd|rd|th)?$/i);

  if (!match) {
    return null;
  }

  const batchNumber = Number.parseInt(match[1], 10);
  return Number.isFinite(batchNumber) && batchNumber > 0 ? batchNumber : null;
}
