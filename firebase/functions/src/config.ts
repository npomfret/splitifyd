import { PORTS, RATE_LIMITS, DOCUMENT_CONFIG, HTTP_STATUS, SYSTEM, VALIDATION_LIMITS } from './constants';
import * as functions from 'firebase-functions';

const ENV_IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ENV_IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const ENV_IS_TEST = process.env.NODE_ENV === 'test';

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

// Always provide a fallback for development
const projectId = process.env.PROJECT_ID || (ENV_IS_TEST ? 'test-project' : 'splitifyd');

// Direct configuration values
export const CONFIG = {
  environment: process.env.NODE_ENV || 'development',
  isProduction: ENV_IS_PRODUCTION,
  isDevelopment: ENV_IS_DEVELOPMENT,
  isTest: ENV_IS_TEST,
  
  projectId,
  
  corsOrigins: ENV_IS_PRODUCTION 
    ? [`https://${projectId}.web.app`, `https://${projectId}.firebaseapp.com`]
    : ENV_IS_TEST
    ? [`http://localhost:${PORTS.LOCAL_3000}`, `http://localhost:${PORTS.LOCAL_5000}`]
    : [
        `http://localhost:${PORTS.LOCAL_3000}`, 
        `http://localhost:${PORTS.LOCAL_5000}`, 
        `http://localhost:${PORTS.LOCAL_5002}`,
        `http://127.0.0.1:${PORTS.LOCAL_5000}`,
        `http://127.0.0.1:${PORTS.LOCAL_5002}`
      ],
  
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
  
  corsOptions: {
    origin: ENV_IS_PRODUCTION 
      ? [`https://${projectId}.web.app`, `https://${projectId}.firebaseapp.com`]
      : ENV_IS_TEST
      ? [`http://localhost:${PORTS.LOCAL_3000}`, `http://localhost:${PORTS.LOCAL_5000}`]
      : [
          `http://localhost:${PORTS.LOCAL_3000}`, 
          `http://localhost:${PORTS.LOCAL_5000}`, 
          `http://localhost:${PORTS.LOCAL_5002}`,
          `http://127.0.0.1:${PORTS.LOCAL_5000}`,
          `http://127.0.0.1:${PORTS.LOCAL_5002}`
        ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: HTTP_STATUS.OK,
  },
  
  emulatorPorts: {
    auth: parseInteger(process.env.FIREBASE_AUTH_EMULATOR_PORT, PORTS.AUTH_EMULATOR),
    firestore: parseInteger(process.env.FIRESTORE_EMULATOR_PORT, PORTS.FIRESTORE_EMULATOR),
    functions: parseInteger(process.env.FIREBASE_FUNCTIONS_EMULATOR_PORT, PORTS.LOCAL_5001),
  },
  
  clientConfig: process.env.CLIENT_API_KEY ? {
    apiKey: process.env.CLIENT_API_KEY,
    authDomain: process.env.CLIENT_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    storageBucket: process.env.CLIENT_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
    messagingSenderId: process.env.CLIENT_MESSAGING_SENDER_ID || '',
    appId: process.env.CLIENT_APP_ID || '',
    measurementId: process.env.CLIENT_MEASUREMENT_ID,
  } : undefined,
  
  document: {
    listLimit: DOCUMENT_CONFIG.LIST_LIMIT,
    previewLength: DOCUMENT_CONFIG.PREVIEW_LENGTH,
  },
};

// Configure emulators for development
if (!ENV_IS_PRODUCTION) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${CONFIG.emulatorPorts.auth}`;
  process.env.FIRESTORE_EMULATOR_HOST = `localhost:${CONFIG.emulatorPorts.firestore}`;
  
  functions.logger.info('Configured Firebase emulators', {
    authPort: CONFIG.emulatorPorts.auth,
    firestorePort: CONFIG.emulatorPorts.firestore,
  });
}

// Simple exports for backward compatibility
export const { isProduction, isDevelopment, isTest } = CONFIG;