import { Duration, isToday, isYesterday, intervalToDuration } from 'date-fns';
import memoize from 'fast-memoize';
import { AppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';

const logger = new Logger('date');

export interface DateOptions {
  weekday?: 'long' | 'short' | 'narrow';
  year?: 'numeric' | '2-digit';
  month?: 'long' | 'short' | 'narrow' | 'numeric' | '2-digit';
  day?: 'numeric' | '2-digit';
}

const DEFAULT_DATE_OPTIONS: DateOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

// TODO: use date-fns
const formatDateUnmemoized = (
  dateStr: string,
  locale?: string,
  dateOptions?: DateOptions,
  todayText?: string,
  yesterdayText?: string
) => {
  const options = dateOptions || DEFAULT_DATE_OPTIONS;
  const dateString = new Date(dateStr).toLocaleDateString(locale, options);

  // Get yesterday by subtracting 1 from the date, not by subtracting the number
  // of milliseconds in a typical day -- not all days are exactly 86400000ms.
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayString = yesterday.toLocaleDateString(locale, options);

  if (dateString === yesterdayString) {
    return yesterdayText || 'Yesterday';
  }
  if (dateString === new Date().toLocaleDateString(locale, options)) {
    return todayText || 'Today';
  }
  return dateString;
};

/** @deprecated */
export const formatDate = memoize(formatDateUnmemoized);

/** Difference between system clock and app clock */
let clockSkewMilliseconds = 0;

/** Set the clock skew in milliseconds */
export function setClockSkewMilliseconds(milliseconds: number) {
  clockSkewMilliseconds = milliseconds;
  return getClockSkewMilliseconds();
}

/** Get the clock offset in microseconds */
export function getClockSkewMilliseconds() {
  return clockSkewMilliseconds;
}

/** Skew milliseconds, and return as milliseconds */
export function skewMilliseconds(ms: number): number {
  return ms + getClockSkewMilliseconds();
}

export function skewNow() {
  return skewMilliseconds(Date.now());
}

const ZERO_DURATION: Duration = {
  days: 0,
  hours: 0,
  minutes: 0,
  months: 0,
  seconds: 0,
  years: 0,
};

export function millisecondsToDuration(ms: number): Duration {
  try {
    return intervalToDuration({ start: 0, end: ms });
  } catch (err) {
    // intervalToDuration throws a RangeError if ms is invalid
    logger.error(err);
    return { ...ZERO_DURATION };
  }
}

type GetDurationOptions = {
  showHour?: boolean;
  showMinute?: boolean;
  showSecond?: boolean;
};

export function toDurationString(
  durationMs: number,
  { showHour = true, showMinute = true, showSecond = true }: GetDurationOptions = {}
) {
  const { hours, minutes, seconds } = millisecondsToDuration(durationMs);

  const hoursString = showHour
    ? String(hours).padStart(2, '0') + (showMinute && showSecond ? ':' : '')
    : '';
  const minutesString = showMinute
    ? String(minutes).padStart(2, '0') + (showSecond ? ':' : '')
    : '';
  const secondsString = showSecond ? String(seconds).padStart(2, '0') : '';

  return `${hoursString}${minutesString}${secondsString}`;
}

type IntlTimeUnit = 'millisecond' | 'second' | 'minute' | 'hour' | 'day';
export type TimeUnit = IntlTimeUnit | 'microsecond';

export const MILLISECONDS_PER_MICROSECOND = 1 / 1000;
export const MILLISECONDS_PER_SECOND = 1000;
export const MILLISECONDS_PER_MINUTE = MILLISECONDS_PER_SECOND * 60;
export const MILLISECONDS_PER_HOUR = MILLISECONDS_PER_MINUTE * 60;
export const MILLISECONDS_PER_DAY = MILLISECONDS_PER_HOUR * 24;
export const MILLISECONDS_PER_YEAR = MILLISECONDS_PER_DAY * 365;

// Other date conversions are provided by date-fns

export function microsecondsToMilliseconds(micro: number) {
  return micro * MILLISECONDS_PER_MICROSECOND;
}

export function millisecondsToMicroseconds(ms: number) {
  return ms / MILLISECONDS_PER_MICROSECOND;
}

/**
 * Returns the appropriate hourCycle value based on 12/24 hour format preference
 * @param use12HourFormat Boolean indicating whether 12-hour format is desired
 * @returns 'h12' for 12-hour format or 'h23' for 24-hour format
 */
export function getHourCycle(use12HourFormat: boolean): 'h12' | 'h23' {
  return use12HourFormat ? 'h12' : 'h23';
}

export function daysToMilliseconds(days: number) {
  return days * MILLISECONDS_PER_DAY;
}

export interface RelativeTime {
  amount: number;
  unit: TimeUnit;
}

interface FormatRelativeTimeOptions {
  unit?: TimeUnit;
  roundingFunc: (x: number) => number;
}

/**
 * Given milliseconds, returns a relatively formatted object with an amount and unit.
 * Combine these two to get a formatted string, such as 20s, 2m, 3h, 300D.
 * We use Math.ceil so that if we convert to days (or similar), it shows as 1 day instead
 * of 0 days.
 * For durations < 120 seconds: display in seconds (except exact minutes)
 * For non-exact multiples >= 120 seconds but < 2 hours: round down to minutes
 * For exact multiples <= 2 hours: use the largest appropriate unit
 * For durations > 2 hours: round down to hours
 * For durations >= 24 hours: round down to days
 * @param ms Input milliseconds
 * @param options Optional FormatRelativeTimeOptions including a time unit to convert to,
 * overriding the default cutoffs. Also includes an optional roundingFunc to be applied when
 * converting units and rounding. Default is Math.floor.
 */
export const formatRelativeTime = (
  ms: number,
  { unit, roundingFunc = Math.floor }: FormatRelativeTimeOptions = { roundingFunc: Math.floor }
): RelativeTime => {
  // Special case for all durations less than 2 hours
  if (!unit && ms < MILLISECONDS_PER_HOUR * 2) {
    if (ms >= MILLISECONDS_PER_SECOND * 120 && ms % MILLISECONDS_PER_MINUTE !== 0) {
      return { amount: roundingFunc(ms / MILLISECONDS_PER_MINUTE), unit: 'minute' };
    } else {
      return formatToNearestRelativeTime(ms);
    }
  }
  // otherwise keep doing what it was originally doing which is rounding down
  else if ((!unit && ms < MILLISECONDS_PER_MINUTE) || unit === 'second') {
    // Show seconds if less than 60
    return { amount: Math.max(0, Math.ceil(ms / MILLISECONDS_PER_SECOND)), unit: 'second' };
  } else if ((!unit && ms < MILLISECONDS_PER_HOUR) || unit === 'minute') {
    // Show minutes if less than 60 (1 hour)
    return { amount: roundingFunc(ms / MILLISECONDS_PER_MINUTE), unit: 'minute' };
  } else if ((!unit && ms < MILLISECONDS_PER_DAY) || unit === 'hour') {
    // Show hours if less than 24 hours (1 day)
    return { amount: roundingFunc(ms / MILLISECONDS_PER_HOUR), unit: 'hour' };
  } else {
    // Otherwise, show days
    return { amount: roundingFunc(ms / MILLISECONDS_PER_DAY), unit: 'day' };
  }
};

/**
 * Given milliseconds, returns a relatively formatted object with an amount and unit.
 * Uses the largest time denomination that can display the value in whole units.
 * For example: 120 seconds = 2 minutes, 121 seconds = 121 seconds
 * @param ms Input milliseconds
 * @param options Optional FormatRelativeTimeOptions including a roundingFunc to be applied when
 * converting units. Default is Math.ceil.
 */
export const formatToNearestRelativeTime = (
  ms: number,
  { roundingFunc = Math.ceil }: FormatRelativeTimeOptions = {
    roundingFunc: Math.ceil,
  }
): RelativeTime => {
  // Try each unit from largest to smallest to find the optimal one
  if (ms % MILLISECONDS_PER_DAY === 0 && ms >= MILLISECONDS_PER_DAY) {
    return { amount: ms / MILLISECONDS_PER_DAY, unit: 'day' };
  } else if (ms % MILLISECONDS_PER_HOUR === 0 && ms >= MILLISECONDS_PER_HOUR) {
    return { amount: ms / MILLISECONDS_PER_HOUR, unit: 'hour' };
  } else if (ms % MILLISECONDS_PER_MINUTE === 0 && ms >= MILLISECONDS_PER_MINUTE) {
    return { amount: ms / MILLISECONDS_PER_MINUTE, unit: 'minute' };
  } else {
    // Default to seconds for any other value
    return { amount: Math.max(0, roundingFunc(ms / MILLISECONDS_PER_SECOND)), unit: 'second' };
  }
};

/**
 * Given milliseconds, return a date label of 'Today', 'Yesterday' or current date
 */
export const formatRelativeDate = (ms: number, t: AppTranslation): string => {
  let dateLabel = '';
  if (isToday(ms)) {
    dateLabel = t('Conversations.Today');
  } else if (isYesterday(ms)) {
    dateLabel = t('Conversations.Yesterday');
  } else {
    dateLabel = t('Intl.DateTime', {
      val: new Date(ms),
      formatParams: {
        val: { year: 'numeric', month: 'long', day: 'numeric' },
      },
    });
  }
  return dateLabel;
};

/**
 * Same as format relative date except time is included too, i.e Today, 1:51 PM
 */
export const formatRelativeDateWithTime = (ms: number, t: AppTranslation): string => {
  const time = t('Intl.DateTime', {
    val: new Date(ms),
    formatParams: {
      val: { hour: 'numeric', minute: 'numeric' },
    },
  });
  return `${formatRelativeDate(ms, t)}, ${time}`;
};

/**
 * Given a timestamp, return the date with a specific format for the month
 *
 * Examples (month format):
 *
 * numeric -> 1/3/2024
 *
 * long -> January 3, 2024
 *
 * short -> Jan 3, 2024
 *
 */
export const formatTimestampToDate = (
  timestamp: number,
  monthFormat: Intl.DateTimeFormatOptions['month'],
  t: AppTranslation
) => {
  return t('Intl.DateTime', {
    val: new Date(timestamp),
    formatParams: {
      val: {
        year: 'numeric',
        month: monthFormat,
        day: 'numeric',
      },
    },
  });
};

/** Default expiration timer options in milliseconds
 * for rooms, DMs, and groups. */
export const EXPIRATION_TIME_OPTIONS: number[] = [
  MILLISECONDS_PER_HOUR * 8,
  MILLISECONDS_PER_DAY,
  MILLISECONDS_PER_DAY * 30,
  MILLISECONDS_PER_DAY * 180,
  MILLISECONDS_PER_YEAR,
];

/** Default burn on read timer options in milliseconds
 * for rooms. */
export const BOR_TIME_OPTIONS_ROOM: number[] = [
  MILLISECONDS_PER_SECOND * 5,
  MILLISECONDS_PER_MINUTE,
  MILLISECONDS_PER_MINUTE * 30,
  MILLISECONDS_PER_HOUR * 8,
];

/** Default burn on read timer options in milliseconds
 * for DMs and groups. */
export const BOR_TIME_OPTIONS: number[] = [
  MILLISECONDS_PER_SECOND * 5,
  MILLISECONDS_PER_MINUTE,
  MILLISECONDS_PER_MINUTE * 30,
  MILLISECONDS_PER_DAY,
  MILLISECONDS_PER_YEAR,
];

/**
 * Converts an amount of time of a specific unit (such as 30 days) into milliseconds.
 * We use Math.ceil so that if we convert to days (or similar), it shows as 1 day instead
 * of 0 days.
 * @param amount Amount of time in a given unit
 * @param unit The unit of time that the given amount is in
 * @returns The input amount converted into milliseconds.
 */
export const formatRelativeTimeToMs = (
  amount: number,
  unit: TimeUnit,
  roundingFunc: (x: number) => number = Math.floor
): number => {
  if (unit === 'millisecond') {
    return amount;
  } else if (unit === 'microsecond') {
    return roundingFunc(microsecondsToMilliseconds(amount));
  } else if (unit === 'second') {
    return roundingFunc(amount * MILLISECONDS_PER_SECOND);
  } else if (unit === 'minute') {
    return roundingFunc(amount * MILLISECONDS_PER_MINUTE);
  } else if (unit === 'hour') {
    return roundingFunc(amount * MILLISECONDS_PER_HOUR);
  } else {
    return roundingFunc(amount * MILLISECONDS_PER_DAY);
  }
};

export const formatTimestamp = (date: number, t: AppTranslation, use12HourFormat: boolean) => {
  const hourCycle = getHourCycle(use12HourFormat);
  let formattedTimestamp = '';
  if (isToday(date)) {
    formattedTimestamp = t('Intl.DateTime', {
      val: new Date(date),
      formatParams: {
        val: { hour: 'numeric', minute: 'numeric', hourCycle: hourCycle },
      },
    });
  } else if (isYesterday(date)) {
    formattedTimestamp = t('Conversations.Yesterday');
  } else {
    formattedTimestamp = t('Intl.DateTime', {
      val: new Date(date),
      formatParams: {
        val: { year: '2-digit', month: 'numeric', day: 'numeric' },
      },
    });
  }
  return formattedTimestamp;
};

/**
 * This helper functions takes a timestamp in milliseconds and converts it to
 * a time format like: "08/31 11:07 PM" or "08/31 15:07"
 * @param timestamp milliseconds epoch time
 * @param use12HourFormat
 * @returns string
 */
export const formatTimestampDateAndTime = (
  timestamp: number,
  use12HourFormat = true,
  monthFormat?: Intl.DateTimeFormatOptions['month']
) => {
  const hourCycle = getHourCycle(use12HourFormat);
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    month: monthFormat ?? '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: hourCycle,
  })
    .format(date)
    .replace(',', '');
};

