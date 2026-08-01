# Changelog

All notable changes to Beancount Quick Edit are documented here.

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
