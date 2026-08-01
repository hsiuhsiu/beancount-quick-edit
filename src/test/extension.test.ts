import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

suite('Beancount Quick Edit integration', () => {
  test('adjusts a day through the registered command and preserves the cursor', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'beancount',
      content: '2026-01-31 * "Example"\n'
    });
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(0, 8, 0, 8);

    await vscode.commands.executeCommand('beancountQuickEdit.incrementDatePart');
    assert.equal(document.lineAt(0).text, '2026-02-01 * "Example"');
    assert.equal(editor.selection.active.character, 8);
  });

  test('adjusts several cursor-selected parts atomically in one edit', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'beancount',
      content: '2024-01-31 * "Month"\n2023-12-31 * "Day"\n'
    });
    const editor = await vscode.window.showTextDocument(document);
    editor.selections = [
      new vscode.Selection(0, 6, 0, 6),
      new vscode.Selection(1, 8, 1, 8)
    ];

    await vscode.commands.executeCommand('beancountQuickEdit.incrementDatePart');
    assert.equal(document.lineAt(0).text, '2024-02-29 * "Month"');
    assert.equal(document.lineAt(1).text, '2024-01-01 * "Day"');
    assert.deepEqual(
      editor.selections.map((selection) => selection.active.character),
      [6, 8]
    );
  });

  test('keeps component-ending caret positions in the preceding date part', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'beancount',
      content: '2026-04-16\n2026-04-16\n2026-04-16'
    });
    const editor = await vscode.window.showTextDocument(document);
    editor.selections = [
      new vscode.Selection(0, 4, 0, 4),
      new vscode.Selection(1, 7, 1, 7),
      new vscode.Selection(2, 10, 2, 10)
    ];

    await vscode.commands.executeCommand('beancountQuickEdit.incrementDatePart');
    assert.equal(document.lineAt(0).text, '2027-04-16');
    assert.equal(document.lineAt(1).text, '2026-05-16');
    assert.equal(document.lineAt(2).text, '2026-04-17');
    assert.deepEqual(
      editor.selections.map((selection) => selection.active.character),
      [4, 7, 10]
    );
  });

  test('leaves a date unchanged when cursors target conflicting parts', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'beancount',
      content: '2024-01-31 * "Conflict"\n'
    });
    const editor = await vscode.window.showTextDocument(document);
    editor.selections = [
      new vscode.Selection(0, 2, 0, 2),
      new vscode.Selection(0, 8, 0, 8)
    ];

    await vscode.commands.executeCommand('beancountQuickEdit.incrementDatePart');
    assert.equal(document.lineAt(0).text, '2024-01-31 * "Conflict"');
  });

  test('copies and selects the full account at the cursor', async () => {
    const previousClipboard = await vscode.env.clipboard.readText();
    try {
      const document = await vscode.workspace.openTextDocument({
        language: 'beancount',
        content: '    Assets:Bank:Checking  1.00 USD\n'
      });
      const editor = await vscode.window.showTextDocument(document);
      editor.selection = new vscode.Selection(0, 17, 0, 17);

      await vscode.commands.executeCommand('beancountQuickEdit.copyAccount');
      assert.equal(await vscode.env.clipboard.readText(), 'Assets:Bank:Checking');
      assert.equal(document.getText(editor.selection), 'Assets:Bank:Checking');
    } finally {
      await vscode.env.clipboard.writeText(previousClipboard);
    }
  });

  test('copies several accounts once each in document order', async () => {
    const previousClipboard = await vscode.env.clipboard.readText();
    try {
      const document = await vscode.workspace.openTextDocument({
        language: 'beancount',
        content: '    Assets:Bank:Checking  1.00 USD\n    Expenses:Dining  1.00 USD\n'
      });
      const editor = await vscode.window.showTextDocument(document);
      editor.selections = [
        new vscode.Selection(1, 13, 1, 13),
        new vscode.Selection(0, 17, 0, 17),
        new vscode.Selection(0, 18, 0, 18)
      ];

      await vscode.commands.executeCommand('beancountQuickEdit.copyAccount');
      assert.equal(
        await vscode.env.clipboard.readText(),
        'Assets:Bank:Checking\nExpenses:Dining'
      );
      assert.deepEqual(
        editor.selections.map((selection) => document.getText(selection)),
        ['Assets:Bank:Checking', 'Expenses:Dining']
      );
    } finally {
      await vscode.env.clipboard.writeText(previousClipboard);
    }
  });
});
