# Contributing

Issues and focused pull requests are welcome.

## Local development

Use Node.js 20 or newer and npm 11.17.0 or newer:

```sh
npm ci --strict-allow-scripts
npm run check
npm test
npm run test:integration
```

Press `F5` in VS Code to open an Extension Development Host after running `npm run compile`.

## Release checklist

1. Update `version` in `package.json` and the matching output name in the `package` script.
2. Update `CHANGELOG.md`.
3. Run `npm ci --strict-allow-scripts`, `npm run check`, `npm test`, and `npm run test:integration`.
4. Run `npm run package:inspect` and confirm that the archive contains only intended files.
5. Run `npm run package` and install the resulting VSIX in a clean VS Code profile.
6. Upload that exact tested VSIX to the Marketplace and attach it to the matching GitHub release.

Marketplace publishing credentials must not be committed to the repository. The initial release workflow intentionally packages and retains a VSIX artifact without automatically publishing it.
