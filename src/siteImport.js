import * as XLSX from "xlsx";

export const SITE_IMPORT_HEADERS = [
  "name",
  "client",
  "address",
  "city",
  "state",
  "zip",
  "status",
  "siteNumber",
  "serviceTypes",
  "notes",
  "contactName",
  "contactPhone",
  "contactEmail",
];

const REQUIRED_SITE_IMPORT_FIELDS = [
  "name",
  "client",
  "address",
  "city",
  "state",
  "zip",
  "status",
  "siteNumber",
  "serviceTypes",
];

function normalizeCell(value) {
  return String(value ?? "").trim();
}

function isBlankRow(row) {
  return row.every((value) => !normalizeCell(value));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function validateHeaders(headers) {
  const normalizedHeaders = headers.map(normalizeCell);
  const matches =
    normalizedHeaders.length === SITE_IMPORT_HEADERS.length &&
    SITE_IMPORT_HEADERS.every((header, index) => normalizedHeaders[index] === header);

  if (matches) return "";

  return `Invalid site upload template. Required headers are: ${SITE_IMPORT_HEADERS.join(", ")}.`;
}

function rowToRecord(row) {
  return SITE_IMPORT_HEADERS.reduce((record, header, index) => {
    record[header] = normalizeCell(row[index]);
    return record;
  }, {});
}

function validateRecord(record, seenSiteNumbers) {
  const errors = [];

  REQUIRED_SITE_IMPORT_FIELDS.forEach((field) => {
    if (!record[field]) errors.push(`${field} is required`);
  });

  if (record.state && !/^[A-Za-z]{2}$/.test(record.state)) {
    errors.push("state must be a 2-letter abbreviation");
  }

  if (record.siteNumber) {
    const duplicateKey = record.siteNumber.toLowerCase();
    if (seenSiteNumbers.has(duplicateKey)) {
      errors.push("duplicate siteNumber in upload file");
    } else {
      seenSiteNumbers.add(duplicateKey);
    }
  }

  const serviceTypes = record.serviceTypes
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (record.serviceTypes && !serviceTypes.length) {
    errors.push("serviceTypes must include at least one value");
  }

  return {
    ...record,
    state: record.state.toUpperCase(),
    serviceTypes,
    errors,
  };
}

function buildPreviewRows(rawRows) {
  const headers = rawRows[0] || [];
  const headerError = validateHeaders(headers);
  if (headerError) {
    return { rows: [], error: headerError };
  }

  const seenSiteNumbers = new Set();
  const rows = rawRows
    .slice(1)
    .filter((row) => !isBlankRow(row))
    .map((row, index) => {
      const record = validateRecord(rowToRecord(row), seenSiteNumbers);
      return {
        id: `site-import-${index + 2}`,
        rowNumber: index + 2,
        valid: record.errors.length === 0,
        site: record,
        errors: record.errors,
      };
    });

  if (!rows.length) {
    return { rows: [], error: "No site rows were found in the uploaded file." };
  }

  return { rows, error: "" };
}

export async function parseSiteImportFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    const text = await file.text();
    return buildPreviewRows(parseCsv(text));
  }

  if (extension === "xlsx") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", raw: false, cellText: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { rows: [], error: "The uploaded workbook does not contain a sheet." };
    }
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });
    return buildPreviewRows(rows);
  }

  return { rows: [], error: "Unsupported file type. Upload a .xlsx or .csv file." };
}
