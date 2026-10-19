/** RFC 4180 风格 CSV 解析与序列化（零依赖，处理引号/转义/换行）。 */

export interface CsvOptions {
  delimiter?: string; // 默认 ','
  /** 解析时是否把首行当表头，默认 true */
  header?: boolean;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts: Array<[string, number]> = [
    [',', (firstLine.match(/,/g) ?? []).length],
    ['\t', (firstLine.match(/\t/g) ?? []).length],
    [';', (firstLine.match(/;/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

/** 解析 CSV 为对象数组（有表头）或二维数组（header=false）。 */
export function csvParse(text: string, opts: CsvOptions = {}): Array<Record<string, string> | string[]> {
  const delim = opts.delimiter ?? detectDelimiter(text);
  const useHeader = opts.header ?? true;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"' && field === '') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);

  if (!useHeader) return rows;
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = r[idx] ?? '';
    });
    return obj;
  });
}

function csvEscape(v: string, delim: string): string {
  if (v.includes(delim) || v.includes('"') || v.includes('\n') || v.includes('\r')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** 对象数组（或二维数组）序列化为 CSV 文本。 */
export function csvStringify(
  data: Array<Record<string, unknown> | string[]>,
  opts: CsvOptions = {},
): string {
  const delim = opts.delimiter ?? ',';
  if (data.length === 0) return '';
  const first = data[0];
  if (Array.isArray(first)) {
    return (data as string[][]).map((r) => r.map((v) => csvEscape(String(v ?? ''), delim)).join(delim)).join('\n');
  }
  // 对象数组：表头取所有键的并集（保持首次出现顺序）
  const header: string[] = [];
  for (const item of data as Array<Record<string, unknown>>) {
    for (const k of Object.keys(item)) {
      if (!header.includes(k)) header.push(k);
    }
  }
  const lines = [header.map((h) => csvEscape(h, delim)).join(delim)];
  for (const item of data as Array<Record<string, unknown>>) {
    lines.push(header.map((h) => csvEscape(stringifyCell(item[h]), delim)).join(delim));
  }
  return lines.join('\n');
}

function stringifyCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function csvToJson(text: string, opts: CsvOptions = {}): string {
  const rows = csvParse(text, opts);
  return JSON.stringify(rows, null, 2);
}

export function jsonToCsv(text: string, opts: CsvOptions = {}): string {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON 解析失败: ${(e as Error).message}`);
  }
  if (!Array.isArray(v)) throw new Error('JSON 顶层必须是数组');
  return csvStringify(v as Array<Record<string, unknown> | string[]>, opts);
}
