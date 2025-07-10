import { PORTS, RATE_LIMITS, DOCUMENT_CONFIG, SYSTEM, VALIDATION_LIMITS } from './constants';
import * as functions from 'firebase-functions';

// Load environment variables from .env file for local development
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  require('dotenv').config();
}

// Firebase Functions don't automatically set NODE_ENV=production, so we need to detect deployment
// During build/deploy phase, environment variables might not be available yet
const isBuildPhase = !process.env.FUNCTIONS_EMULATOR && !process.env.K_SERVICE;
const ENV_IS_PRODUCTION = process.env.NODE_ENV === 'production' || (!process.env.FUNCTIONS_EMULATOR && process.env.K_SERVICE);
const ENV_IS_DEVELOPMENT = process.env.NODE_ENV === 'development' || process.env.FUNCTIONS_EMULATOR === 'true';
const ENV_IS_TEST = process.env.NODE_ENV === 'test';

function parseInteger(value: string | undefined, name: string): number {
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid integer`);
  }
  return parsed;
}

// Project ID - Firebase emulator uses GCLOUD_PROJECT
const projectId = process.env.PROJECT_ID || process.env.GCLOUD_PROJECT || (ENV_IS_TEST ? 'test-project' : isBuildPhase ? 'splitifyd' : (() => {
  throw new Error('PROJECT_ID or GCLOUD_PROJECT environment variable is required');
})());

// Direct configuration values
export const CONFIG = {
  environment: process.env.NODE_ENV || (ENV_IS_TEST ? 'test' : ENV_IS_DEVELOPMENT ? 'development' : isBuildPhase ? 'production' : (() => {
    throw new Error('NODE_ENV environment variable is required');
  })()),
  isProduction: ENV_IS_PRODUCTION,
  isDevelopment: ENV_IS_DEVELOPMENT,
  isTest: ENV_IS_TEST,
  
  projectId,
  
  requestBodyLimit: '1mb',
  
  rateLimiting: {
    windowMs: RATE_LIMITS.WINDOW_MS,
    maxRequests: ENV_IS_PRODUCTION ? RATE_LIMITS.PROD_MAX_REQUESTS : RATE_LIMITS.DEV_MAX_REQUESTS,
    cleanupIntervalMs: RATE_LIMITS.CLEANUP_INTERVAL_MS,
  },
  
  validation: {
    maxRequestSizeBytes: SYSTEM.BYTES_PER_KB * SYSTEM.BYTES_PER_KB,
    maxObjectDepth: VALIDATION_LIMITS.MAX_DOCUMENT_DEPTH,
    maxStringLength: ENV_IS_PRODUCTION ? DOCUMENT_CONFIG.PROD_MAX_STRING_LENGTH : DOCUMENT_CONFIG.DEV_MAX_STRING_LENGTH,
    maxPropertyCount: ENV_IS_PRODUCTION ? DOCUMENT_CONFIG.PROD_MAX_PROPERTY_COUNT : DOCUMENT_CONFIG.DEV_MAX_PROPERTY_COUNT,
    maxPropertyNameLength: VALIDATION_LIMITS.MAX_PROPERTY_NAME_LENGTH,
  },
  
  
  emulatorPorts: {
    auth: process.env.EMULATOR_AUTH_PORT ? parseInteger(process.env.EMULATOR_AUTH_PORT, 'EMULATOR_AUTH_PORT') : PORTS.AUTH_EMULATOR,
    firestore: process.env.EMULATOR_FIRESTORE_PORT ? parseInteger(process.env.EMULATOR_FIRESTORE_PORT, 'EMULATOR_FIRESTORE_PORT') : PORTS.FIRESTORE_EMULATOR,
    functions: process.env.EMULATOR_FUNCTIONS_PORT ? parseInteger(process.env.EMULATOR_FUNCTIONS_PORT, 'EMULATOR_FUNCTIONS_PORT') : PORTS.LOCAL_5001,
  },
  
  firebase: {
    apiKey: ENV_IS_TEST ? 'test-api-key' : process.env.API_KEY || (ENV_IS_DEVELOPMENT ? 'development-api-key' : isBuildPhase ? 'placeholder-api-key' : (() => {
      throw new Error('API_KEY environment variable is required');
    })()),
    projectId,
  },
  
  clientConfig: (!process.env.CLIENT_API_KEY && !isBuildPhase) ? undefined : {
    apiKey: process.env.CLIENT_API_KEY || (isBuildPhase ? 'placeholder' : (() => {
      throw new Error('CLIENT_API_KEY environment variable is required');
    })()),
    authDomain: process.env.CLIENT_AUTH_DOMAIN || (isBuildPhase ? 'placeholder.firebaseapp.com' : (() => {
      throw new Error('CLIENT_AUTH_DOMAIN environment variable is required when CLIENT_API_KEY is set');
    })()),
    storageBucket: process.env.CLIENT_STORAGE_BUCKET || (isBuildPhase ? 'placeholder.firebasestorage.app' : (() => {
      throw new Error('CLIENT_STORAGE_BUCKET environment variable is required when CLIENT_API_KEY is set');
    })()),
    messagingSenderId: process.env.CLIENT_MESSAGING_SENDER_ID || (isBuildPhase ? 'placeholder' : (() => {
      throw new Error('CLIENT_MESSAGING_SENDER_ID environment variable is required when CLIENT_API_KEY is set');
    })()),
    appId: process.env.CLIENT_APP_ID || (isBuildPhase ? 'placeholder' : (() => {
      throw new Error('CLIENT_APP_ID environment variable is required when CLIENT_API_KEY is set');
    })()),
    measurementId: process.env.CLIENT_MEASUREMENT_ID,
  },
  
  document: {
    listLimit: DOCUMENT_CONFIG.LIST_LIMIT,
    previewLength: DOCUMENT_CONFIG.PREVIEW_LENGTH,
  },
  
  formDefaults: (ENV_IS_DEVELOPMENT && process.env.FUNCTIONS_EMULATOR === 'true') ? {
    displayName: 'test',
    email: 'test@test.com',
    password: 'rrRR44$$',
  } : undefined,
  
  warningBanner: ENV_IS_PRODUCTION ? '⚠️ this is a demo - your data will be deleted without notice' : (ENV_IS_DEVELOPMENT ? '⚠️ emulator data will not be retained' : ''),
};

// Configure emulators for development
export function configureEmulators() {
  if (!ENV_IS_PRODUCTION && process.env.FUNCTIONS_EMULATOR === 'true') {
    
    // Debug: Log environment variables
    functions.logger.info('Environment variables debug', {
      EMULATOR_AUTH_PORT: process.env.EMULATOR_AUTH_PORT,
      EMULATOR_FIRESTORE_PORT: process.env.EMULATOR_FIRESTORE_PORT,
      calculatedAuthPort: CONFIG.emulatorPorts.auth,
      calculatedFirestorePort: CONFIG.emulatorPorts.firestore,
    });
    
    process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${CONFIG.emulatorPorts.auth}`;
    process.env.FIRESTORE_EMULATOR_HOST = `localhost:${CONFIG.emulatorPorts.firestore}`;
    
    functions.logger.info('Configured Firebase emulators', {
      authPort: CONFIG.emulatorPorts.auth,
      firestorePort: CONFIG.emulatorPorts.firestore,
    });
    
    functions.logger.info('Configuring Firebase Admin for local emulators', {
      authEmulator: `localhost:${CONFIG.emulatorPorts.auth}`,
      firestoreEmulator: `localhost:${CONFIG.emulatorPorts.firestore}`
    });
  }
}

// Auto-configure emulators
configureEmulators();

