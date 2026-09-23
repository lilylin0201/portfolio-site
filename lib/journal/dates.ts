// Weeks run Monday to Sunday, like "Week 9/21-9/27".

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isISODate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7)); // back to Monday
  return copy;
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function shortDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function weekTitle(startISO: string): string {
  const start = parseISODate(startISO);
  return `Week ${shortDate(start)}-${shortDate(addDays(start, 6))}`;
}

// Suggest the week after the latest one, or this week if there are none.
export function suggestNextWeek(existingStartDates: string[]): string {
  if (existingStartDates.length === 0) return toISODate(startOfWeek(new Date()));
  const latest = [...existingStartDates].sort().at(-1)!;
  return toISODate(addDays(parseISODate(latest), 7));
}

export function sortWeeksNewestFirst<T extends { startDate: string }>(weeks: T[]): T[] {
  return [...weeks].sort((a, b) => b.startDate.localeCompare(a.startDate));
}
