export type IntakeFieldName = "batchNo" | "departmentCode" | "joinedOn";

export type IntakeFieldIssue = {
  acceptedFormat: string;
  code:
    | "batch_format_invalid"
    | "batch_out_of_range"
    | "department_ambiguous"
    | "department_not_recognized"
    | "joining_date_format_invalid"
    | "joining_date_invalid";
  example: string;
  explanation: string;
  field: IntakeFieldName;
  receivedValue: string;
};

export type DepartmentCatalogEntry = {
  aliases: readonly string[];
  internalCode: string;
  name: string;
  shortCode: string;
};

export type DepartmentResolution =
  | {
      ok: true;
      value: {
        departmentCode: string;
        name: string;
        shortCode: string;
      };
    }
  | { issue: IntakeFieldIssue; ok: false };

export type BatchCodeResolution =
  | { batchNo: number; code: string; ok: true }
  | { issue: IntakeFieldIssue; ok: false };

export type JoiningDateResolution =
  | { ok: true; value: string }
  | { issue: IntakeFieldIssue; ok: false };

function normalizeDepartmentLookup(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ");
}

function safeReceivedValue(value: unknown) {
  return String(value ?? "").trim().slice(0, 160);
}

export function resolveDepartmentInput(
  value: string,
  catalog: readonly DepartmentCatalogEntry[],
): DepartmentResolution {
  const receivedValue = safeReceivedValue(value);
  const lookup = normalizeDepartmentLookup(receivedValue);
  const matches = new Map<string, DepartmentCatalogEntry>();

  for (const entry of catalog) {
    const candidates = [entry.internalCode, entry.shortCode, entry.name, ...entry.aliases];
    if (candidates.some((candidate) => normalizeDepartmentLookup(candidate) === lookup)) {
      matches.set(entry.internalCode, entry);
    }
  }

  if (matches.size === 1) {
    const entry = matches.values().next().value as DepartmentCatalogEntry;
    return {
      ok: true,
      value: {
        departmentCode: entry.internalCode,
        name: entry.name,
        shortCode: entry.shortCode,
      },
    };
  }

  if (matches.size > 1) {
    return {
      issue: {
        acceptedFormat: "Use one unambiguous code from the Department codes download.",
        code: "department_ambiguous",
        example: "CSE",
        explanation: "This value matches more than one department.",
        field: "departmentCode",
        receivedValue,
      },
      ok: false,
    };
  }

  return {
    issue: {
      acceptedFormat: "Use a code from the Department codes download.",
      code: "department_not_recognized",
      example: "CSE",
      explanation: "This department code or name is not recognized.",
      field: "departmentCode",
      receivedValue,
    },
    ok: false,
  };
}

function assertStoredBatch(batchNo: number) {
  if (!Number.isInteger(batchNo) || batchNo < 1 || batchNo > 99) {
    throw new RangeError("Batch number must be an integer from 1 to 99.");
  }
}

export function parseBatchCode(value: string): BatchCodeResolution {
  const receivedValue = safeReceivedValue(value);

  if (!/^\d{2}$/.test(receivedValue)) {
    return {
      issue: {
        acceptedFormat: "Use exactly two digits from 01 to 99.",
        code: "batch_format_invalid",
        example: "08",
        explanation: "Batch must contain exactly two decimal digits.",
        field: "batchNo",
        receivedValue,
      },
      ok: false,
    };
  }

  const batchNo = Number(receivedValue);
  if (batchNo < 1 || batchNo > 99) {
    return {
      issue: {
        acceptedFormat: "Use exactly two digits from 01 to 99.",
        code: "batch_out_of_range",
        example: "08",
        explanation: "Batch must be between 01 and 99.",
        field: "batchNo",
        receivedValue,
      },
      ok: false,
    };
  }

  return { batchNo, code: receivedValue, ok: true };
}

export function formatBatchCode(batchNo: number) {
  assertStoredBatch(batchNo);
  return String(batchNo).padStart(2, "0");
}

export function formatBatchOrdinal(batchNo: number) {
  assertStoredBatch(batchNo);
  const lastTwoDigits = batchNo % 100;
  const suffix =
    lastTwoDigits >= 11 && lastTwoDigits <= 13
      ? "th"
      : batchNo % 10 === 1
        ? "st"
        : batchNo % 10 === 2
          ? "nd"
          : batchNo % 10 === 3
            ? "rd"
            : "th";

  return `${batchNo}${suffix} Batch`;
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function parseJoiningDate(value: string): JoiningDateResolution {
  const receivedValue = safeReceivedValue(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(receivedValue);

  if (!match) {
    return {
      issue: {
        acceptedFormat: "YYYY-MM-DD",
        code: "joining_date_format_invalid",
        example: "2024-01-15",
        explanation: "Joining date must use the ISO date-only format.",
        field: "joinedOn",
        receivedValue,
      },
      ok: false,
    };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysByMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (year < 1 || month < 1 || month > 12 || day < 1 || day > (daysByMonth[month - 1] ?? 0)) {
    return {
      issue: {
        acceptedFormat: "YYYY-MM-DD",
        code: "joining_date_invalid",
        example: "2024-01-15",
        explanation: "Joining date is not a real calendar date.",
        field: "joinedOn",
        receivedValue,
      },
      ok: false,
    };
  }

  return { ok: true, value: receivedValue };
}
