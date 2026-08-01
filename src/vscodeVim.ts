export const VSCODE_VIM_EXTENSION_ID = 'vscodevim.vim';

export const VIM_INCREMENT_COMMAND = 'beancountQuickEdit.vimIncrementDatePart';
export const VIM_DECREMENT_COMMAND = 'beancountQuickEdit.vimDecrementDatePart';

const VIM_SHORTCUT_BASE_WHEN =
  "editorTextFocus && vim.active && vim.mode == 'Normal' && editorLangId == beancount && beancountQuickEdit.cursorInDate && !editorReadonly && !inDebugRepl";

export const VIM_INCREMENT_SHORTCUT_WHEN = `${VIM_SHORTCUT_BASE_WHEN} && vim.use<C-a>`;
export const VIM_DECREMENT_SHORTCUT_WHEN = `${VIM_SHORTCUT_BASE_WHEN} && vim.use<C-x>`;

export interface VimModeHandlerLike {
  handleKeyEvent(key: string): Promise<unknown>;
  vimState: {
    currentMode: unknown;
    currentModeIncludingPseudoModes: unknown;
    isReplayingMacro: unknown;
    macro: unknown;
    recordedState: {
      actionKeys: unknown;
      actionsRun: unknown;
      bufferedKeys: unknown;
      bufferedKeysTimeoutObj: unknown;
      commandList: unknown;
      count: unknown;
      waitingForAnotherActionKey: unknown;
    };
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

  const vimState = value.vimState;
  return isRecord(vimState) && isRecord(vimState.recordedState);
}

/**
 * VSCodeVim does not expose a documented pending-command context. Its desktop
 * extension does export the active ModeHandler, so inspect it conservatively:
 * only a completely idle state is safe for a command that bypasses Vim's key
 * handler. Any unknown or pending state must fall back to VSCodeVim.
 */
export function canHandlePlainVimShortcut(handler: VimModeHandlerLike): boolean {
  try {
    const vimState = handler.vimState;
    const recordedState = vimState.recordedState;
    const pendingArrays = [
      recordedState.actionKeys,
      recordedState.actionsRun,
      recordedState.bufferedKeys,
      recordedState.commandList
    ];

    return (
      pendingArrays.every((value) => Array.isArray(value) && value.length === 0) &&
      recordedState.count === 0 &&
      recordedState.waitingForAnotherActionKey === false &&
      recordedState.bufferedKeysTimeoutObj === undefined &&
      vimState.currentMode === vimState.currentModeIncludingPseudoModes &&
      vimState.isReplayingMacro === false &&
      vimState.macro === undefined &&
      vimState.returnToInsertAfterCommand === false &&
      vimState.surround === undefined
    );
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
