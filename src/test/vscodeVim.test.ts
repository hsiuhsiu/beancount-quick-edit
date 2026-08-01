import * as assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as vscode from 'vscode';

interface VSCodeVimModeHandler {
  handleKeyEvent(key: string): Promise<unknown>;
  vimState: {
    recordedState: {
      actionKeys: unknown[];
      actionsRun: unknown[];
      actionsRunPressedKeys: unknown[];
      bufferedKeys: unknown[];
      commandList: unknown[];
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

  test('uses a pending Vim count once and leaves following commands clean', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'beancount',
      content: '2026-04-16 * "Count"\n2026-04-17 * "Next"\n'
    });
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(0, 8, 0, 8);
    const modeHandler = await getModeHandler(true);

    await executeCountedVimRemap(3, 'beancountQuickEdit.vimIncrementDatePart');
    await waitFor(
      () =>
        document.lineAt(0).text === '2026-04-19 * "Count"' &&
        modeHandler.vimState.recordedState.count === 0
    );
    assert.equal(document.lineAt(0).text, '2026-04-19 * "Count"');
    assert.equal(modeHandler.vimState.recordedState.count, 0);
    assert.deepEqual(modeHandler.vimState.recordedState.actionKeys, []);
    assert.deepEqual(modeHandler.vimState.recordedState.actionsRun, []);
    assert.deepEqual(modeHandler.vimState.recordedState.actionsRunPressedKeys, []);
    assert.deepEqual(modeHandler.vimState.recordedState.bufferedKeys, []);
    assert.deepEqual(modeHandler.vimState.recordedState.commandList, []);

    await executeVimRemap('beancountQuickEdit.vimIncrementDatePart');
    await waitFor(() => document.lineAt(0).text === '2026-04-20 * "Count"');
    assert.equal(document.lineAt(0).text, '2026-04-20 * "Count"');

    await vscode.commands.executeCommand('type', { text: 'j' });
    await waitFor(() => editor.selection.active.line === 1);
    assert.equal(editor.selection.active.line, 1);
  });

  test('applies counted year, month, day, and decrement changes directly', async () => {
    const cases: Array<{
      value: string;
      caret: number;
      count: number;
      command: string;
      expected: string;
    }> = [
      {
        value: '2024-02-29',
        caret: 4,
        count: 4,
        command: 'beancountQuickEdit.vimIncrementDatePart',
        expected: '2028-02-29'
      },
      {
        value: '2024-01-31',
        caret: 7,
        count: 2,
        command: 'beancountQuickEdit.vimIncrementDatePart',
        expected: '2024-03-31'
      },
      {
        value: '2026-01-30',
        caret: 10,
        count: 3,
        command: 'beancountQuickEdit.vimIncrementDatePart',
        expected: '2026-02-02'
      },
      {
        value: '2024-03-01',
        caret: 9,
        count: 2,
        command: 'beancountQuickEdit.vimDecrementDatePart',
        expected: '2024-02-28'
      }
    ];

    for (const { value, caret, count, command, expected } of cases) {
      const document = await vscode.workspace.openTextDocument({
        language: 'beancount',
        content: `${value} * "Direct"\n`
      });
      const editor = await vscode.window.showTextDocument(document);
      editor.selection = new vscode.Selection(0, caret, 0, caret);
      const modeHandler = await getModeHandler(true);

      await executeCountedVimRemap(count, command);
      await waitFor(
        () =>
          document.lineAt(0).text === `${expected} * "Direct"` &&
          modeHandler.vimState.recordedState.count === 0
      );
      assert.equal(document.lineAt(0).text, `${expected} * "Direct"`);
    }
  });

  test('preserves multiple cursors and changes all dates in one counted edit', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'beancount',
      content: '2026-01-30 * "One"\n2024-02-28 * "Two"\n'
    });
    const editor = await vscode.window.showTextDocument(document);
    editor.selections = [
      new vscode.Selection(0, 9, 0, 9),
      new vscode.Selection(1, 9, 1, 9)
    ];
    const modeHandler = await getModeHandler(true);

    await executeCountedVimRemap(2, 'beancountQuickEdit.vimIncrementDatePart');
    await waitFor(
      () =>
        document.lineAt(0).text === '2026-02-01 * "One"' &&
        document.lineAt(1).text === '2024-03-01 * "Two"' &&
        modeHandler.vimState.recordedState.count === 0
    );

    assert.equal(editor.selections.length, 2);
    assert.deepEqual(
      editor.selections.map((selection) => [selection.active.line, selection.active.character]),
      [
        [0, 9],
        [1, 9]
      ]
    );
  });

  test('keeps a counted edit in one undo step', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'beancount',
      content: '2026-01-30 * "Undo"\n'
    });
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(0, 9, 0, 9);
    await getModeHandler(true);

    await executeCountedVimRemap(3, 'beancountQuickEdit.vimIncrementDatePart');
    await waitFor(() => document.lineAt(0).text === '2026-02-02 * "Undo"');
    // Queue Vim's undo behind the remap task so the assertion cannot race the
    // extension's final context refresh after the editor edit has landed.
    await vscode.commands.executeCommand('type', { text: 'u' });
    await waitFor(() => document.lineAt(0).text === '2026-01-30 * "Undo"');

    assert.equal(document.lineAt(0).text, '2026-01-30 * "Undo"');
  });

  test('consumes an out-of-range count without leaking it to the next motion', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'beancount',
      content: '9999-12-31 * "Limit"\n2026-01-01 * "Next"\n'
    });
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(0, 9, 0, 9);
    const modeHandler = await getModeHandler(true);

    await executeCountedVimRemap(2, 'beancountQuickEdit.vimIncrementDatePart');
    await waitFor(() => modeHandler.vimState.recordedState.count === 0);
    assert.equal(document.lineAt(0).text, '9999-12-31 * "Limit"');

    await vscode.commands.executeCommand('type', { text: 'j' });
    await waitFor(() => editor.selection.active.line === 1);
    assert.equal(editor.selection.active.line, 1);
  });

  test('delegates counted Ctrl commands to native Vim outside a date', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'beancount',
      content: 'value 10\n'
    });
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(0, 7, 0, 7);
    const modeHandler = await getModeHandler(true);

    await executeCountedVimRemap(3, 'beancountQuickEdit.vimIncrementDatePart');
    await waitFor(
      () => document.lineAt(0).text === 'value 13' && modeHandler.vimState.recordedState.count === 0
    );
    assert.equal(document.lineAt(0).text, 'value 13');
  });

  test('runs a native fallback before a rapidly queued following Vim key', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'beancount',
      content: 'value 10 20\n'
    });
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(0, 6, 0, 6);
    await getModeHandler(true);

    const increment = executeVimRemap('beancountQuickEdit.vimIncrementDatePart');
    const moveToEnd = vscode.commands.executeCommand('type', { text: '$' });
    await Promise.all([increment, moveToEnd]);
    await waitFor(
      () => document.lineAt(0).text !== 'value 10 20' && editor.selection.active.character === 10
    );

    assert.equal(document.lineAt(0).text, 'value 11 20');
    assert.equal(editor.selection.active.character, 10);
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

async function executeCountedVimRemap(count: number, command: string): Promise<void> {
  for (const digit of String(count)) {
    await vscode.commands.executeCommand('type', { text: digit });
  }
  await executeVimRemap(command);
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
