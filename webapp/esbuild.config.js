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

// Function to parse .env file
const parseEnvFile = (filePath) => {
  const env = {};
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  }
  return env;
};

// Load environment variables from firebase/functions/.env
const firebaseEnvPath = path.resolve(__dirname, '../firebase/functions/.env');
const firebaseEnv = parseEnvFile(firebaseEnvPath);

const commonConfig = {
  entryPoints: getEntryPoints('src/js'),
  bundle: true,
  outdir: 'dist/js',
  format: 'esm',
  define: {
    API_BASE_URL: JSON.stringify(firebaseEnv.EMULATOR_FUNCTIONS_PORT ? `http://localhost:${firebaseEnv.EMULATOR_FUNCTIONS_PORT}/splitifyd/us-central1/api` : 'http://localhost:6001/splitifyd/us-central1/api'),
    FIREBASE_EMULATOR_HOST: JSON.stringify(firebaseEnv.EMULATOR_AUTH_PORT ? 'localhost' : 'localhost'),
    FIREBASE_AUTH_EMULATOR_PORT: JSON.stringify(firebaseEnv.EMULATOR_AUTH_PORT || '9199'),
    FIREBASE_FUNCTIONS_PORT: JSON.stringify(firebaseEnv.EMULATOR_FUNCTIONS_PORT || '6001'),
    FIREBASE_HOSTING_PORT: JSON.stringify(firebaseEnv.EMULATOR_HOSTING_PORT || '6002'),
  },
};

esbuild.build({
  ...commonConfig,
  ...(isWatchMode ? { watch: true } : {}),
}).catch(() => process.exit(1));
