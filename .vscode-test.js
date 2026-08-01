const { defineConfig } = require('@vscode/test-cli');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const version = process.env.VSCODE_TEST_VERSION || 'stable';
const vimUserDataDir = path.join(os.tmpdir(), `bcqe-vscode-vim-test-${process.pid}`);
const vimStorageDir = path.join(vimUserDataDir, 'User', 'globalStorage', 'vscodevim.vim');
fs.mkdirSync(vimStorageDir, { recursive: true });
fs.writeFileSync(
  path.join(vimStorageDir, '.registers'),
  JSON.stringify({ version: '1.0', registers: [] }),
  'utf8'
);

module.exports = defineConfig([
  {
    files: 'lib/test/extension.test.js',
    version,
    launchArgs: [
      `--user-data-dir=${path.join(os.tmpdir(), `bcqe-vscode-test-${process.pid}`)}`,
      '--disable-extension=vscodevim.vim'
    ],
    mocha: {
      timeout: 20000
    }
  },
  {
    files: 'lib/test/vscodeVim.test.js',
    version,
    installExtensions: ['vscodevim.vim@1.32.4'],
    launchArgs: [
      `--user-data-dir=${vimUserDataDir}`
    ],
    mocha: {
      timeout: 30000
    }
  }
]);
