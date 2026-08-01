# Security policy

## Supported versions

Security fixes are provided for the latest Marketplace release.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Contact the maintainer at `yihsiuc@pm.me`.

Include the affected version, reproduction steps, impact, and any suggested mitigation. You should receive an acknowledgement within seven days.

## Security posture

The extension has no runtime dependencies, telemetry, network access, process execution, or access to ledger or workspace files. Its privileged interactions are limited to the active editor, explicitly requested clipboard writes, and optional VSCodeVim compatibility. For that compatibility path, it activates the installed VSCodeVim extension and reuses its local desktop entry module. It reads the in-process pending-command state and, only after recognizing an idle state or a pure numeric prefix, replaces that record with a freshly constructed default record to consume the command. It does not download code, launch external programs, or execute workspace-provided code. It falls back to VSCodeVim's own handler if the expected internal shape is unavailable.
