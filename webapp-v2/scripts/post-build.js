import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine environment - we're always in dev when running locally
const isDev = true; // Since this runs via watch mode locally

// Read Firebase configuration files if in development
let firebaseConfig, firebaseRc;
if (isDev) {
  firebaseConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../firebase/firebase.json'), 'utf8')
  );
  
  firebaseRc = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../firebase/.firebaserc'), 'utf8')
  );
  
  const functionsPort = firebaseConfig.emulators?.functions?.port;
  if (!functionsPort) {
    throw new Error('Firebase emulator functions port not found in firebase.json');
  }
  
  const projectId = firebaseRc.projects?.default;
  if (!projectId) {
    throw new Error('Default project not found in .firebaserc');
  }
}

// Always inject API_BASE_URL (empty string for production)
// The build outputs to ../webapp/dist/v2, so we read from there
const indexPath = path.join(__dirname, '../../webapp/dist/v2/index.html');

let html = fs.readFileSync(indexPath, 'utf8');

// Inject the API_BASE_URL script before the closing </head> tag
let scriptContent;
if (isDev) {
  // In development, dynamically construct URL to match the hostname used to access the app
  scriptContent = `window.API_BASE_URL = window.location.protocol + '//' + window.location.hostname + ':${firebaseConfig.emulators?.functions?.port}/${firebaseRc.projects?.default}/us-central1';`;
} else {
  // In production, use empty string for relative URLs
  scriptContent = `window.API_BASE_URL = '';`;
}
const scriptTag = `    <script>${scriptContent}</script>\n  `;
html = html.replace('</head>', scriptTag + '</head>');

fs.writeFileSync(indexPath, html);
console.log(`Post-build: Injected API_BASE_URL script`);

// Also calculate and log script hash for CSP if needed
const crypto = await import('crypto');
const scriptHash = crypto.createHash('sha256').update(scriptContent).digest('base64');
console.log(`Post-build: Script hash for CSP: sha256-${scriptHash}`);