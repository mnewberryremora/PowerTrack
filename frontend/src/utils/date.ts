/**
 * Parse a YYYY-MM-DD date string as local time (not UTC).
 * `new Date("2026-03-15")` parses as UTC midnight, which shifts back
 * a day in US timezones. Appending T12:00:00 avoids this.
 */
export function parseLocalDate(iso: string): Date {
  // If it's just a date (no time component), force noon local time
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return new Date(iso + 'T12:00:00')
  }
  return new Date(iso)
}

export function formatDate(
  iso: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', opts ?? {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function daysUntil(dateStr: string): number {
  const target = parseLocalDate(dateStr)
  target.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = target.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function daysSince(dateStr: string): number {
  const target = parseLocalDate(dateStr)
  target.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = now.getTime() - target.getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}
