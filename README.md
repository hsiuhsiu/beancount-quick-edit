# Beancount Quick Edit

Small, cursor-aware editing commands for Beancount files. Change the year, month, or day in an ISO date without leaving the keyboard, and copy a complete account name without changing normal word selection.

## Features

### Adjust dates at the cursor

Place the caret anywhere from the beginning of a valid `YYYY-MM-DD` date through
the position immediately after its final digit, then press:

| Platform | Increase | Decrease |
| --- | --- | --- |
| macOS | `Option`+`↑` | `Option`+`↓` |
| Windows / Linux | `Alt`+`↑` | `Alt`+`↓` |

The caret is an insertion point between characters. The position immediately after
`YYYY`, `MM`, or `DD` still belongs to that component:

- Before or within `YYYY`, and immediately after it, changes the year.
- After the first hyphen, within `MM`, and immediately after it, changes the month.
- After the second hyphen, within `DD`, and immediately after it, changes the day.

Date arithmetic follows the proleptic Gregorian calendar:

```text
2026-01-31  day +1    → 2026-02-01
2024-01-31  month +1  → 2024-02-29
2024-02-29  year +1   → 2025-02-28
```

Changing a day rolls across months and years. Changing a month or year keeps the day when possible and otherwise clamps it to the final day of the destination month. Supported years are `0001` through `9999`.

Outside a valid date, VS Code keeps its normal `Alt`/`Option`+arrow behavior, including moving lines.

### Copy the complete account at the cursor

Normal double-click word selection remains unchanged. Place the caret anywhere inside an account such as `Assets:Bank:Checking`, then press:

| Platform | Copy account |
| --- | --- |
| macOS | `Option`+`Command`+`C` |
| Windows / Linux | `Ctrl`+`Alt`+`C` |

The command copies and selects the complete account. It follows Beancount's account-name shape, including hyphens, digits after a colon, and uppercase Unicode letters.

Some international Windows and Linux keyboard layouts use `Ctrl`+`Alt` as `AltGr`. If that applies to your layout, reassign this command in VS Code's Keyboard Shortcuts editor.

### Multiple cursors

Both features support multiple cursors:

- Date changes are applied in one edit and one undo step.
- Account names are copied in document order, one per line.
- Duplicate cursors on the same date or account are handled once.
- Date shortcuts activate when every cursor is on a valid date; otherwise VS Code keeps its normal key behavior.
- Account copying requires every cursor to be inside a valid account, or nothing is copied.
- Two cursors on different parts of the same date are treated as a conflict, so the command leaves every date unchanged.

## Scope and compatibility

The extension activates only for the `beancount` language ID and works alongside Beancount syntax-highlighting and language-server extensions.

Matching is intentionally lexical and local to the current line. If you deliberately place the caret on date- or account-shaped text inside a comment or string, the command can act on it. The extension does not parse your ledger or read other files.

## Privacy and security

Beancount Quick Edit:

- has no runtime dependencies;
- makes no network requests;
- contains no telemetry;
- does not launch processes or shell commands;
- does not read or write files directly; and
- accesses only the active editor and, for account copying, the clipboard.

It supports untrusted and virtual workspaces in desktop VS Code because its behavior does not depend on workspace execution or filesystem access. The extension does not include a browser entry for vscode.dev. The shipped JavaScript is bundled but not minified, and includes a source map with embedded source content for inspection.

## Commands

Open the Command Palette and search for **Beancount Quick Edit**:

- `Beancount Quick Edit: Increment Date Part`
- `Beancount Quick Edit: Decrement Date Part`
- `Beancount Quick Edit: Copy Account at Cursor`

All shortcuts can be reassigned through VS Code's Keyboard Shortcuts editor.

## Installation

In VS Code's Extensions view, search for **Beancount Quick Edit** and choose **Install**. To install a manually downloaded build, run **Extensions: Install from VSIX...** from the Command Palette and select the `.vsix` file.

## Development

Requirements: Node.js 20 or newer, npm 11.17.0 or newer, and a current VS Code installation.

```sh
npm ci --strict-allow-scripts
npm run check
npm test
npm run test:integration
npm run package
```

`npm run package` creates `beancount-quick-edit-0.1.1.vsix`. See [CONTRIBUTING.md](CONTRIBUTING.md) for the release workflow.

## License

[MIT](LICENSE)
