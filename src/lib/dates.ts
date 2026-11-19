import type { DateValue } from "./schema";

export const MS_DAY = 86_400_000;
export const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MONTHS_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const dayNum = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / MS_DAY;
};
export const isoDay = (n: number) => new Date(n * MS_DAY).toISOString().slice(0, 10);
export const shiftDate = (s: string, n: number) => isoDay(dayNum(s) + n) + s.slice(10);
export const dateOf = (n: number) => new Date(n * MS_DAY);
export const todayNum = () => {
  const t = new Date();
  return Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / MS_DAY;
};

export type Span = { start: number; end: number };
export const spanOf = (v: DateValue | undefined): Span | null => {
  if (!v?.start) return null;
  const start = dayNum(v.start);
  const end = v.end ? Math.max(start, dayNum(v.end)) : start;
  return { start, end };
};

export function moveDate(v: DateValue, toStartDay: number): DateValue {
  const delta = toStartDay - dayNum(v.start);
  const start = shiftDate(v.start, delta);
  return v.end ? { start, end: shiftDate(v.end, delta) } : { start };
}