/**
 * Converts microseconds or milliseconds to a localized date string
 * Automatically detects the unit based on the number of digits in the unix timestamp
 * @param timestamp The unix timestamp (microseconds or milliseconds)
 * @param locale Optional locale string (defaults to browser locale)
 * @param options Optional Intl.DateTimeFormatOptions for custom formatting
 * @returns Localized date string
 */
export const timeToLocaleString = (
  timestamp: number,
  options?: Intl.DateTimeFormatOptions
): string => {
  const digitCount = Math.floor(Math.log10(timestamp)) + 1;
  const isMicrosecond = digitCount >= 15;
  // Convert to milliseconds if needed
  const milliseconds = isMicrosecond ? microsecondsToMilliseconds(timestamp) : timestamp;
  // Create Date object
  const date = new Date(milliseconds);

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  };

  const formatOptions = options || defaultOptions;

  return date.toLocaleString(undefined, formatOptions);
};

export const formatTimestampToReadableDate = (timestamp: number, t: AppTranslation) => {
  const date = new Date(timestamp);
  const formattedDate = t('Intl.DateTime', {
    val: date,
    formatParams: { val: { month: 'short', day: 'numeric' } },
  });
  const formattedTime = t('Intl.DateTime', {
    val: date,
    formatParams: { val: { hour: '2-digit', minute: '2-digit' } },
  });

  return `${formattedDate} - ${formattedTime}`;
};

/**
 * Formats a date as YYYY-MM-DD
 * @param date The date to format
 * @returns A string in the format YYYY-MM-DD
 */
export const formatDateYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};
