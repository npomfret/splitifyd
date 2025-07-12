const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatchMode = process.argv.includes('--watch');

const getEntryPoints = (dir) => {
  let entryPoints = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(dirent => {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      entryPoints = entryPoints.concat(getEntryPoints(fullPath));
    } else if (dirent.isFile() && (dirent.name.endsWith('.ts') || dirent.name.endsWith('.js'))) {
      entryPoints.push(fullPath);
    }
  });
  return entryPoints;
};

const commonConfig = {
  entryPoints: getEntryPoints('src/js'),
  bundle: true,
  outdir: 'dist/js',
  format: 'esm',
  // No more environment variable injection!
  // All configuration now comes from the API at runtime
};

if (isWatchMode) {
  esbuild.context({
    ...commonConfig,
  }).then(ctx => ctx.watch()).catch(() => process.exit(1));
} else {
  esbuild.build({
    ...commonConfig,
  }).catch(() => process.exit(1));
}