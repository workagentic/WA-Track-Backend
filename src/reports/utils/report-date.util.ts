import { TimeEntry } from '../../time-entries/time-entry.entity';
import { MONTH_ABBR } from '../constant/report.constant';

/** UTC calendar day of a time entry's startTime — the report has no client timezone to work with. */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dateKeyLabel(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number);
  return `${d} ${MONTH_ABBR[m - 1]}`;
}

export function formatGenerated(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Every UTC day between from/to inclusive; falls back to the span of the data itself when no range was given. */
export function enumerateDateKeys(from: string | undefined, to: string | undefined, entries: TimeEntry[]): string[] {
  let start: Date;
  let end: Date;

  if (from && to) {
    start = new Date(`${from}T00:00:00.000Z`);
    end = new Date(`${to}T00:00:00.000Z`);
  } else if (entries.length > 0) {
    const keys = entries.map((e) => toDateKey(e.startTime)).sort();
    start = new Date(`${keys[0]}T00:00:00.000Z`);
    end = new Date(`${keys[keys.length - 1]}T00:00:00.000Z`);
  } else {
    return [];
  }

  const keys: string[] = [];
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    keys.push(toDateKey(d));
  }
  return keys;
}
