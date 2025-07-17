import { z } from 'zod';
import { RATE_LIMITS, DOCUMENT_CONFIG, SYSTEM, VALIDATION_LIMITS } from './constants';
import { AppConfiguration, FirebaseConfig, ApiConfig, EnvironmentConfig, WarningBanner } from './types/config.types';
import { validateAppConfiguration } from './middleware/config-validation';
import { logger } from './logger';

// FUNCTIONS_EMULATOR is an env var provided automatically by the emulator
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
const isProduction = !isEmulator;

// Load environment variables from .env file for local development
if (isEmulator) {
  require('dotenv').config();
}

// Define environment variable schema
const envSchema = z.object({
  FUNCTIONS_EMULATOR: z.string().optional(),
  GCLOUD_PROJECT: isProduction ? z.string().min(1) : z.string().optional(),
  CLIENT_API_KEY: isProduction ? z.string().min(1) : z.string().optional(),
  CLIENT_AUTH_DOMAIN: isProduction ? z.string().min(1) : z.string().optional(),
  CLIENT_STORAGE_BUCKET: isProduction ? z.string().min(1) : z.string().optional(),
  CLIENT_MESSAGING_SENDER_ID: isProduction ? z.string().min(1) : z.string().optional(),
  CLIENT_APP_ID: isProduction ? z.string().min(1) : z.string().optional(),
  CLIENT_MEASUREMENT_ID: z.string().optional(),
  FIREBASE_AUTH_EMULATOR_HOST: isEmulator ? z.string().min(1) : z.string().optional(),
  DEV_FORM_EMAIL: z.string().optional(),
  DEV_FORM_PASSWORD: z.string().optional(),
});

// Validate environment variables
let env: z.infer<typeof envSchema>;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  logger.error('Invalid environment variables:', { error: errorObj });
  
  if (error instanceof z.ZodError) {
    const errorMessages = error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Environment variable validation failed: ${errorMessages}`);
  }
  throw new Error(`Environment variable validation failed: ${errorObj.message}`);
}

// Get project ID (only needed in production)
const projectId = isProduction ? env.GCLOUD_PROJECT! : 'emulator-project-id';

// Direct configuration values
export const CONFIG = {
  isProduction,
  isDevelopment: isEmulator,
  
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
  
  
  
  document: {
    listLimit: DOCUMENT_CONFIG.LIST_LIMIT,
    previewLength: DOCUMENT_CONFIG.PREVIEW_LENGTH,
  },
  
  // Form defaults - from environment variables (empty in production)
  formDefaults: {
    displayName: isEmulator ? 'test' : '',
    email: env.DEV_FORM_EMAIL || '',
    password: env.DEV_FORM_PASSWORD || '',
  },
  
  warningBanner: isProduction 
    ? '⚠️ this is a demo - your data will be deleted without notice' 
    : '⚠️ emulator data will not be retained',
};

// Note: Emulator configuration is handled by environment variables set by Firebase CLI
// The FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST are automatically set
// when running in the emulator based on the ports configured in firebase.json

// Helper functions for building AppConfiguration
function getFirebaseAuthUrl(): string | undefined {
  if (CONFIG.isProduction) {
    return undefined;
  }
  
  // Get auth URL from Firebase environment variable - required in development
  const authHost = env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!authHost) {
    throw new Error('FIREBASE_AUTH_EMULATOR_HOST environment variable must be set in development. Set it in your .env file.');
  }
  
  return `http://${authHost}`;
}

function getWarningBanner(): WarningBanner | undefined {
  if (!CONFIG.warningBanner) return undefined;
  
  return {
    enabled: true,
    message: CONFIG.warningBanner
  };
}

// Build the complete AppConfiguration once at startup
function buildAppConfiguration(): AppConfiguration {
  // Build firebase config based on environment
  const firebase: FirebaseConfig = isProduction ? {
    apiKey: env.CLIENT_API_KEY!,
    authDomain: env.CLIENT_AUTH_DOMAIN!,
    projectId: projectId,
    storageBucket: env.CLIENT_STORAGE_BUCKET!,
    messagingSenderId: env.CLIENT_MESSAGING_SENDER_ID!,
    appId: env.CLIENT_APP_ID!,
    measurementId: env.CLIENT_MEASUREMENT_ID,
  } : {
    // Minimal config for development - these values are not used by the emulator
    apiKey: 'emulator-api-key',
    authDomain: 'localhost',
    projectId: projectId,
    storageBucket: 'emulator-storage',
    messagingSenderId: 'emulator-sender-id',
    appId: 'emulator-app-id',
    measurementId: undefined
  };
  
  // Validate required fields in production
  if (CONFIG.isProduction && (!firebase.apiKey || !firebase.authDomain || !firebase.storageBucket || !firebase.messagingSenderId || !firebase.appId)) {
    logger.error('Firebase config is incomplete in production. Environment variables:', {
      CLIENT_API_KEY: env.CLIENT_API_KEY,
      CLIENT_AUTH_DOMAIN: env.CLIENT_AUTH_DOMAIN,
      NODE_ENV: process.env.NODE_ENV,
      FUNCTIONS_EMULATOR: env.FUNCTIONS_EMULATOR
    });
    throw new Error('Firebase configuration is incomplete in production');
  }
  
  const api: ApiConfig = {
    timeout: 30000,
    retryAttempts: 3
  };
  
  const environment: EnvironmentConfig = {
    warningBanner: getWarningBanner()
  };
  
  const appConfig: AppConfiguration = {
    firebase,
    api,
    environment,
    formDefaults: CONFIG.formDefaults,
    firebaseAuthUrl: getFirebaseAuthUrl()
  };
  
  return appConfig;
}

// Build and validate the app configuration once at startup
let APP_CONFIG: AppConfiguration;
try {
  const builtConfig = buildAppConfiguration();
  
  // Skip validation in development since we're using dummy values
  if (CONFIG.isDevelopment) {
    APP_CONFIG = builtConfig;
  } else {
    // Validate in production
    APP_CONFIG = validateAppConfiguration(builtConfig);
  }
  
  logger.info('App configuration built and validated successfully');
} catch (error) {
  logger.error('Failed to build or validate app configuration:', error instanceof Error ? error : new Error(String(error)));
  
  // Fail fast - don't let the app start with invalid configuration
  throw new Error(`Configuration error: ${error instanceof Error ? error.message : String(error)}`);
}

// Export the pre-built, validated configuration
export { APP_CONFIG };