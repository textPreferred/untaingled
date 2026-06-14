const DATE_PATTERN = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/;

export type ParsedDate = { year: string; month?: string; day?: string };

export function parseDate(date: string): ParsedDate | null {
  const m = DATE_PATTERN.exec(date);
  if (!m) return null;
  return {
    year: m[1]!,
    ...(m[2] !== undefined ? { month: m[2] } : {}),
    ...(m[3] !== undefined ? { day: m[3] } : {}),
  };
}

export function normalizeDate(date: string): string {
  const p = parseDate(date);
  if (!p) return date;
  let r = p.year;
  if (p.month) r += "-" + p.month.padStart(2, "0");
  if (p.day) r += "-" + p.day.padStart(2, "0");
  return r;
}

export function isValidDate(date: string): boolean {
  const p = parseDate(date);
  if (!p) return false;
  if (!p.month) return true;
  const month = Number(p.month);
  if (month < 1 || month > 12) return false;
  if (!p.day) return true;
  const year = Number(p.year);
  const day = Number(p.day);
  if (day < 1) return false;
  const dt = new Date(year, month - 1, day);
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day;
}

export function dateParents(date: string): string[] {
  const parents: string[] = [];
  if (date.length === 10) parents.push(date.slice(0, 7));
  if (date.length >= 7) parents.push(date.slice(0, 4));
  return parents;
}
