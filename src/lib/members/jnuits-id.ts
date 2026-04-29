const STANDARD_JNUITS_ID_PATTERN = /^JNUITS-([0-9]{7})$/i;
const LEGACY_ALUMNI_ID_PATTERN = /^JNUITS-ALUMNI-([0-9]+)$/i;
const DIGITS_ONLY_PATTERN = /^([0-9]{7})$/;
const MEMBER_ID_PART_PATTERN = /^([0-9]{4})([0-9]{3})$/;

function normalizeMemberIdPart(value: string) {
  const match = value.match(MEMBER_ID_PART_PATTERN);

  if (!match) {
    return "";
  }

  const serial = Number.parseInt(match[2] || "", 10);

  if (!Number.isFinite(serial) || serial <= 0) {
    return "";
  }

  return `${match[1]}${match[2]}`;
}

export function normalizeJnuitsIdForCreation(value: string) {
  const raw = value.trim().toUpperCase();

  if (!raw) {
    return "";
  }

  const standardMatch = raw.match(STANDARD_JNUITS_ID_PATTERN);

  if (standardMatch) {
    const numericPart = normalizeMemberIdPart(standardMatch[1]);
    return numericPart ? `JNUITS-${numericPart}` : "";
  }

  const digitsOnlyMatch = raw.match(DIGITS_ONLY_PATTERN);

  if (digitsOnlyMatch) {
    const numericPart = normalizeMemberIdPart(digitsOnlyMatch[1]);
    return numericPart ? `JNUITS-${numericPart}` : "";
  }

  return "";
}

export function formatMembershipIdForDisplay(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const raw = value.trim();
  const legacyAlumniMatch = raw.match(LEGACY_ALUMNI_ID_PATTERN);

  if (legacyAlumniMatch) {
    const serial = Number.parseInt(legacyAlumniMatch[1] || "", 10);

    if (Number.isFinite(serial) && serial > 0 && serial <= 999) {
      return `JnUITS-0000${String(serial).padStart(3, "0")}`;
    }
  }

  const normalized = normalizeJnuitsIdForCreation(value);
  return normalized ? normalized.replace(/^JNUITS-/i, "JnUITS-") : raw;
}

export function formatJnuitsIdForDisplay(value: string | null | undefined) {
  return formatMembershipIdForDisplay(value);
}

export function parseMembershipIdParts(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = normalizeJnuitsIdForCreation(value);
  const match = normalized.match(/^JNUITS-([0-9]{4})([0-9]{3})$/);

  if (!match) {
    return null;
  }

  return {
    normalized,
    serial: Number.parseInt(match[2], 10),
    yearBlock: match[1],
  };
}

export function buildGeneratedJnuitsId(existingIds: string[], now = new Date()) {
  const yearPrefix = String(now.getUTCFullYear());
  let maxSequence = 0;

  for (const value of existingIds) {
    const normalized = normalizeJnuitsIdForCreation(value);

    if (!normalized) {
      continue;
    }

    const parsed = parseMembershipIdParts(normalized);

    if (!parsed || parsed.yearBlock !== yearPrefix) {
      continue;
    }

    if (parsed.serial > maxSequence) {
      maxSequence = parsed.serial;
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
