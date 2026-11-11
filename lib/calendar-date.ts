/**
 * Central timezone & calendar-date utilities.
 * Guarantees identical date keys, wall-clock formatting, and day/month boundaries
 * whether executed on Vercel's UTC serverless runtime or in the user's browser.
 */

export const DEFAULT_TIMEZONE = 'America/Mexico_City'

function getPartsInTimezone(
  dateInput: Date | string | number,
  timeZone = DEFAULT_TIMEZONE,
): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} | null {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (Number.isNaN(d.getTime())) return null

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(d)

    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? 0)

    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
      hour: get('hour') % 24,
      minute: get('minute'),
      second: get('second'),
    }
  } catch {
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
    }
  }
}

/**
 * Returns `YYYY-MM-DD` in the target timezone (defaults to `America/Mexico_City`).
 */
export function formatDateKeyInTimezone(
  dateInput: Date | string | number,
  timeZone = DEFAULT_TIMEZONE,
): string {
  const parts = getPartsInTimezone(dateInput, timeZone)
  if (!parts) return ''
  const y = String(parts.year).padStart(4, '0')
  const m = String(parts.month).padStart(2, '0')
  const d = String(parts.day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Returns a Date whose local getters (`getFullYear`, `getMonth`, `getDate`,
 * `getHours`, `getMinutes`, `getDay`) match the wall-clock time in `timeZone`.
 * Safe to pass directly into `date-fns` `format(toZonedWallClockDate(iso), ...)`
 * on both UTC servers and client browsers.
 */
export function toZonedWallClockDate(
  dateInput: Date | string | number,
  timeZone = DEFAULT_TIMEZONE,
): Date {
  const parts = getPartsInTimezone(dateInput, timeZone)
  if (!parts) return new Date(NaN)
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
}

/**
 * Converts a wall-clock date/time in `timeZone` into its exact UTC `Date` instant.
 */
export function zonedWallClockToUtcDate(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
  timeZone = DEFAULT_TIMEZONE,
): Date {
  const guessUtcMs = Date.UTC(year, monthIndex, day, hour, minute, second, ms)
  const parts = getPartsInTimezone(new Date(guessUtcMs), timeZone)
  if (!parts) return new Date(guessUtcMs)
  const wallAsUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0,
  )
  const offsetMs = wallAsUtcMs - Date.UTC(year, monthIndex, day, hour, minute, second, 0)
  return new Date(guessUtcMs - offsetMs)
}

/**
 * Returns the exact UTC `Date` corresponding to `00:00:00.000` in `timeZone`
 * for `dateInput` shifted by `daysOffset` calendar days.
 */
export function getStartOfDayInTimezone(
  dateInput: Date | string | number = new Date(),
  timeZone = DEFAULT_TIMEZONE,
  daysOffset = 0,
): Date {
  const parts = getPartsInTimezone(dateInput, timeZone)
  if (!parts) return new Date()
  return zonedWallClockToUtcDate(
    parts.year,
    parts.month - 1,
    parts.day + daysOffset,
    0,
    0,
    0,
    0,
    timeZone,
  )
}

/**
 * Returns the exact UTC `Date` corresponding to the 1st of the month at `00:00:00.000`
 * in `timeZone` (optionally shifted by `monthsOffset` months).
 */
export function getStartOfMonthInTimezone(
  dateInput: Date | string | number = new Date(),
  timeZone = DEFAULT_TIMEZONE,
  monthsOffset = 0,
): Date {
  const parts = getPartsInTimezone(dateInput, timeZone)
  if (!parts) return new Date()
  return zonedWallClockToUtcDate(
    parts.year,
    parts.month - 1 + monthsOffset,
    1,
    0,
    0,
    0,
    0,
    timeZone,
  )
}

/** Calendar date keys in the form `YYYY-MM-DD`, always interpreted in the **local** timezone. */
export function dateKeyToLocalDate(dateKey: string): Date {
  const parts = dateKey.split('-').map((p) => Number(p))
  const y = parts[0]
  const mo = parts[1]
  const d = parts[2]
  if (!y || !mo || !d || parts.length !== 3) {
    throw new Error(`Invalid date key: ${dateKey}`)
  }
  return new Date(y, mo - 1, d, 12, 0, 0)
}

/**
 * Format a `YYYY-MM-DD` key for display without UTC parsing bugs.
 * (`new Date("2026-03-25")` is UTC midnight and can show as the previous calendar day.)
 */
export function formatDateKeyLocal(
  dateKey: string,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
) {
  return dateKeyToLocalDate(dateKey).toLocaleDateString(locale, options)
}

/**
 * Safely parse a recorded date string (ISO timestamp or YYYY-MM-DD) into a local Date at 12:00 (noon)
 * to prevent any timezone offsets (e.g. UTC-6 Mexico City) from shifting the calendar date backwards.
 */
export function parseRecordedDate(
  dateStr: string,
  timeZone = DEFAULT_TIMEZONE,
): Date {
  if (!dateStr) return toZonedWallClockDate(new Date(), timeZone)
  const trimmed = dateStr.trim()
  // Pure YYYY-MM-DD or midnight/noon UTC date-only strings (e.g. from body_measurements or progress_photos)
  const dateOnlyMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](?:00:00:00|12:00:00)(?:\.0+)?(?:Z|[+-]00:?00)?)?$/,
  )
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch
    return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0)
  }
  const zoned = toZonedWallClockDate(trimmed, timeZone)
  if (!Number.isNaN(zoned.getTime())) return zoned
  return new Date(trimmed)
}

/** Format a Date object to YYYY-MM-DD */
export function formatLocalDateYmd(date?: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Exact calendar days difference in `timeZone` between `earlier` and `later`.
 * E.g. Nov 9 21:00 CST to Nov 10 09:00 CST -> 1 day ("Ayer").
 */
export function calendarDaysBetweenInTimezone(
  earlier: Date | string | number,
  later: Date | string | number = new Date(),
  timeZone = DEFAULT_TIMEZONE,
): number | null {
  const a = getPartsInTimezone(earlier, timeZone)
  const b = getPartsInTimezone(later, timeZone)
  if (!a || !b) return null
  const utcA = Date.UTC(a.year, a.month - 1, a.day)
  const utcB = Date.UTC(b.year, b.month - 1, b.day)
  return Math.max(0, Math.round((utcB - utcA) / 86400000))
}

/** Días calendario enteros desde un instante ISO hasta ahora en la zona horaria del gym. */
export function diffWholeDaysFromNow(
  fromIso?: string | null,
  _now?: Date,
  timeZone = DEFAULT_TIMEZONE,
): number | null {
  if (!fromIso) return null
  return calendarDaysBetweenInTimezone(fromIso, new Date(), timeZone)
}

/**
 * Returns a Date object whose local fields (`getFullYear`, `getMonth`, `getDate`, `getDay`, `getHours`)
 * represent "now" in the specific timezone.
 */
export function getNowInTimezone(timeZone = DEFAULT_TIMEZONE): Date {
  return toZonedWallClockDate(new Date(), timeZone)
}

/** Útil para comparar `clients.membership_end` vs `payments.period_end`. */
export function isoTimestampsDifferMoreThanDays(
  a: string | null | undefined,
  b: string | null | undefined,
  thresholdDays = 1,
): boolean {
  if (!a?.trim() || !b?.trim()) return false
  const da = parseRecordedDate(a).getTime()
  const db = parseRecordedDate(b).getTime()
  if (Number.isNaN(da) || Number.isNaN(db)) return false
  return Math.abs(da - db) > thresholdDays * 86400000
}
