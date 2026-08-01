export const VSCODE_VIM_EXTENSION_ID = 'vscodevim.vim';

export const VIM_INCREMENT_COMMAND = 'beancountQuickEdit.vimIncrementDatePart';
export const VIM_DECREMENT_COMMAND = 'beancountQuickEdit.vimDecrementDatePart';

// Date and mode checks intentionally happen inside the command. Both VS Code
// contexts are updated asynchronously, which could otherwise make a Ctrl key
// use the wrong handler immediately after moving the cursor or changing mode.
const VIM_SHORTCUT_BASE_WHEN =
  'editorTextFocus && vim.active && editorLangId == beancount && !editorReadonly && !inDebugRepl';

export const VIM_INCREMENT_SHORTCUT_WHEN = `${VIM_SHORTCUT_BASE_WHEN} && vim.use<C-a>`;
export const VIM_DECREMENT_SHORTCUT_WHEN = `${VIM_SHORTCUT_BASE_WHEN} && vim.use<C-x>`;

interface VimRecordedStateLike {
  actionKeys: unknown;
  actionsRun: unknown;
  actionsRunPressedKeys: unknown;
  bufferedKeys: unknown;
  bufferedKeysTimeoutObj: unknown;
  commandList: unknown;
  count: unknown;
  hasRunOperator: unknown;
  isInsertion: unknown;
  operatorCount: unknown;
  operatorPositionDiff: unknown;
  registerKey: unknown;
  transformer: unknown;
  waitingForAnotherActionKey: unknown;
}

export interface VimModeHandlerLike {
  handleKeyEvent(key: string): Promise<unknown>;
  remapState: {
    isCurrentlyPerformingRemapping: unknown;
  };
  vimState: {
    currentMode: unknown;
    currentModeIncludingPseudoModes: unknown;
    isReplayingMacro: unknown;
    macro: unknown;
    normalCommandState: unknown;
    recordedState: VimRecordedStateLike;
    returnToInsertAfterCommand: unknown;
    surround: unknown;
  };
}

export function buildVimKeybindingsSnippet(): string {
  const bindings = [
    {
      key: 'ctrl+a',
      command: 'vim.remap',
      args: {
        commands: [{ command: VIM_INCREMENT_COMMAND }]
      },
      when: VIM_INCREMENT_SHORTCUT_WHEN
    },
    {
      key: 'ctrl+x',
      command: 'vim.remap',
      args: {
        commands: [{ command: VIM_DECREMENT_COMMAND }]
      },
      when: VIM_DECREMENT_SHORTCUT_WHEN
    }
  ];

  return bindings.map((binding) => JSON.stringify(binding, undefined, 2)).join(',\n');
}

export function isVimModeHandlerLike(value: unknown): value is VimModeHandlerLike {
  if (!isRecord(value) || typeof value.handleKeyEvent !== 'function') {
    return false;
  }

  const remapState = value.remapState;
  const vimState = value.vimState;
  return (
    isRecord(remapState) &&
    'isCurrentlyPerformingRemapping' in remapState &&
    isRecord(vimState) &&
    isRecord(vimState.recordedState)
  );
}

/**
 * Accept an idle Normal-mode handler or a pure numeric prefix, consume that
 * prefix exactly once, and return the calendar amount to apply. VSCodeVim has
 * no public API for this, so every inspected private state fails closed.
 */
export function consumeVimDateShortcutCount(
  handler: VimModeHandlerLike
): number | undefined {
  try {
    if (!isSafeNormalMode(handler)) {
      return undefined;
    }

    const recordedState = handler.vimState.recordedState;
    const count = readPureNumericCount(recordedState);
    if (count === undefined) {
      return undefined;
    }

    const freshState = constructPristineRecordedState(recordedState);
    if (!freshState || handler.vimState.recordedState !== recordedState) {
      return undefined;
    }

    handler.vimState.recordedState = freshState;
    return count;
  } catch {
    return undefined;
  }
}

