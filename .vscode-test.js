const { defineConfig } = require('@vscode/test-cli');
const path = require('node:path');
const os = require('node:os');

module.exports = defineConfig({
  files: 'lib/test/**/*.test.js',
  version: process.env.VSCODE_TEST_VERSION || 'stable',
  launchArgs: [
    `--user-data-dir=${path.join(os.tmpdir(), `bcqe-vscode-test-${process.pid}`)}`
  ],
  mocha: {
    timeout: 20000
  }
});
