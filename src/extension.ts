import * as vscode from 'vscode';
import { createRequire } from 'node:module';
import { findAccountAtCharacter, findDateAtCharacter } from './beancount';
import {
  buildDateReplacements,
  deduplicateAccounts,
  LocatedAccount,
  LocatedDate,
  normalizeDateTargets
} from './operations';
import {
  buildVimKeybindingsSnippet,
  consumeVimDateShortcutCount,
  isVimModeHandlerLike,
  VIM_DECREMENT_COMMAND,
  VIM_INCREMENT_COMMAND,
  VimModeHandlerLike,
  VSCODE_VIM_EXTENSION_ID
} from './vscodeVim';

const LANGUAGE_ID = 'beancount';
const DATE_CONTEXT = 'beancountQuickEdit.cursorInDate';
const ACCOUNT_CONTEXT = 'beancountQuickEdit.cursorInAccount';
const VIM_CTRL_A_COMMAND = 'extension.vim_ctrl+a';
const VIM_CTRL_X_COMMAND = 'extension.vim_ctrl+x';

interface VSCodeVimExports {
  getAndUpdateModeHandler?: () => Promise<unknown>;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  context.subscriptions.push(
    vscode.commands.registerCommand('beancountQuickEdit.incrementDatePart', () => adjustDates(1)),
    vscode.commands.registerCommand('beancountQuickEdit.decrementDatePart', () => adjustDates(-1)),
    vscode.commands.registerCommand('beancountQuickEdit.copyAccount', copyAccounts),
    vscode.commands.registerCommand(VIM_INCREMENT_COMMAND, () =>
      handleVimDateShortcut(1, VIM_CTRL_A_COMMAND)
    ),
    vscode.commands.registerCommand(VIM_DECREMENT_COMMAND, () =>
      handleVimDateShortcut(-1, VIM_CTRL_X_COMMAND)
    ),
    vscode.commands.registerCommand(
      'beancountQuickEdit.setupVscodeVimShortcuts',
      setupVscodeVimShortcuts
    ),
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

async function handleVimDateShortcut(
  direction: 1 | -1,
  fallbackCommand: typeof VIM_CTRL_A_COMMAND | typeof VIM_CTRL_X_COMMAND
): Promise<void> {
  // Resolve the live handler first so native fallbacks can run inside this
  // vim.remap task instead of being enqueued behind a rapidly typed next key.
  const modeHandler = await getVimModeHandler();
  const editor = activeBeancountEditor();
  if (!editor || !locateDates(editor) || !modeHandler) {
    await forwardToVSCodeVim(fallbackCommand, modeHandler);
    return;
  }

  if (
    vscode.window.activeTextEditor !== editor ||
    editor.document.isClosed ||
    !locateDates(editor)
  ) {
    await forwardToVSCodeVim(fallbackCommand, modeHandler);
    return;
  }

  const count = consumeVimDateShortcutCount(modeHandler);
  if (count === undefined) {
    await forwardToVSCodeVim(fallbackCommand, modeHandler);
    return;
  }

  // The count is now consumed. From here onward this command owns the key and
  // must not fall back to Vim, even if the edit is rejected at a date boundary.
  await adjustDates(direction * count);
}

async function getVimModeHandler(): Promise<VimModeHandlerLike | undefined> {
  const extension = vscode.extensions.getExtension<VSCodeVimExports>(VSCODE_VIM_EXTENSION_ID);
  if (!extension) {
    return undefined;
  }

  try {
    if (!extension.isActive) {
      await extension.activate();
    }

    let api = extension.exports;
    if (typeof api?.getAndUpdateModeHandler !== 'function') {
      const main = (extension.packageJSON as { main?: unknown }).main;
      if (typeof main !== 'string') {
        return undefined;
      }
      const requireFromVim = createRequire(
        vscode.Uri.joinPath(extension.extensionUri, 'package.json').fsPath
      );
      api = requireFromVim(vscode.Uri.joinPath(extension.extensionUri, main).fsPath) as VSCodeVimExports;
    }

    if (typeof api?.getAndUpdateModeHandler !== 'function') {
      return undefined;
    }
    const modeHandler = await api.getAndUpdateModeHandler();
    return isVimModeHandlerLike(modeHandler) ? modeHandler : undefined;
  } catch {
    return undefined;
  }
}

async function forwardToVSCodeVim(
  fallbackCommand: typeof VIM_CTRL_A_COMMAND | typeof VIM_CTRL_X_COMMAND,
  modeHandler?: VimModeHandlerLike
): Promise<void> {
  try {
    if (modeHandler) {
      await modeHandler.handleKeyEvent(
        fallbackCommand === VIM_CTRL_A_COMMAND ? '<C-a>' : '<C-x>'
      );
      return;
    }
    await vscode.commands.executeCommand(fallbackCommand);
  } catch {
    void vscode.window.showErrorMessage('VSCodeVim could not handle the Ctrl key command.');
  }
}

async function setupVscodeVimShortcuts(): Promise<void> {
  try {
    await vscode.env.clipboard.writeText(buildVimKeybindingsSnippet());
  } catch {
    void vscode.window.showErrorMessage(
      'Beancount Quick Edit could not copy the VSCodeVim keybindings.'
    );
    return;
  }

  try {
    await vscode.commands.executeCommand('workbench.action.openGlobalKeybindingsFile');
  } catch {
    // The snippet remains available on the clipboard if the editor cannot be opened.
  }

  const suffix = vscode.extensions.getExtension(VSCODE_VIM_EXTENSION_ID)
    ? 'Paste them before the final ]; if another entry already precedes them, add a comma first.'
    : 'VSCodeVim is not installed yet; install it, then paste them before the final ]. If another entry already precedes them, add a comma first.';
  void vscode.window.showInformationMessage(`VSCodeVim Ctrl+A/X keybindings copied. ${suffix}`);
}

async function adjustDates(amount: number): Promise<void> {
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

  const replacements = buildDateReplacements(normalizedTargets, amount);
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
