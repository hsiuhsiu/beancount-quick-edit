export type DatePart = 'year' | 'month' | 'day';

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const MIN_YEAR = 1;
const MAX_YEAR = 9999;

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
  direction: 1 | -1
): CalendarDate | undefined {
  if (!isValidCalendarDate(date)) {
    return undefined;
  }

  if (part === 'day') {
    return adjustDay(date, direction);
  }
  if (part === 'month') {
    return adjustMonth(date, direction);
  }
  return adjustYear(date, direction);
}

export function adjustIsoDate(
  value: string,
  part: DatePart,
  direction: 1 | -1
): string | undefined {
  const date = parseIsoDate(value);
  if (!date) {
    return undefined;
  }
  const adjusted = adjustCalendarDate(date, part, direction);
  return adjusted ? formatIsoDate(adjusted) : undefined;
}

function adjustDay(date: CalendarDate, direction: 1 | -1): CalendarDate | undefined {
  let { year, month, day } = date;
  day += direction;

  if (direction === 1 && day > daysInMonth(year, month)) {
    day = 1;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  } else if (direction === -1 && day < 1) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    if (year >= MIN_YEAR) {
      day = daysInMonth(year, month);
    }
  }

  const result = { year, month, day };
  return isValidCalendarDate(result) ? result : undefined;
}

function adjustMonth(date: CalendarDate, direction: 1 | -1): CalendarDate | undefined {
  let { year, month } = date;
  month += direction;

  if (month > 12) {
    month = 1;
    year += 1;
  } else if (month < 1) {
    month = 12;
    year -= 1;
  }

  if (year < MIN_YEAR || year > MAX_YEAR) {
    return undefined;
  }

  return {
    year,
    month,
    day: Math.min(date.day, daysInMonth(year, month))
  };
}

function adjustYear(date: CalendarDate, direction: 1 | -1): CalendarDate | undefined {
  const year = date.year + direction;
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return undefined;
  }

  return {
    year,
    month: date.month,
    day: Math.min(date.day, daysInMonth(year, date.month))
  };
}
