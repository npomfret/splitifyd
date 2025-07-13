const fs = require('fs');
const path = require('path');

// Load app configuration
const configPath = path.join(__dirname, '../app-config.json');

try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  // Required fields
  const requiredFields = [
    'appName',
    'appDisplayName', 
    'firebaseProjectId',
    'productionBaseUrl',
    'apiBaseUrl'
  ];
  
  // Check for required fields
  const missingFields = requiredFields.filter(field => !config[field]);
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  // Validate field types
  for (const field of requiredFields) {
    if (typeof config[field] !== 'string' || config[field].trim() === '') {
      throw new Error(`Invalid value for ${field}: must be a non-empty string`);
    }
  }
  
  // Validate URLs
  const urlFields = ['productionBaseUrl', 'apiBaseUrl'];
  for (const field of urlFields) {
    try {
      new URL(config[field]);
    } catch (e) {
      throw new Error(`Invalid URL for ${field}: ${config[field]}`);
    }
  }
  
  // Validate appName format (lowercase, no spaces)
  if (!/^[a-z0-9-]+$/.test(config.appName)) {
    throw new Error('appName must contain only lowercase letters, numbers, and hyphens');
  }
  
  console.log('✓ app-config.json is valid');
  process.exit(0);
} catch (error) {
  console.error('✗ app-config.json validation failed:', error.message);
  process.exit(1);
}