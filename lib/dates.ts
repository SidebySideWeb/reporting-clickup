const TZ = "Europe/Athens";
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const dayKey = (ms: number) => fmt.format(new Date(ms)); // YYYY-MM-DD
export const today = () => dayKey(Date.now());
export const keyToUTC = (k: string) => Date.parse(k + "T00:00:00Z");
export const utcToKey = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (k: string, n: number) => utcToKey(keyToUTC(k) + n * 864e5);
export const dow = (k: string) => new Date(keyToUTC(k)).getUTCDay();
export const weekStart = (k: string) => addDays(k, -((dow(k) + 6) % 7));
export const monthStart = (k: string) => k.slice(0, 8) + "01";
export const diffDays = (a: string, b: string) => Math.round((keyToUTC(b) - keyToUTC(a)) / 864e5);

export function isWorkday(k: string, holidays: Set<string>) {
  const d = dow(k);
  return d !== 0 && d !== 6 && !holidays.has(k);
}
export function workdaysBetween(from: string, to: string, holidays: Set<string>) {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) if (isWorkday(k, holidays)) out.push(k);
  return out;
}
export const fmtDate = (k: string | null | undefined) => {
  if (!k) return "–";
  const [y, m, d] = k.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};
export const fmtH = (h: number) =>
  Math.abs(h) >= 100 ? Math.round(h).toString() : (Math.round(h * 10) / 10).toString();
