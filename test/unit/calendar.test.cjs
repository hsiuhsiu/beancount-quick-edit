const assert = require('node:assert/strict');
const { describe, test } = require('node:test');
const {
  adjustIsoDate,
  daysInMonth,
  formatIsoDate,
  isLeapYear,
  parseIsoDate
} = require('../../lib/calendar.js');

describe('calendar', () => {
  test('uses Gregorian leap-year rules', () => {
    assert.equal(isLeapYear(2000), true);
    assert.equal(isLeapYear(2024), true);
    assert.equal(isLeapYear(1900), false);
    assert.equal(isLeapYear(2100), false);
    assert.equal(daysInMonth(2024, 2), 29);
    assert.equal(daysInMonth(2025, 2), 28);
  });

  test('accepts only valid, fixed-width dates in years 0001–9999', () => {
    assert.deepEqual(parseIsoDate('0001-01-01'), { year: 1, month: 1, day: 1 });
    assert.deepEqual(parseIsoDate('9999-12-31'), { year: 9999, month: 12, day: 31 });
    for (const invalid of [
      '0000-01-01',
      '10000-01-01',
      '2026-1-01',
      '2026-01-1',
      '2025-02-29',
      '2026-04-31',
      '2026-13-01'
    ]) {
      assert.equal(parseIsoDate(invalid), undefined, invalid);
    }
  });

  test('formats a date with leading zeroes', () => {
    assert.equal(formatIsoDate({ year: 7, month: 3, day: 9 }), '0007-03-09');
  });

  test('increments and decrements days across month and year boundaries', () => {
    assert.equal(adjustIsoDate('2024-02-28', 'day', 1), '2024-02-29');
    assert.equal(adjustIsoDate('2024-02-29', 'day', 1), '2024-03-01');
    assert.equal(adjustIsoDate('2026-01-01', 'day', -1), '2025-12-31');
    assert.equal(adjustIsoDate('2026-12-31', 'day', 1), '2027-01-01');
  });

  test('clamps the day when changing month or year', () => {
    assert.equal(adjustIsoDate('2024-01-31', 'month', 1), '2024-02-29');
    assert.equal(adjustIsoDate('2025-03-31', 'month', -1), '2025-02-28');
    assert.equal(adjustIsoDate('2024-02-29', 'year', 1), '2025-02-28');
    assert.equal(adjustIsoDate('2024-02-29', 'year', -1), '2023-02-28');
  });

  test('does not cross the supported year range', () => {
    assert.equal(adjustIsoDate('0001-01-01', 'day', -1), undefined);
    assert.equal(adjustIsoDate('0001-01-31', 'month', -1), undefined);
    assert.equal(adjustIsoDate('0001-06-01', 'year', -1), undefined);
    assert.equal(adjustIsoDate('9999-12-31', 'day', 1), undefined);
    assert.equal(adjustIsoDate('9999-12-01', 'month', 1), undefined);
    assert.equal(adjustIsoDate('9999-06-01', 'year', 1), undefined);
  });
});
