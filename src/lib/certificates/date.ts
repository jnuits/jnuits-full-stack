function toIsoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return [
    year.toString().padStart(4, "0"),
    month.toString().padStart(2, "0"),
    day.toString().padStart(2, "0"),
  ].join("-");
}

function expandTwoDigitYear(year: number) {
  // Keep two-digit dates deterministic: 00-69 are 2000-2069 and 70-99 are
  // 1970-1999, matching the conventional POSIX century pivot.
  return year <= 69 ? 2000 + year : 1900 + year;
}

/**
 * Converts supported certificate entry formats to the ISO date stored in
 * Supabase. Day-first input is intentionally unambiguous for Bangladesh.
 */
export function normalizeCertificateIssueDate(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    return toIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const dayFirstMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dayFirstMatch) {
    return toIsoDate(
      Number(dayFirstMatch[3]),
      Number(dayFirstMatch[2]),
      Number(dayFirstMatch[1])
    );
  }

  const dayFirstShortYearMatch = trimmed.match(
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/
  );
  if (dayFirstShortYearMatch) {
    return toIsoDate(
      expandTwoDigitYear(Number(dayFirstShortYearMatch[3])),
      Number(dayFirstShortYearMatch[2]),
      Number(dayFirstShortYearMatch[1])
    );
  }

  if (/^\d{5}$/.test(trimmed)) {
    const serial = Number(trimmed);
    if (serial >= 20_000 && serial <= 80_000) {
      const excelDate = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
      return toIsoDate(
        excelDate.getUTCFullYear(),
        excelDate.getUTCMonth() + 1,
        excelDate.getUTCDate()
      );
    }
  }

  if (!/[a-z]/i.test(trimmed)) return null;

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime())
    ? null
    : toIsoDate(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
}

