const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  logLevel: 'info',
  loader: { '.wasm': 'binary' }
};

function copyKatexAssets() {
  const katexDist = path.join(__dirname, 'node_modules', 'katex', 'dist');
  const destDir = path.join(__dirname, 'dist', 'katex');
  const fontsDir = path.join(destDir, 'fonts');
  fs.mkdirSync(fontsDir, { recursive: true });
  fs.copyFileSync(
    path.join(katexDist, 'katex.min.css'),
    path.join(destDir, 'katex.min.css')
  );
  for (const f of fs.readdirSync(path.join(katexDist, 'fonts'))) {
    fs.copyFileSync(
      path.join(katexDist, 'fonts', f),
      path.join(fontsDir, f)
    );
  }
  console.log('katex assets copied to dist/katex/');
}

async function run() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    copyKatexAssets();
    console.log('esbuild watching...');
  } else {
    await esbuild.build(buildOptions);
    copyKatexAssets();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
