/**
 * A bare `to` date like "2026-08-17" is parsed by Postgres/JS as midnight
 * (00:00:00.000) at the START of that day — so a naive `startTime <= :to`
 * comparison excludes the entire day it's meant to include (anything from
 * a bare date's midnight onward never matches). Appending end-of-day time
 * makes an inclusive "through the end of this day" comparison instead.
 * Already-precise datetime strings (containing a "T") are passed through
 * unchanged.
 */
export function toInclusiveEndOfDay(dateString: string): string {
  return dateString.includes('T') ? dateString : `${dateString}T23:59:59.999`;
}
