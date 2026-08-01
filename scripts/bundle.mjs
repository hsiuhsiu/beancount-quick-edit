import { build } from 'esbuild';

await build({
  entryPoints: ['lib/extension.js'],
  outfile: 'dist/extension.js',
  bundle: true,
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  minify: false,
  sourcemap: true,
  sourcesContent: true,
  legalComments: 'inline'
});
