import { RATE_LIMITS, DOCUMENT_CONFIG, SYSTEM, VALIDATION_LIMITS } from './constants';

// Load environment variables from .env file for local development
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  require('dotenv').config();
}


// Simple environment detection: either emulator or production
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
const isProduction = !isEmulator;

// Get project ID from environment - required
const projectId = process.env.PROJECT_ID;
if (!projectId) {
  throw new Error('PROJECT_ID environment variable must be set. In development, this should be in your .env file.');
}

// Direct configuration values
export const CONFIG = {
  isProduction,
  isDevelopment: isEmulator,
  
  projectId,
  
  requestBodyLimit: '1mb',
  
  rateLimiting: {
    windowMs: RATE_LIMITS.WINDOW_MS,
    maxRequests: isProduction ? RATE_LIMITS.PROD_MAX_REQUESTS : RATE_LIMITS.DEV_MAX_REQUESTS,
    cleanupIntervalMs: RATE_LIMITS.CLEANUP_INTERVAL_MS,
  },
  
  validation: {
    maxRequestSizeBytes: SYSTEM.BYTES_PER_KB * SYSTEM.BYTES_PER_KB,
    maxObjectDepth: VALIDATION_LIMITS.MAX_DOCUMENT_DEPTH,
    maxStringLength: isProduction ? DOCUMENT_CONFIG.PROD_MAX_STRING_LENGTH : DOCUMENT_CONFIG.DEV_MAX_STRING_LENGTH,
    maxPropertyCount: isProduction ? DOCUMENT_CONFIG.PROD_MAX_PROPERTY_COUNT : DOCUMENT_CONFIG.DEV_MAX_PROPERTY_COUNT,
    maxPropertyNameLength: VALIDATION_LIMITS.MAX_PROPERTY_NAME_LENGTH,
  },
  
  
  // Client config - required in production, optional in emulator
  clientConfig: {
    apiKey: process.env.CLIENT_API_KEY || '',
    authDomain: process.env.CLIENT_AUTH_DOMAIN || '',
    storageBucket: process.env.CLIENT_STORAGE_BUCKET || '',
    messagingSenderId: process.env.CLIENT_MESSAGING_SENDER_ID || '',
    appId: process.env.CLIENT_APP_ID || '',
    measurementId: process.env.CLIENT_MEASUREMENT_ID,
  },
  
  document: {
    listLimit: DOCUMENT_CONFIG.LIST_LIMIT,
    previewLength: DOCUMENT_CONFIG.PREVIEW_LENGTH,
  },
  
  // Form defaults only in emulator
  formDefaults: isEmulator ? {
    displayName: 'test',
    email: process.env.DEV_FORM_EMAIL!,
    password: process.env.DEV_FORM_PASSWORD!,
  } : undefined,
  
  warningBanner: isProduction 
    ? '⚠️ this is a demo - your data will be deleted without notice' 
    : '⚠️ emulator data will not be retained',
};

// Note: Emulator configuration is handled by environment variables set by Firebase CLI
// The FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST are automatically set
// when running in the emulator based on the ports configured in firebase.json

// Export project ID for use by other modules
export const PROJECT_ID = projectId;