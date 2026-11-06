export type QuickFilter = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export interface DateRange {
  /** Inclusive start (00:00:00.000 local) */
  start: Date;
  /** Exclusive end (00:00 of the day after the last day) */
  end: Date;
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Week starts on Monday (Indian business convention). */
export function quickRange(filter: Exclude<QuickFilter, 'custom'>, now = new Date()): DateRange {
  const today = startOfDay(now);
  switch (filter) {
    case 'today':
      return { start: today, end: addDays(today, 1) };
    case 'yesterday':
      return { start: addDays(today, -1), end: today };
    case 'week': {
      const offset = (today.getDay() + 6) % 7; // Monday = 0
      return { start: addDays(today, -offset), end: addDays(today, 1) };
    }
    case 'month':
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: addDays(today, 1) };
  }
}

/** Custom range from two calendar days (inclusive). Order of the two days does not matter. */
export function customRange(a: Date, b: Date): DateRange {
  const [first, last] = a <= b ? [a, b] : [b, a];
  return { start: startOfDay(first), end: addDays(startOfDay(last), 1) };
}

/** yyyy-mm-dd in local time (calendar keys). */
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const parseDayKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
