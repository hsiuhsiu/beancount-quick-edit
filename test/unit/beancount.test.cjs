const assert = require('node:assert/strict');
const { describe, test } = require('node:test');
const { performance } = require('node:perf_hooks');
const {
  findAccountAtCharacter,
  findDateAtCharacter
} = require('../../lib/beancount.js');

describe('Beancount token matching', () => {
  test('maps each caret position in an ISO date to year, month, or day', () => {
    const line = '  2026-08-31 * "Example"';
    assert.equal(findDateAtCharacter(line, 2).part, 'year');
    assert.equal(findDateAtCharacter(line, 5).part, 'year');
    assert.equal(findDateAtCharacter(line, 6).part, 'month');
    assert.equal(findDateAtCharacter(line, 8).part, 'month');
    assert.equal(findDateAtCharacter(line, 9).part, 'day');
    assert.equal(findDateAtCharacter(line, 11).part, 'day');
    assert.equal(findDateAtCharacter(line, 12), undefined);
  });

  test('rejects invalid dates and dates embedded in word-like text', () => {
    assert.equal(findDateAtCharacter('2025-02-29', 8), undefined);
    assert.equal(findDateAtCharacter('x2026-08-31', 5), undefined);
    assert.equal(findDateAtCharacter('2026-08-31x', 5), undefined);
    assert.equal(findDateAtCharacter('_2026-08-31', 5), undefined);
    assert.equal(findDateAtCharacter('𐐨2026-08-31', 5), undefined);
  });

  test('finds the date under the caret when a line contains several dates', () => {
    const line = '2026-01-01 note 2027-02-03';
    assert.equal(findDateAtCharacter(line, 2).text, '2026-01-01');
    assert.equal(findDateAtCharacter(line, 23).text, '2027-02-03');
  });

  test('matches canonical account names, including Unicode uppercase letters', () => {
    for (const account of [
      'Assets:Bank:Checking',
      'Assets:Cash-USD',
      'Assets:2026:Cash',
      'Épargne:Banque'
    ]) {
      const match = findAccountAtCharacter(`  ${account}  1 USD`, 3);
      assert.equal(match?.text, account, account);
    }
  });

  test('rejects incomplete, lowercase-root, and adjacent account-like text', () => {
    for (const line of [
      'Assets',
      'assets:Bank:Checking',
      'xAssets:Bank',
      '𐐨Assets:Bank',
      'Assets:Bank:',
      '_Assets:Bank'
    ]) {
      assert.equal(findAccountAtCharacter(line, Math.min(2, line.length - 1)), undefined, line);
    }
  });

  test('does not match when the caret is immediately after an account', () => {
    const account = 'Assets:Bank:Checking';
    assert.equal(findAccountAtCharacter(account, account.length), undefined);
  });

  test('finds an account when the caret is on a hyphen', () => {
    const account = 'Assets:Credit-Card';
    assert.equal(findAccountAtCharacter(account, account.indexOf('-'))?.text, account);
  });

  test('finds an account when the caret is on a colon', () => {
    const account = 'Assets:Bank:Checking';
    assert.equal(findAccountAtCharacter(account, account.indexOf(':'))?.text, account);
  });

  test('supports non-BMP uppercase letters and several accounts on one line', () => {
    const unicodeAccount = '𐐀ssets:Bank';
    assert.equal(findAccountAtCharacter(unicodeAccount, 0)?.text, unicodeAccount);

    const line = 'Assets:Cash  Expenses:Dining';
    assert.equal(findAccountAtCharacter(line, 2)?.text, 'Assets:Cash');
    assert.equal(findAccountAtCharacter(line, 20)?.text, 'Expenses:Dining');
  });

  test('handles a very long non-account line without quadratic scanning', () => {
    const line = 'A'.repeat(50_000);
    const startedAt = performance.now();
    assert.equal(findAccountAtCharacter(line, 25_000), undefined);
    const elapsed = performance.now() - startedAt;
    assert.ok(elapsed < 500, `long-line account check took ${elapsed.toFixed(1)} ms`);
  });
});
