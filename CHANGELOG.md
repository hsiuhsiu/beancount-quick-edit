# Changelog

All notable changes to Beancount Quick Edit are documented here.

## 0.3.0 — 2026-08-01

- Add Vim-style numeric prefixes to calendar-aware `Ctrl+A` and `Ctrl+X`; for example, `3 Ctrl+A`
  advances the date component at the caret by three days, months, or years.
- Apply counted changes directly in one edit and one undo step, including Gregorian rollover,
  leap years, end-of-month clamping, and multiple cursors.
- Fix intermittent native/custom routing after rapid cursor or mode changes by deciding from the
  live editor and VSCodeVim state when the command executes.
- Keep native fallback commands in the same VSCodeVim queue so an immediately following key cannot
  overtake `Ctrl+A` or `Ctrl+X`.
- Consume a pure numeric prefix completely so it cannot leak into the following Vim command, while
  continuing to delegate operators, macros, non-Normal modes, and non-date positions to VSCodeVim.
- Require existing 0.2.0 users to rerun the setup command and replace the two copied keybindings.

## 0.2.0 — 2026-08-01

- Add opt-in VSCodeVim Normal-mode `Ctrl+A` and `Ctrl+X` date shortcuts.
- Add a setup command that copies paste-ready user keybindings and opens `keybindings.json` without modifying it.
- Preserve native VSCodeVim behavior outside valid Beancount dates and whenever a count or other command prefix is pending.
- Add compatibility tests against VSCodeVim 1.32.4.

## 0.1.1 — 2026-08-01

- Treat caret positions immediately after the year, month, and day as part of that date component.
- Keep date shortcuts active at the end of a date instead of falling through to VS Code's line-moving command.

## 0.1.0 — 2026-08-01

- Add cursor-aware year, month, and day adjustment for `YYYY-MM-DD` dates.
- Add calendar rollover and end-of-month clamping.
- Add complete Beancount account copying without changing normal word boundaries.
- Add atomic multi-cursor support for both features.
- Add conditional macOS, Windows, and Linux keyboard shortcuts.
- Add automated unit, Extension Host, packaging, and CI checks.
