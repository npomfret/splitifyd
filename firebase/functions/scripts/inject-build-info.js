#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const buildInfoPath = path.join(__dirname, '../lib/utils/build-info.js');
const timestamp = new Date().toISOString();
const date = new Date().toLocaleDateString('en-US', { 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'short'
});

// Read the compiled file
let content = fs.readFileSync(buildInfoPath, 'utf8');

// Replace placeholders
content = content.replace('__BUILD_TIMESTAMP__', timestamp);
content = content.replace('__BUILD_DATE__', date);

// Write back
fs.writeFileSync(buildInfoPath, content);

console.log(`Build info injected: ${timestamp}`);