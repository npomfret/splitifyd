const fs = require('fs');
const path = require('path');

// Load app configuration
const appConfigPath = path.join(__dirname, '../../app-config.json');
const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf-8'));

// Directory containing HTML files
const htmlDir = path.join(__dirname, '../dist');

// Replacements map
const replacements = {
  'Splitifyd': appConfig.appDisplayName,
  'splitifyd': appConfig.appName,
  'https://api.splitifyd.com': appConfig.apiBaseUrl,
  'https://splitifyd.web.app': appConfig.productionBaseUrl
};

// Function to replace content in a file
function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  
  // Apply replacements
  for (const [search, replace] of Object.entries(replacements)) {
    const regex = new RegExp(search, 'g');
    if (content.match(regex)) {
      content = content.replace(regex, replace);
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated: ${path.relative(htmlDir, filePath)}`);
  }
}

// Find all HTML files
function processHtmlFiles(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      processHtmlFiles(fullPath);
    } else if (file.isFile() && file.name.endsWith('.html')) {
      replaceInFile(fullPath);
    }
  }
}

// Process all HTML files
console.log('Replacing app configuration in HTML files...');
processHtmlFiles(htmlDir);
console.log('Done!');