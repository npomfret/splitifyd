const fs = require('fs');
const path = require('path');

function loadAppConfig() {
  try {
    // Load app-config.json from the root directory
    const configPath = path.join(__dirname, '../../../../app-config.json');
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(configContent);
    } else {
      throw new Error('app-config.json not found. This file is required for the application to run.');
    }
  } catch (error) {
    console.error('Error loading app-config.json:', error);
    throw error;
  }
}

module.exports = { loadAppConfig };