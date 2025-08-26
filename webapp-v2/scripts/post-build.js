import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine environment based on NODE_ENV
const isDev = process.env.NODE_ENV !== 'production';

// Read Firebase configuration files if in development
let firebaseConfig, firebaseRc;
if (isDev) {
    firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../firebase/firebase.json'), 'utf8'));

    firebaseRc = JSON.parse(fs.readFileSync(path.join(__dirname, '../../firebase/.firebaserc'), 'utf8'));

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
// The build outputs to dist, so we need to process all HTML files

// Generate build timestamp and git hash
const buildTime = new Date().toISOString();
const gitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

// Inject the getApiBaseUrl function before the closing </head> tag
let baseUrlValue;
if (isDev) {
    // In development, dynamically construct URL to match the hostname used to access the app
    baseUrlValue = `window.location.protocol + '//' + window.location.hostname + ':${firebaseConfig.emulators?.functions?.port}/${firebaseRc.projects?.default}/us-central1/api'`;
    console.log(`injecting firebase emulator base URL function`);
} else {
    // In production, use relative URL that gets rewritten by Firebase Hosting
    baseUrlValue = `'/api'`;
}

const scriptContent = `window.getApiBaseUrl = function() {
    if (typeof window === 'undefined') {
        return '/api';
    }
    
    return ${baseUrlValue};
};`;

const buildComment = `    <!-- Built: ${buildTime} | Git: ${gitHash} -->\n    `;
const scriptTag = buildComment + `<script>${scriptContent}</script>\n  `;

// Function to process an HTML file
const processHtmlFile = (filePath) => {
    if (fs.existsSync(filePath)) {
        let html = fs.readFileSync(filePath, 'utf8');

        // Only inject if not already present
        if (!html.includes('window.getApiBaseUrl')) {
            html = html.replace('</head>', scriptTag + '</head>');
            fs.writeFileSync(filePath, html);
            console.log(`Post-build: Injected API_BASE_URL into ${path.relative(path.join(__dirname, '..'), filePath)}`);
        }
    }
};

// Process all pre-rendered HTML files
const distDir = path.join(__dirname, '../dist');

// Process root index.html
processHtmlFile(path.join(distDir, 'index.html'));

// Process other pre-rendered pages
const prerenderDirs = ['v2/pricing', 'v2/terms-of-service', 'v2/privacy-policy', 'v2/cookies-policy'];

prerenderDirs.forEach((dir) => {
    const htmlPath = path.join(distDir, dir, 'index.html');
    processHtmlFile(htmlPath);
});

// Also calculate and log script hash for CSP if needed
const crypto = await import('crypto');
const scriptHash = crypto.createHash('sha256').update(scriptContent).digest('base64');
console.log(`Post-build: Script hash for CSP: sha256-${scriptHash}`);
