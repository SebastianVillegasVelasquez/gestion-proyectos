// Parser CSV minimalista para la vista previa de carga masiva de usuarios.
// Solo necesitamos algo lo bastante robusto para separar comas y comillas;
// la validación real (filas inválidas, duplicados, etc.) la hace el backend.
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

export interface ParsedUsersCsv {
  headers: string[];
  rows: Record<string, string>[];
}

const BOM = String.fromCharCode(0xfeff);

export function parseUsersCsv(text: string): ParsedUsersCsv {
  const withoutBom = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  const lines = withoutBom.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });

  return { headers, rows };
}
