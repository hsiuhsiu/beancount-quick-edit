export type DatePart = 'year' | 'month' | 'day';

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const MIN_YEAR = 1;
const MAX_YEAR = 9999;
const DAYS_BEFORE_MONTH = [0, 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidCalendarDate(date: CalendarDate): boolean {
  return (
    Number.isInteger(date.year) &&
    Number.isInteger(date.month) &&
    Number.isInteger(date.day) &&
    date.year >= MIN_YEAR &&
    date.year <= MAX_YEAR &&
    date.month >= 1 &&
    date.month <= 12 &&
    date.day >= 1 &&
    date.day <= daysInMonth(date.year, date.month)
  );
}

export function parseIsoDate(value: string): CalendarDate | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }

  const date: CalendarDate = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
  return isValidCalendarDate(date) ? date : undefined;
}

export function formatIsoDate(date: CalendarDate): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export function adjustCalendarDate(
  date: CalendarDate,
  part: DatePart,
  amount: number
): CalendarDate | undefined {
  if (!isValidCalendarDate(date) || !Number.isSafeInteger(amount)) {
    return undefined;
  }

  if (part === 'day') {
    return adjustDay(date, amount);
  }
  if (part === 'month') {
    return adjustMonth(date, amount);
  }
  if (part === 'year') {
    return adjustYear(date, amount);
  }
  return undefined;
}

export function adjustIsoDate(
  value: string,
  part: DatePart,
  amount: number
): string | undefined {
  const date = parseIsoDate(value);
  if (!date) {
    return undefined;
  }
  const adjusted = adjustCalendarDate(date, part, amount);
  return adjusted ? formatIsoDate(adjusted) : undefined;
}

function adjustDay(date: CalendarDate, amount: number): CalendarDate | undefined {
  const ordinal = dateToOrdinal(date) + amount;
  const maximumOrdinal = daysBeforeYear(MAX_YEAR + 1) - 1;
  return Number.isSafeInteger(ordinal) && ordinal >= 0 && ordinal <= maximumOrdinal
    ? ordinalToDate(ordinal)
    : undefined;
}

function adjustMonth(date: CalendarDate, amount: number): CalendarDate | undefined {
  const monthIndex = (date.year - 1) * 12 + date.month - 1 + amount;
  const maximumMonthIndex = MAX_YEAR * 12 - 1;
  if (
    !Number.isSafeInteger(monthIndex) ||
    monthIndex < 0 ||
    monthIndex > maximumMonthIndex
  ) {
    return undefined;
  }

  const year = Math.floor(monthIndex / 12) + 1;
  const month = (monthIndex % 12) + 1;
  return {
    year,
    month,
    day: Math.min(date.day, daysInMonth(year, month))
  };
}

function adjustYear(date: CalendarDate, amount: number): CalendarDate | undefined {
  const year = date.year + amount;
  if (!Number.isSafeInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return undefined;
  }

  return {
    year,
    month: date.month,
    day: Math.min(date.day, daysInMonth(year, date.month))
  };
}

function dateToOrdinal(date: CalendarDate): number {
  return (
    daysBeforeYear(date.year) +
    (DAYS_BEFORE_MONTH[date.month] ?? 0) +
    (date.month > 2 && isLeapYear(date.year) ? 1 : 0) +
    date.day -
    1
  );
}

function ordinalToDate(ordinal: number): CalendarDate {
  let lowerYear = MIN_YEAR;
  let upperYear = MAX_YEAR;
  while (lowerYear < upperYear) {
    const candidate = Math.ceil((lowerYear + upperYear) / 2);
    if (daysBeforeYear(candidate) <= ordinal) {
      lowerYear = candidate;
    } else {
      upperYear = candidate - 1;
    }
  }

  const year = lowerYear;
  const dayOfYear = ordinal - daysBeforeYear(year);
  let month = 12;
  while (month > 1 && daysBeforeMonth(year, month) > dayOfYear) {
    month -= 1;
  }

  return {
    year,
    month,
    day: dayOfYear - daysBeforeMonth(year, month) + 1
  };
}

function daysBeforeYear(year: number): number {
  const completedYears = year - 1;
  return (
    completedYears * 365 +
    Math.floor(completedYears / 4) -
    Math.floor(completedYears / 100) +
    Math.floor(completedYears / 400)
  );
}

function daysBeforeMonth(year: number, month: number): number {
  return (DAYS_BEFORE_MONTH[month] ?? 0) + (month > 2 && isLeapYear(year) ? 1 : 0);
}