function isSafeNormalMode(handler: VimModeHandlerLike): boolean {
  const vimState = handler.vimState;
  return (
    // Mode.Normal and NormalCommandState.Waiting are both 0 in VSCodeVim.
    vimState.currentMode === 0 &&
    vimState.currentModeIncludingPseudoModes === 0 &&
    vimState.normalCommandState === 0 &&
    vimState.isReplayingMacro === false &&
    vimState.macro === undefined &&
    vimState.returnToInsertAfterCommand === false &&
    vimState.surround === undefined &&
    handler.remapState.isCurrentlyPerformingRemapping === false
  );
}

function readPureNumericCount(recordedState: VimRecordedStateLike): number | undefined {
  if (!hasSafeCommonRecordedState(recordedState)) {
    return undefined;
  }

  const actions = recordedState.actionsRun as unknown[];
  const pressedKeys = recordedState.actionsRunPressedKeys as unknown[];
  if (recordedState.count === 0) {
    return actions.length === 0 && pressedKeys.length === 0 ? 1 : undefined;
  }

  if (
    !Number.isSafeInteger(recordedState.count) ||
    (recordedState.count as number) <= 0 ||
    pressedKeys.length === 0 ||
    actions.length !== pressedKeys.length ||
    typeof pressedKeys[0] !== 'string' ||
    !/^[1-9]$/.test(pressedKeys[0])
  ) {
    return undefined;
  }

  const digits: string[] = [];
  for (let index = 0; index < pressedKeys.length; index += 1) {
    const digit = pressedKeys[index];
    const action = actions[index];
    if (
      typeof digit !== 'string' ||
      !/^\d$/.test(digit) ||
      !isRecord(action) ||
      action.actionType !== 'number' ||
      action.name !== 'cmd_num' ||
      action.isCompleteAction !== false ||
      !Array.isArray(action.keysPressed) ||
      action.keysPressed.length !== 1 ||
      action.keysPressed[0] !== digit
    ) {
      return undefined;
    }
    digits.push(digit);
  }

  const parsed = Number(digits.join(''));
  return Number.isSafeInteger(parsed) && parsed === recordedState.count ? parsed : undefined;
}

function hasSafeCommonRecordedState(recordedState: VimRecordedStateLike): boolean {
  const transformer = recordedState.transformer;
  return (
    Array.isArray(recordedState.actionKeys) &&
    recordedState.actionKeys.length === 0 &&
    Array.isArray(recordedState.actionsRun) &&
    Array.isArray(recordedState.actionsRunPressedKeys) &&
    Array.isArray(recordedState.bufferedKeys) &&
    recordedState.bufferedKeys.length === 0 &&
    recordedState.bufferedKeysTimeoutObj === undefined &&
    Array.isArray(recordedState.commandList) &&
    recordedState.commandList.length === 0 &&
    recordedState.waitingForAnotherActionKey === false &&
    recordedState.operatorCount === 0 &&
    recordedState.hasRunOperator === false &&
    recordedState.operatorPositionDiff === undefined &&
    recordedState.isInsertion === false &&
    recordedState.registerKey === '' &&
    isRecord(transformer) &&
    Array.isArray(transformer.transformations) &&
    transformer.transformations.length === 0
  );
}

function constructPristineRecordedState(
  current: VimRecordedStateLike
): VimRecordedStateLike | undefined {
  const prototype = Object.getPrototypeOf(current) as { constructor?: unknown } | null;
  const constructor = prototype?.constructor;
  if (typeof constructor !== 'function' || constructor === Object) {
    return undefined;
  }

  const fresh = Reflect.construct(constructor, []) as unknown;
  if (!isRecord(fresh)) {
    return undefined;
  }

  const candidate = fresh as unknown as VimRecordedStateLike;
  return (
    hasSafeCommonRecordedState(candidate) &&
    candidate.count === 0 &&
    (candidate.actionsRun as unknown[]).length === 0 &&
    (candidate.actionsRunPressedKeys as unknown[]).length === 0
  )
    ? candidate
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
