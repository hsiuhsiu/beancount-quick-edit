const assert = require('node:assert/strict');
const { describe, test } = require('node:test');
const {
  buildVimKeybindingsSnippet,
  canHandlePlainVimShortcut,
  isVimModeHandlerLike,
  VIM_DECREMENT_COMMAND,
  VIM_DECREMENT_SHORTCUT_WHEN,
  VIM_INCREMENT_COMMAND,
  VIM_INCREMENT_SHORTCUT_WHEN
} = require('../../lib/vscodeVim.js');

function idleHandler() {
  return {
    handleKeyEvent: async () => undefined,
    vimState: {
      currentMode: 0,
      currentModeIncludingPseudoModes: 0,
      isReplayingMacro: false,
      macro: undefined,
      recordedState: {
        actionKeys: [],
        actionsRun: [],
        bufferedKeys: [],
        bufferedKeysTimeoutObj: undefined,
        commandList: [],
        count: 0,
        waitingForAnotherActionKey: false
      },
      returnToInsertAfterCommand: false,
      surround: undefined
    }
  };
}

describe('VSCodeVim shortcut integration', () => {
  test('builds two paste-ready user keybindings without an outer array', () => {
    const bindings = JSON.parse(`[${buildVimKeybindingsSnippet()}]`);
    assert.deepEqual(
      bindings.map(({ key, command, args }) => [key, command, args.commands[0].command]),
      [
        ['ctrl+a', 'vim.remap', VIM_INCREMENT_COMMAND],
        ['ctrl+x', 'vim.remap', VIM_DECREMENT_COMMAND]
      ]
    );
    for (const when of [VIM_INCREMENT_SHORTCUT_WHEN, VIM_DECREMENT_SHORTCUT_WHEN]) {
      assert.match(when, /vim\.active/);
      assert.match(when, /vim\.mode == 'Normal'/);
      assert.match(when, /editorLangId == beancount/);
      assert.match(when, /beancountQuickEdit\.cursorInDate/);
      assert.match(when, /!editorReadonly/);
    }
    assert.match(VIM_INCREMENT_SHORTCUT_WHEN, /vim\.use<C-a>/);
    assert.match(VIM_DECREMENT_SHORTCUT_WHEN, /vim\.use<C-x>/);
  });

  test('accepts only a completely idle VSCodeVim mode handler', () => {
    const handler = idleHandler();
    assert.equal(isVimModeHandlerLike(handler), true);
    assert.equal(canHandlePlainVimShortcut(handler), true);
  });

  test('rejects counts and every represented pending-command state', () => {
    const mutations = [
      (handler) => {
        handler.vimState.recordedState.count = 3;
      },
      (handler) => {
        handler.vimState.recordedState.actionKeys = ['g'];
      },
      (handler) => {
        handler.vimState.recordedState.actionsRun = [{}];
      },
      (handler) => {
        handler.vimState.recordedState.commandList = ['g'];
      },
      (handler) => {
        handler.vimState.recordedState.bufferedKeys = ['g'];
      },
      (handler) => {
        handler.vimState.recordedState.bufferedKeysTimeoutObj = {};
      },
      (handler) => {
        handler.vimState.recordedState.waitingForAnotherActionKey = true;
      },
      (handler) => {
        handler.vimState.currentModeIncludingPseudoModes = 12;
      },
      (handler) => {
        handler.vimState.isReplayingMacro = true;
      },
      (handler) => {
        handler.vimState.macro = {};
      },
      (handler) => {
        handler.vimState.returnToInsertAfterCommand = true;
      },
      (handler) => {
        handler.vimState.surround = {};
      }
    ];

    for (const mutate of mutations) {
      const handler = idleHandler();
      mutate(handler);
      assert.equal(canHandlePlainVimShortcut(handler), false);
    }
  });

  test('fails closed if VSCodeVim changes the inspected state shape', () => {
    const handler = idleHandler();
    handler.vimState.recordedState.actionKeys = undefined;
    assert.equal(canHandlePlainVimShortcut(handler), false);
    assert.equal(isVimModeHandlerLike({ vimState: {} }), false);
  });
});
