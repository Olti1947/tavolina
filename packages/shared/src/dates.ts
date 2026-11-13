import { formatInTimeZone } from 'date-fns-tz';

/** Timestamps are stored in UTC and shown in the zone Kosovo uses (CLAUDE.md section 5). */
export const DISPLAY_TIME_ZONE = 'Europe/Belgrade';

/** `dd.MM.yyyy`, e.g. `13.11.2026`. */
export function formatDate(instant: Date | string, timeZone = DISPLAY_TIME_ZONE): string {
  return formatInTimeZone(instant, timeZone, 'dd.MM.yyyy');
}

/** `HH:mm`, e.g. the "Përditësuar 21:42" label. */
export function formatTime(instant: Date | string, timeZone = DISPLAY_TIME_ZONE): string {
  return formatInTimeZone(instant, timeZone, 'HH:mm');
}

/** `dd.MM.yyyy HH:mm`. */
export function formatDateTime(instant: Date | string, timeZone = DISPLAY_TIME_ZONE): string {
  return formatInTimeZone(instant, timeZone, 'dd.MM.yyyy HH:mm');
}
