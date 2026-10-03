/** Parser CSV simplu (virgulă, ghilimele duble, CRLF/LF). */

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = splitCsvLines(normalized);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0]!.map((h) => h.trim());
  const rows = lines.slice(1).filter((r) => r.some((c) => c.trim().length > 0));
  return { headers, rows };
}

function splitCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function rowToObject(
  headers: string[],
  cells: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i]!;
    if (!key) continue;
    out[key] = (cells[i] ?? '').trim();
  }
  return out;
}
