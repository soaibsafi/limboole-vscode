//@ts-check
import * as esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const watch = process.argv.includes('--watch');
const minify = process.argv.includes('--minify');

const success = watch ? 'Watch build succeeded' : 'Build succeeded';

function getTime() {
  const date = new Date();
  return `[${`${padZeroes(date.getHours())}:${padZeroes(date.getMinutes())}:${padZeroes(date.getSeconds())}`}] `;
}

function padZeroes(i) {
  return i.toString().padStart(2, '0');
}

/**
 * @type {import('esbuild').Plugin}
 */
const copyLibPlugin = {
  name: 'copy-lib',
  setup(build) {
    build.onEnd(() => {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const srcDir = path.join(__dirname, 'lib');
      const destDir = path.join(__dirname, 'out', 'lib');

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.readdirSync(srcDir).forEach(file => {
        const srcFile = path.join(srcDir, file);
        const destFile = path.join(destDir, file);
        fs.copyFileSync(srcFile, destFile);
      });

      console.log('Copied lib directory to out/lib');
    });
  }
};

const plugins = [
  {
    name: 'watch-plugin',
    setup(build) {
      build.onEnd(result => {
        if (result.errors.length === 0) {
          console.log(getTime() + success);
        }
      });
    },
  },
  copyLibPlugin // Copy the lib directory to out/lib
];

const ctx = await esbuild.context({
  // Entry points for the vscode extension and the language server
  entryPoints: ['src/extension/main.ts', 'src/language/main.ts'],
  outdir: 'out',
  bundle: true,
  target: "ES2017",
  // VSCode's extension host is still using cjs, so we need to transform the code
  format: 'cjs',
  // To prevent confusing node, we explicitly use the `.cjs` extension
  outExtension: {
    '.js': '.cjs'
  },
  loader: { '.ts': 'ts' },
  external: ['vscode'],
  platform: 'node',
  sourcemap: !minify,
  minify,
  plugins
});

if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  ctx.dispose();
}
