import * as assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as vscode from 'vscode';

interface VSCodeVimModeHandler {
  handleKeyEvent(key: string): Promise<unknown>;
  vimState: {
    recordedState: {
      count: number;
    };
  };
}

interface VSCodeVimModule {
  getAndUpdateModeHandler(forceSyncAndUpdate?: boolean): Promise<VSCodeVimModeHandler | undefined>;
}

suite('Beancount Quick Edit with VSCodeVim 1.32.4', () => {
  test('uses calendar arithmetic for plain idle Ctrl+A/X commands', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'beancount',
      content: '2026-01-31 * "Calendar"\n'
    });
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(0, 9, 0, 9);
    await getModeHandler(true);

    await executeVimRemap('beancountQuickEdit.vimIncrementDatePart');
    await waitFor(() => document.lineAt(0).text === '2026-02-01 * "Calendar"');

    assert.equal(document.lineAt(0).text, '2026-02-01 * "Calendar"');
    assert.equal(editor.selection.active.character, 9);

    await executeVimRemap('beancountQuickEdit.vimDecrementDatePart');
    await waitFor(() => document.lineAt(0).text === '2026-01-31 * "Calendar"');

    assert.equal(document.lineAt(0).text, '2026-01-31 * "Calendar"');
    assert.equal(editor.selection.active.character, 9);
  });

  test('delegates a pending Vim count and leaves the next motion clean', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'beancount',
      content: '2026-04-16 * "Count"\n2026-04-17 * "Next"\n'
    });
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(0, 8, 0, 8);
    const modeHandler = await getModeHandler(true);

    // Queue both commands exactly as the user keybindings do. VSCodeVim's
    // `type` handler must process the count before its `vim.remap` handler
    // invokes Beancount Quick Edit.
    await vscode.commands.executeCommand('type', { text: '3' });
    await executeVimRemap('beancountQuickEdit.vimIncrementDatePart');
    await waitFor(
      () =>
        document.lineAt(0).text === '2026-04-13 * "Count"' &&
        modeHandler.vimState.recordedState.count === 0
    );
    // VSCodeVim parses the second date hyphen as a minus sign, so its native
    // count behavior changes -16 by +3 to -13. The important contract here is
    // that the pending count is handled by Vim rather than retained.
    assert.equal(document.lineAt(0).text, '2026-04-13 * "Count"');
    assert.equal(modeHandler.vimState.recordedState.count, 0);

    await vscode.commands.executeCommand('type', { text: 'j' });
    await waitFor(() => editor.selection.active.line === 1);
    assert.equal(editor.selection.active.line, 1);
  });

  test('setup copies paste-ready Ctrl+A/X bindings', async () => {
    const previousClipboard = await vscode.env.clipboard.readText();
    try {
      await vscode.commands.executeCommand('beancountQuickEdit.setupVscodeVimShortcuts');
      const bindings = JSON.parse(`[${await vscode.env.clipboard.readText()}]`);
      assert.deepEqual(
        bindings.map(
          ({ key, command, args }: VimKeybinding) => [
            key,
            command,
            args.commands[0]?.command
          ]
        ),
        [
          ['ctrl+a', 'vim.remap', 'beancountQuickEdit.vimIncrementDatePart'],
          ['ctrl+x', 'vim.remap', 'beancountQuickEdit.vimDecrementDatePart']
        ]
      );
    } finally {
      await vscode.env.clipboard.writeText(previousClipboard);
    }
  });
});

interface VimKeybinding {
  key: string;
  command: string;
  args: {
    commands: Array<{ command: string }>;
  };
}

async function executeVimRemap(command: string): Promise<void> {
  await vscode.commands.executeCommand('vim.remap', {
    commands: [{ command }]
  });
}

async function getModeHandler(forceSyncAndUpdate = false): Promise<VSCodeVimModeHandler> {
  const extension = vscode.extensions.getExtension('vscodevim.vim');
  assert.ok(extension, 'VSCodeVim 1.32.4 must be installed for this test suite');
  if (!extension.isActive) {
    await extension.activate();
  }

  const main = (extension.packageJSON as { main?: unknown }).main;
  assert.equal(typeof main, 'string');
  const requireFromVim = createRequire(
    vscode.Uri.joinPath(extension.extensionUri, 'package.json').fsPath
  );
  const api = requireFromVim(
    vscode.Uri.joinPath(extension.extensionUri, main as string).fsPath
  ) as VSCodeVimModule;
  const modeHandler = await api.getAndUpdateModeHandler(forceSyncAndUpdate);
  assert.ok(modeHandler, 'VSCodeVim must provide a mode handler for the active editor');
  return modeHandler;
}

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      assert.fail('Timed out waiting for VSCodeVim to finish the delegated command');
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
