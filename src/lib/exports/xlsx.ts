import "server-only";

import { deflateRawSync } from "node:zlib";
import { escapeXml, type ExportTable } from "./tabular";

type ZipEntry = {
  data: Buffer;
  name: string;
};

export type XlsxWorksheet = {
  name: string;
  table: ExportTable;
};

const CRC32_TABLE = (() => {
  const values = new Uint32Array(256);

  for (let index = 0; index < values.length; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    values[index] = value >>> 0;
  }

  return values;
})();

function crc32(data: Buffer) {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(entries: readonly ZipEntry[]) {
  const localFiles: Buffer[] = [];
  const centralDirectory: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.data);
    const checksum = crc32(entry.data);
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const centralHeader = Buffer.alloc(46);

    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    localFiles.push(localHeader, name, compressed);
    centralDirectory.push(centralHeader, name);
    offset += localHeader.length + name.length + compressed.length;
  }

  const directory = Buffer.concat(centralDirectory);
  const end = Buffer.alloc(22);

  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localFiles, directory, end]);
}

function columnReference(columnIndex: number) {
  let index = columnIndex;
  let reference = "";

  while (index > 0) {
    const remainder = (index - 1) % 26;
    reference = String.fromCharCode(65 + remainder) + reference;
    index = Math.floor((index - 1) / 26);
  }

  return reference;
}

export function createWorksheetXml(table: ExportTable) {
  const rows = [
    table.columns.map((column) => column.label),
    ...table.rows.map((row) => table.columns.map((column) => row[column.key])),
  ]
    .map((values, rowIndex) => {
      const cells = values
        .map(
          (value, columnIndex) =>
            `<c r="${columnReference(columnIndex + 1)}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
        )
        .join("");

      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
}

function normalizeSheetName(value: string) {
  const normalized = value
    .replace(/[\\/*?:\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^'+|'+$/g, "")
    .slice(0, 31)
    .trim();

  return normalized || "Export";
}

function uniqueSheetNames(sheets: readonly XlsxWorksheet[]) {
  const used = new Set<string>();

  return sheets.map(({ name }) => {
    const base = normalizeSheetName(name);
    let candidate = base;
    let copy = 2;

    while (used.has(candidate.toLocaleLowerCase("en-US"))) {
      const suffix = ` (${copy})`;
      candidate = `${base.slice(0, 31 - suffix.length).trimEnd()}${suffix}`;
      copy += 1;
    }

    used.add(candidate.toLocaleLowerCase("en-US"));
    return candidate;
  });
}

export function createXlsxWorkbookFromSheets(sheets: readonly XlsxWorksheet[]) {
  if (sheets.length === 0) {
    throw new RangeError("An XLSX workbook requires at least one worksheet.");
  }

  const sheetNames = uniqueSheetNames(sheets);
  const worksheetOverrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("");
  const workbookSheets = sheetNames
    .map(
      (name, index) =>
        `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join("");
  const workbookRelationships = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join("");
  const entries: ZipEntry[] = [
    {
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${worksheetOverrides}</Types>`,
        "utf8"
      ),
      name: "[Content_Types].xml",
    },
    {
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
        "utf8"
      ),
      name: "_rels/.rels",
    },
    {
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`,
        "utf8"
      ),
      name: "xl/workbook.xml",
    },
    {
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRelationships}</Relationships>`,
        "utf8"
      ),
      name: "xl/_rels/workbook.xml.rels",
    },
    ...sheets.map((sheet, index) => ({
      data: Buffer.from(createWorksheetXml(sheet.table), "utf8"),
      name: `xl/worksheets/sheet${index + 1}.xml`,
    })),
  ];

  return createZip(entries);
}

export function createXlsxWorkbook(table: ExportTable, sheetName = "Export") {
  return createXlsxWorkbookFromSheets([{ name: sheetName, table }]);
}
