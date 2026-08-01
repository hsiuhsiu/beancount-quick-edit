import * as vscode from 'vscode';
import { findAccountAtCharacter, findDateAtCharacter } from './beancount';
import {
  buildDateReplacements,
  deduplicateAccounts,
  LocatedAccount,
  LocatedDate,
  normalizeDateTargets
} from './operations';

const LANGUAGE_ID = 'beancount';
const DATE_CONTEXT = 'beancountQuickEdit.cursorInDate';
const ACCOUNT_CONTEXT = 'beancountQuickEdit.cursorInAccount';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  context.subscriptions.push(
    vscode.commands.registerCommand('beancountQuickEdit.incrementDatePart', () => adjustDates(1)),
    vscode.commands.registerCommand('beancountQuickEdit.decrementDatePart', () => adjustDates(-1)),
    vscode.commands.registerCommand('beancountQuickEdit.copyAccount', copyAccounts),
    vscode.window.onDidChangeActiveTextEditor(() => void refreshContexts()),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor === vscode.window.activeTextEditor) {
        void refreshContexts();
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        void refreshContexts();
      }
    })
  );

  await refreshContexts();
}

export function deactivate(): void {
  // Nothing to dispose beyond context.subscriptions.
}

async function adjustDates(direction: 1 | -1): Promise<void> {
  const editor = activeBeancountEditor();
  if (!editor || editor.document.isClosed) {
    return;
  }

  const targets = locateDates(editor);
  if (!targets) {
    void vscode.window.showInformationMessage('Place every cursor on a valid YYYY-MM-DD date first.');
    return;
  }

  const normalizedTargets = normalizeDateTargets(targets);
  if (!normalizedTargets) {
    void vscode.window.showWarningMessage(
      'Cursors on the same date must target the same date part.'
    );
    return;
  }

  const replacements = buildDateReplacements(normalizedTargets, direction);
  if (!replacements) {
    void vscode.window.showWarningMessage(
      'The requested date adjustment would exceed the supported years 0001–9999.'
    );
    return;
  }

  const applied = await editor.edit(
    (edit) => {
      for (const replacement of replacements) {
        edit.replace(
          new vscode.Range(
            replacement.target.line,
            replacement.target.start,
            replacement.target.line,
            replacement.target.end
          ),
          replacement.text
        );
      }
    },
    { undoStopBefore: true, undoStopAfter: true }
  );

  if (!applied) {
    void vscode.window.showErrorMessage('Beancount Quick Edit could not update the active editor.');
  }
  await refreshContexts();
}

async function copyAccounts(): Promise<void> {
  const editor = activeBeancountEditor();
  if (!editor) {
    return;
  }

  const targets = locateAccounts(editor);
  if (!targets) {
    void vscode.window.showInformationMessage('Place every cursor inside a valid Beancount account first.');
    return;
  }

  const uniqueTargets = deduplicateAccounts(targets);
  const documentVersion = editor.document.version;
  try {
    await vscode.env.clipboard.writeText(uniqueTargets.map((target) => target.text).join('\n'));
  } catch {
    void vscode.window.showErrorMessage('Beancount Quick Edit could not write to the clipboard.');
    return;
  }

  if (
    vscode.window.activeTextEditor === editor &&
    !editor.document.isClosed &&
    editor.document.version === documentVersion
  ) {
    editor.selections = uniqueTargets.map(
      (target) =>
        new vscode.Selection(target.line, target.start, target.line, target.end)
    );
  }

  const suffix = uniqueTargets.length === 1 ? '' : 's';
  vscode.window.setStatusBarMessage(`Copied ${uniqueTargets.length} Beancount account${suffix}.`, 2500);
  await refreshContexts();
}

function activeBeancountEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  return editor?.document.languageId === LANGUAGE_ID ? editor : undefined;
}

function locateDates(editor: vscode.TextEditor): LocatedDate[] | undefined {
  const targets: LocatedDate[] = [];
  for (const selection of editor.selections) {
    if (!selection.isEmpty) {
      return undefined;
    }
    const line = selection.active.line;
    const target = findDateAtCharacter(
      editor.document.lineAt(line).text,
      selection.active.character
    );
    if (!target) {
      return undefined;
    }
    targets.push({ ...target, line });
  }
  return targets.length > 0 ? targets : undefined;
}

function locateAccounts(editor: vscode.TextEditor): LocatedAccount[] | undefined {
  const targets: LocatedAccount[] = [];
  for (const selection of editor.selections) {
    if (!selection.isEmpty) {
      return undefined;
    }
    const line = selection.active.line;
    const target = findAccountAtCharacter(
      editor.document.lineAt(line).text,
      selection.active.character
    );
    if (!target) {
      return undefined;
    }
    targets.push({ ...target, line });
  }
  return targets.length > 0 ? targets : undefined;
}

async function refreshContexts(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  const isBeancount = editor?.document.languageId === LANGUAGE_ID;
  const dateTargets = isBeancount && editor ? locateDates(editor) : undefined;
  const cursorInDate = Boolean(dateTargets);
  const cursorInAccount = Boolean(isBeancount && editor && locateAccounts(editor));

  await Promise.all([
    vscode.commands.executeCommand('setContext', DATE_CONTEXT, cursorInDate),
    vscode.commands.executeCommand('setContext', ACCOUNT_CONTEXT, cursorInAccount)
  ]);
}
