import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

/**
 * Automatically detects the user's local timezone using the browser's Intl API.
 * Fallback to 'UTC' if detection fails or is unsupported.
 * 
 * Example: 'Asia/Kolkata' for India, 'Asia/Dubai' for Dubai, 'Europe/London' for UK.
 */
export const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (error) {
    console.warn('Failed to detect user timezone, defaulting to UTC', error);
    return 'UTC';
  }
};

/**
 * Converts a UTC timestamp or Date object to a Date object zoned to the specified timezone.
 * 
 * @param date The UTC date string or Date object
 * @param timezone The target timezone identifier (e.g., 'Asia/Kolkata')
 */
export const convertToLocalTime = (
  date: Date | string,
  timezone: string = getUserTimezone()
): Date => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return new Date(NaN);
  return toZonedTime(d, timezone);
};

/**
 * Formats a Date or UTC string to a local date representation based on the user's locale.
 * Example: '2026-06-20T08:00:00Z' -> 'June 20, 2026' or '20/06/2026'
 * 
 * @param date The Date or ISO timestamp string in UTC
 * @param timezone The target timezone (defaults to automatic user timezone)
 * @param locale The locale to format with (defaults to user's browser locale)
 */
export const formatDate = (
  date: Date | string,
  timezone: string = getUserTimezone(),
  locale: string = typeof window !== 'undefined' ? window.navigator.language : 'en-US'
): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';

  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(d);
};

/**
 * Formats a Date or UTC string to a local time representation, including the timezone abbreviation.
 * Example: 
 *   - India User (Asia/Kolkata): '1:30 PM IST'
 *   - Dubai User (Asia/Dubai): '12:00 PM GST'
 *   - US User (America/New_York): '4:00 AM EDT'
 * 
 * @param date The Date or ISO timestamp string in UTC
 * @param timezone The target timezone (defaults to automatic user timezone)
 * @param locale The locale to format with (defaults to user's browser locale)
 */
export const formatTime = (
  date: Date | string,
  timezone: string = getUserTimezone(),
  locale: string = typeof window !== 'undefined' ? window.navigator.language : 'en-US'
): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Time';

  // Create a localized formatter including short timezone name (e.g. IST, GST)
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });

  return formatter.format(d);
};

/**
 * Formats a Date or UTC string to a full local date and time representation.
 * Example: '2026-06-20T08:00:00Z' -> 'June 20, 2026, 1:30 PM IST'
 * 
 * @param date The Date or ISO timestamp string in UTC
 * @param timezone The target timezone (defaults to automatic user timezone)
 * @param locale The locale to format with (defaults to user's browser locale)
 */
export const formatDateTime = (
  date: Date | string,
  timezone: string = getUserTimezone(),
  locale: string = typeof window !== 'undefined' ? window.navigator.language : 'en-US'
): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date/Time';

  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  }).format(d);
};

/**
 * Advanced custom formatting using 'date-fns-tz' pattern rules.
 * 
 * @param date The UTC date string or Date object
 * @param pattern The pattern format string (e.g., 'yyyy-MM-dd HH:mm:ss zzz')
 * @param timezone The target timezone (defaults to automatic user timezone)
 */
export const formatWithPattern = (
  date: Date | string,
  pattern: string,
  timezone: string = getUserTimezone()
): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';
  return formatInTimeZone(d, timezone, pattern);
};
