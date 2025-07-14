const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const isWatchMode = process.argv.includes('--watch');

const getEntryPoints = (dir) => {
  let entryPoints = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(dirent => {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      entryPoints = entryPoints.concat(getEntryPoints(fullPath));
    } else if (dirent.isFile() && dirent.name.endsWith('.ts') && !dirent.name.endsWith('.test.ts')) {
      entryPoints.push(fullPath);
    }
  });
  return entryPoints;
};

const templateHtmlFiles = () => {
  const isDev = process.env.NODE_ENV === 'development';
  const apiBaseUrl = isDev ? 'http://localhost:5001' : '';
  
  // Calculate script hash
  const scriptContent = `window.API_BASE_URL = '${apiBaseUrl}';`;
  const scriptHash = crypto.createHash('sha256').update(scriptContent).digest('base64');
  
  fs.readdirSync('src', { withFileTypes: true }).forEach(dirent => {
    if (dirent.isFile() && dirent.name.endsWith('.html')) {
      const srcPath = path.join('src', dirent.name);
      const distPath = path.join('dist', dirent.name);
      
      let content = fs.readFileSync(srcPath, 'utf8');
      
      // Add script hash to CSP if it exists
      if (content.includes('script-src')) {
        content = content.replace(
          /script-src ([^;]+)/,
          `script-src $1 'sha256-${scriptHash}'`
        );
      }
      
      // Add the script
      content = content.replace(
        '</head>',
        `    <script>${scriptContent}</script>\n</head>`
      );
      
      fs.writeFileSync(distPath, content);
    }
  });
};

const commonConfig = {
  entryPoints: getEntryPoints('src/js'),
  bundle: true,
  outdir: 'dist/js',
  format: 'esm'
};

if (isWatchMode) {
  esbuild.context({
    ...commonConfig,
  }).then(ctx => {
    templateHtmlFiles();
    return ctx.watch();
  }).catch(() => process.exit(1));
} else {
  esbuild.build({
    ...commonConfig,
  }).then(() => {
    templateHtmlFiles();
  }).catch(() => process.exit(1));
}