import { z } from 'zod';
import { RATE_LIMITS, DOCUMENT_CONFIG, SYSTEM, VALIDATION_LIMITS } from './constants';
import { AppConfiguration, FirebaseConfig, ApiConfig, EnvironmentConfig, WarningBanner } from './types/webapp-shared-types';
import { validateAppConfiguration } from './middleware/config-validation';
import { logger } from './logger';

// Cache for lazy-loaded configurations
let cachedConfig: Config | null = null;
let cachedAppConfig: AppConfiguration | null = null;
let cachedEnv: z.infer<typeof envSchema> | null = null;

// Define environment variable schema
const envSchema = z.object({
  FUNCTIONS_EMULATOR: z.string().optional(),
  GCLOUD_PROJECT: z.string().optional(),
  CLIENT_API_KEY: z.string().optional(),
  CLIENT_AUTH_DOMAIN: z.string().optional(),
  CLIENT_STORAGE_BUCKET: z.string().optional(),
  CLIENT_MESSAGING_SENDER_ID: z.string().optional(),
  CLIENT_APP_ID: z.string().optional(),
  CLIENT_MEASUREMENT_ID: z.string().optional(),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
  DEV_FORM_EMAIL: z.string().optional(),
  DEV_FORM_PASSWORD: z.string().optional(),
});

// Type for the CONFIG object
export interface Config {
  isProduction: boolean;
  isDevelopment: boolean;
  requestBodyLimit: string;
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
    cleanupIntervalMs: number;
  };
  validation: {
    maxRequestSizeBytes: number;
    maxObjectDepth: number;
    maxStringLength: number;
    maxPropertyCount: number;
    maxPropertyNameLength: number;
  };
  document: {
    listLimit: number;
    previewLength: number;
  };
  formDefaults: {
    displayName: string;
    email: string;
    password: string;
  };
  warningBanner: string;
}

// Lazy environment variable loader
function getEnv(): z.infer<typeof envSchema> {
  if (cachedEnv) return cachedEnv;
  
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
  
  // Load environment variables from .env file for local development
  if (isEmulator) {
    require('dotenv').config();
  }
  
  // Parse environment variables
  try {
    cachedEnv = envSchema.parse(process.env);
    return cachedEnv;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error('Invalid environment variables:', { error: errorObj });
    
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Environment variable validation failed: ${errorMessages}`);
    }
    throw new Error(`Environment variable validation failed: ${errorObj.message}`);
  }
}

// Build the CONFIG object lazily
function buildConfig(): Config {
  const env = getEnv();
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
  const isProduction = !isEmulator;
  
  // Validate required production variables
  if (isProduction) {
    const requiredVars = ['GCLOUD_PROJECT', 'CLIENT_API_KEY', 'CLIENT_AUTH_DOMAIN', 
                          'CLIENT_STORAGE_BUCKET', 'CLIENT_MESSAGING_SENDER_ID', 'CLIENT_APP_ID'];
    const missing = requiredVars.filter(key => !env[key as keyof typeof env]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
    }
  }
  
  return {
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
    formDefaults: {
      displayName: isEmulator ? 'test' : '',
      email: env.DEV_FORM_EMAIL || '',
      password: env.DEV_FORM_PASSWORD || '',
    },
    warningBanner: isProduction 
      ? '⚠️ this is a demo - your data will be deleted without notice' 
      : '⚠️ emulator data will not be retained',
  };
}

// Export lazy getter for CONFIG
export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = buildConfig();
  }
  return cachedConfig;
}

// Helper functions for building AppConfiguration
function getFirebaseAuthUrl(config: Config, env: z.infer<typeof envSchema>): string | undefined {
  if (config.isProduction) {
    return undefined;
  }
  
  // Get auth URL from Firebase environment variable - required in development
  const authHost = env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!authHost) {
    throw new Error('FIREBASE_AUTH_EMULATOR_HOST environment variable must be set in development. Set it in your .env file.');
  }
  
  return `http://${authHost}`;
}

function getWarningBanner(config: Config): WarningBanner | undefined {
  if (!config.warningBanner) return undefined;
  
  return {
    enabled: true,
    message: config.warningBanner
  };
}

// Build the complete AppConfiguration lazily
function buildAppConfiguration(): AppConfiguration {
  const config = getConfig();
  const env = getEnv();
  const projectId = config.isProduction ? env.GCLOUD_PROJECT! : 'emulator-project-id';
  
  // Build firebase config based on environment
  const firebase: FirebaseConfig = config.isProduction ? {
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
  if (config.isProduction && (!firebase.apiKey || !firebase.authDomain || !firebase.storageBucket || !firebase.messagingSenderId || !firebase.appId)) {
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
    warningBanner: getWarningBanner(config)
  };
  
  const appConfig: AppConfiguration = {
    firebase,
    api,
    environment,
    formDefaults: config.formDefaults,
    firebaseAuthUrl: getFirebaseAuthUrl(config, env)
  };
  
  return appConfig;
}

// Export lazy getter for APP_CONFIG
export function getAppConfig(): AppConfiguration {
  if (!cachedAppConfig) {
    try {
      const builtConfig = buildAppConfiguration();
      const config = getConfig();
      
      // Skip validation in development since we're using dummy values
      if (config.isDevelopment) {
        cachedAppConfig = builtConfig;
      } else {
        // Validate in production
        cachedAppConfig = validateAppConfiguration(builtConfig);
      }
      
      logger.info('App configuration built and validated successfully');
    } catch (error) {
      logger.error('Failed to build or validate app configuration:', error instanceof Error ? error : new Error(String(error)));
      
      // Fail fast - don't let the app start with invalid configuration
      throw new Error(`Configuration error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return cachedAppConfig;
}