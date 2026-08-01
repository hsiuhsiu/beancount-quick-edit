const assert = require('node:assert/strict');
const { describe, test } = require('node:test');
const {
  buildDateReplacements,
  deduplicateAccounts,
  normalizeDateTargets
} = require('../../lib/operations.js');

function date(overrides = {}) {
  return {
    line: 0,
    start: 0,
    end: 10,
    text: '2026-01-31',
    part: 'day',
    ...overrides
  };
}

describe('multi-cursor operations', () => {
  test('deduplicates cursors on the same date and part', () => {
    const target = date();
    assert.deepEqual(normalizeDateTargets([target, { ...target }]), [target]);
  });

  test('rejects cursors that request different parts of one date', () => {
    assert.equal(
      normalizeDateTargets([date({ part: 'year' }), date({ part: 'day' })]),
      undefined
    );
  });

  test('adjusts distinct dates atomically and in document order', () => {
    const later = date({ line: 2, text: '2024-02-29' });
    const earlier = date({ line: 0, text: '2026-01-31' });
    const replacements = buildDateReplacements([later, earlier], 1);
    assert.deepEqual(replacements?.map(({ target, text }) => [target.line, text]), [
      [0, '2026-02-01'],
      [2, '2024-03-01']
    ]);
  });

  test('applies one count-sized change to every distinct target', () => {
    const replacements = buildDateReplacements([
      date({ line: 0, text: '2026-01-30', part: 'day' }),
      date({ line: 1, text: '2024-01-31', part: 'month' }),
      date({ line: 2, text: '2024-02-29', part: 'year' })
    ], 2);

    assert.deepEqual(replacements?.map(({ text }) => text), [
      '2026-02-01',
      '2024-03-31',
      '2026-02-28'
    ]);
  });

  test('returns no replacements when any cursor would cross the year range', () => {
    assert.equal(
      buildDateReplacements([
        date(),
        date({ line: 1, text: '9999-12-31' })
      ], 1),
      undefined
    );
  });

  test('deduplicates accounts and orders clipboard entries by document position', () => {
    const first = { line: 0, start: 4, end: 15, text: 'Assets:Cash' };
    const second = { line: 2, start: 4, end: 20, text: 'Expenses:Dining' };
    assert.deepEqual(deduplicateAccounts([second, first, { ...first }]), [first, second]);
  });
});
