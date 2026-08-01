const assert = require('node:assert/strict');
const { describe, test } = require('node:test');
const manifest = require('../../package.json');

describe('extension manifest', () => {
  test('uses the 0.3.0 minor version for count-aware VSCodeVim shortcuts', () => {
    assert.equal(manifest.version, '0.3.0');
  });

  test('ships no runtime dependencies or install lifecycle scripts', () => {
    assert.equal(manifest.dependencies, undefined);
    assert.equal(manifest.scripts.preinstall, undefined);
    assert.equal(manifest.scripts.install, undefined);
    assert.equal(manifest.scripts.postinstall, undefined);
  });

  test('scopes date shortcuts to valid Beancount date contexts', () => {
    const dateBindings = manifest.contributes.keybindings.filter((binding) =>
      binding.command.startsWith('beancountQuickEdit.') &&
      binding.command.endsWith('DatePart')
    );
    assert.equal(dateBindings.length, 2);
    for (const binding of dateBindings) {
      assert.match(binding.when, /editorLangId == beancount/);
      assert.match(binding.when, /beancountQuickEdit\.cursorInDate/);
      assert.match(binding.when, /!editorReadonly/);
    }
  });

  test('declares account copying and constrained workspace capabilities', () => {
    const accountBinding = manifest.contributes.keybindings.find(
      (binding) => binding.command === 'beancountQuickEdit.copyAccount'
    );
    assert.equal(accountBinding.mac, 'cmd+alt+c');
    assert.match(accountBinding.when, /beancountQuickEdit\.cursorInAccount/);
    assert.equal(manifest.capabilities.untrustedWorkspaces.supported, true);
    assert.equal(manifest.capabilities.virtualWorkspaces, true);
  });

  test('exposes opt-in VSCodeVim commands without unreliable default Ctrl bindings', () => {
    const commandIds = manifest.contributes.commands.map(({ command }) => command);
    assert.ok(commandIds.includes('beancountQuickEdit.vimIncrementDatePart'));
    assert.ok(commandIds.includes('beancountQuickEdit.vimDecrementDatePart'));
    assert.ok(commandIds.includes('beancountQuickEdit.setupVscodeVimShortcuts'));

    const ctrlBindings = manifest.contributes.keybindings.filter(({ key }) =>
      ['ctrl+a', 'ctrl+x'].includes(key)
    );
    assert.deepEqual(ctrlBindings, []);

    const vimCommands = manifest.contributes.commands.filter(({ command }) =>
      ['beancountQuickEdit.vimIncrementDatePart', 'beancountQuickEdit.vimDecrementDatePart'].includes(
        command
      )
    );
    for (const { enablement } of vimCommands) {
      assert.match(enablement, /editorLangId == beancount/);
      assert.match(enablement, /vim\.active/);
      assert.doesNotMatch(enablement, /cursorInDate/);
      assert.doesNotMatch(enablement, /vim\.mode/);
    }
  });
});
