const assert = require('node:assert/strict');
const { describe, test } = require('node:test');
const {
  buildVimKeybindingsSnippet,
  consumeVimDateShortcutCount,
  isVimModeHandlerLike,
  VIM_DECREMENT_COMMAND,
  VIM_DECREMENT_SHORTCUT_WHEN,
  VIM_INCREMENT_COMMAND,
  VIM_INCREMENT_SHORTCUT_WHEN
} = require('../../lib/vscodeVim.js');

class FakeRecordedState {
  constructor() {
    this.actionKeys = [];
    this.actionsRun = [];
    this.actionsRunPressedKeys = [];
    this.bufferedKeys = [];
    this.bufferedKeysTimeoutObj = undefined;
    this.commandList = [];
    this.count = 0;
    this.hasRunOperator = false;
    this.isInsertion = false;
    this.operatorCount = 0;
    this.operatorPositionDiff = undefined;
    this.registerKey = '';
    this.transformer = { transformations: [] };
    this.waitingForAnotherActionKey = false;
  }
}

function idleHandler() {
  return {
    handleKeyEvent: async () => undefined,
    remapState: {
      isCurrentlyPerformingRemapping: false
    },
    vimState: {
      currentMode: 0,
      currentModeIncludingPseudoModes: 0,
      isReplayingMacro: false,
      macro: undefined,
      normalCommandState: 0,
      recordedState: new FakeRecordedState(),
      returnToInsertAfterCommand: false,
      surround: undefined
    }
  };
}

function addCount(handler, digits) {
  const state = handler.vimState.recordedState;
  state.count = Number(digits);
  state.actionsRunPressedKeys = [...digits];
  state.actionsRun = [...digits].map((digit) => ({
    actionType: 'number',
    name: 'cmd_num',
    isCompleteAction: false,
    keysPressed: [digit]
  }));
}

describe('VSCodeVim shortcut integration', () => {
  test('builds two paste-ready user keybindings without async date or mode contexts', () => {
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
      assert.match(when, /editorLangId == beancount/);
      assert.match(when, /!editorReadonly/);
      assert.doesNotMatch(when, /vim\.mode/);
      assert.doesNotMatch(when, /cursorInDate/);
    }
    assert.match(VIM_INCREMENT_SHORTCUT_WHEN, /vim\.use<C-a>/);
    assert.match(VIM_DECREMENT_SHORTCUT_WHEN, /vim\.use<C-x>/);
  });

  test('consumes an idle command as one calendar unit', () => {
    const handler = idleHandler();
    const previous = handler.vimState.recordedState;
    assert.equal(isVimModeHandlerLike(handler), true);
    assert.equal(consumeVimDateShortcutCount(handler), 1);
    assert.notEqual(handler.vimState.recordedState, previous);
    assert.equal(handler.vimState.recordedState.count, 0);
  });

  test('consumes a pure multi-digit count and resets the complete recorded state', () => {
    const handler = idleHandler();
    addCount(handler, '37');
    const previous = handler.vimState.recordedState;

    assert.equal(consumeVimDateShortcutCount(handler), 37);
    assert.notEqual(handler.vimState.recordedState, previous);
    assert.deepEqual(handler.vimState.recordedState.actionKeys, []);
    assert.deepEqual(handler.vimState.recordedState.actionsRun, []);
    assert.deepEqual(handler.vimState.recordedState.actionsRunPressedKeys, []);
    assert.deepEqual(handler.vimState.recordedState.bufferedKeys, []);
    assert.deepEqual(handler.vimState.recordedState.commandList, []);
    assert.equal(handler.vimState.recordedState.count, 0);
  });

  test('rejects every represented pending, non-normal, or malformed count state', () => {
    const mutations = [
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
        handler.vimState.recordedState.operatorCount = 2;
      },
      (handler) => {
        handler.vimState.recordedState.hasRunOperator = true;
      },
      (handler) => {
        handler.vimState.recordedState.transformer.transformations.push({});
      },
      (handler) => {
        handler.vimState.currentMode = 1;
      },
      (handler) => {
        handler.vimState.currentModeIncludingPseudoModes = 12;
      },
      (handler) => {
        handler.vimState.normalCommandState = 1;
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
      },
      (handler) => {
        handler.remapState.isCurrentlyPerformingRemapping = true;
      },
      (handler) => {
        addCount(handler, '3');
        handler.vimState.recordedState.actionsRun[0].name = 'not_a_number';
      },
      (handler) => {
        addCount(handler, '03');
      },
      (handler) => {
        addCount(handler, '3');
        handler.vimState.recordedState.count = Number.MAX_SAFE_INTEGER + 1;
      }
    ];

    for (const mutate of mutations) {
      const handler = idleHandler();
      mutate(handler);
      const previous = handler.vimState.recordedState;
      assert.equal(consumeVimDateShortcutCount(handler), undefined);
      assert.equal(handler.vimState.recordedState, previous);
    }
  });

  test('fails closed if VSCodeVim changes an inspected state shape', () => {
    const handler = idleHandler();
    handler.vimState.recordedState.actionKeys = undefined;
    assert.equal(consumeVimDateShortcutCount(handler), undefined);
    assert.equal(isVimModeHandlerLike({ vimState: {} }), false);
  });
});
