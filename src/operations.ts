import { adjustIsoDate } from './calendar';
import { AccountToken, DateToken } from './beancount';

export interface LocatedDate extends DateToken {
  line: number;
}

export interface LocatedAccount extends AccountToken {
  line: number;
}

export interface DateReplacement {
  target: LocatedDate;
  text: string;
}

export function normalizeDateTargets(targets: LocatedDate[]): LocatedDate[] | undefined {
  const byRange = new Map<string, LocatedDate>();
  for (const target of targets) {
    const key = rangeKey(target);
    const existing = byRange.get(key);
    if (existing && existing.part !== target.part) {
      return undefined;
    }
    byRange.set(key, existing ?? target);
  }

  const uniqueTargets = [...byRange.values()].sort(compareRanges);
  for (let index = 1; index < uniqueTargets.length; index += 1) {
    const previous = uniqueTargets[index - 1];
    const current = uniqueTargets[index];
    if (previous && current && previous.line === current.line && previous.end > current.start) {
      return undefined;
    }
  }
  return uniqueTargets;
}

export function buildDateReplacements(
  targets: LocatedDate[],
  direction: 1 | -1
): DateReplacement[] | undefined {
  const uniqueTargets = normalizeDateTargets(targets);
  if (!uniqueTargets) {
    return undefined;
  }

  const replacements: DateReplacement[] = [];
  for (const target of uniqueTargets) {
    const text = adjustIsoDate(target.text, target.part, direction);
    if (!text) {
      return undefined;
    }
    replacements.push({ target, text });
  }
  return replacements;
}

export function deduplicateAccounts(targets: LocatedAccount[]): LocatedAccount[] {
  const byRange = new Map<string, LocatedAccount>();
  for (const target of targets) {
    byRange.set(rangeKey(target), target);
  }
  return [...byRange.values()].sort(compareRanges);
}

function rangeKey(target: { line: number; start: number; end: number }): string {
  return `${target.line}:${target.start}:${target.end}`;
}

function compareRanges(
  left: { line: number; start: number },
  right: { line: number; start: number }
): number {
  return left.line - right.line || left.start - right.start;
}
