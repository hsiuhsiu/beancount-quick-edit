import { DatePart, parseIsoDate } from './calendar';

export interface DateToken {
  start: number;
  end: number;
  text: string;
  part: DatePart;
}

export interface AccountToken {
  start: number;
  end: number;
  text: string;
}

const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/g;
const ACCOUNT_CANDIDATE_CHARACTER = /[\p{L}\p{N}_:-]/u;
const ROOT_ACCOUNT_COMPONENT = /^\p{Lu}[\p{L}\p{Nd}-]*$/u;
const CHILD_ACCOUNT_COMPONENT = /^[\p{Lu}\p{Nd}][\p{L}\p{Nd}-]*$/u;
const ADJACENT_WORD_CHARACTER = /[\p{L}\p{N}_]/u;
const ADJACENT_ACCOUNT_CHARACTER = /[\p{L}\p{N}_:-]/u;

export function findDateAtCharacter(line: string, character: number): DateToken | undefined {
  DATE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = DATE_PATTERN.exec(line)) !== null) {
    const text = match[0];
    const start = match.index;
    const end = start + text.length;

    if (!hasCleanBoundary(line, start, end, ADJACENT_WORD_CHARACTER)) {
      continue;
    }
    if (character < start || character >= end || !parseIsoDate(text)) {
      continue;
    }

    const relative = character - start;
    const part: DatePart = relative < 4 ? 'year' : relative < 7 ? 'month' : 'day';
    return { start, end, text, part };
  }

  return undefined;
}

export function findAccountAtCharacter(line: string, character: number): AccountToken | undefined {
  const current = unicodeCharacterAt(line, character);
  if (!current || !ACCOUNT_CANDIDATE_CHARACTER.test(current)) {
    return undefined;
  }

  let start = character;
  let before = unicodeCharacterBefore(line, start);
  while (before && ACCOUNT_CANDIDATE_CHARACTER.test(before)) {
    start -= before.length;
    before = unicodeCharacterBefore(line, start);
  }

  let end = character + current.length;
  let after = unicodeCharacterAt(line, end);
  while (after && ACCOUNT_CANDIDATE_CHARACTER.test(after)) {
    end += after.length;
    after = unicodeCharacterAt(line, end);
  }

  const text = line.slice(start, end);
  return isCanonicalAccount(text) &&
    hasCleanBoundary(line, start, end, ADJACENT_ACCOUNT_CHARACTER)
    ? { start, end, text }
    : undefined;
}

function isCanonicalAccount(value: string): boolean {
  const [root, ...children] = value.split(':');
  return Boolean(
    root &&
    children.length > 0 &&
    ROOT_ACCOUNT_COMPONENT.test(root) &&
    children.every((component) => CHILD_ACCOUNT_COMPONENT.test(component))
  );
}

function hasCleanBoundary(
  line: string,
  start: number,
  end: number,
  forbidden: RegExp
): boolean {
  const before = unicodeCharacterBefore(line, start);
  const after = unicodeCharacterAt(line, end);
  return !(before && forbidden.test(before)) && !(after && forbidden.test(after));
}

function unicodeCharacterBefore(value: string, index: number): string | undefined {
  if (index <= 0) {
    return undefined;
  }

  let start = index - 1;
  const finalCodeUnit = value.charCodeAt(start);
  if (finalCodeUnit >= 0xdc00 && finalCodeUnit <= 0xdfff && start > 0) {
    const precedingCodeUnit = value.charCodeAt(start - 1);
    if (precedingCodeUnit >= 0xd800 && precedingCodeUnit <= 0xdbff) {
      start -= 1;
    }
  }
  return value.slice(start, index);
}

function unicodeCharacterAt(value: string, index: number): string | undefined {
  if (index < 0 || index >= value.length) {
    return undefined;
  }
  const codePoint = value.codePointAt(index);
  return codePoint === undefined ? undefined : String.fromCodePoint(codePoint);
}
