import { EnvironmentConfig } from './types';
import { parseInteger, parseBoolean, parseStringArray, requireEnvVar, getCurrentEnvironment } from './utils';
import { logger } from '../utils/logger';
import { PORTS, RATE_LIMITS, DOCUMENT_CONFIG, HTTP_STATUS, SYSTEM } from '../constants';

function validateConfig(config: EnvironmentConfig): void {
  const errors: string[] = [];

  if (!config.firebase.projectId) {
    errors.push('Firebase project ID is required');
  }

  if (config.cors.allowedOrigins.length === 0) {
    errors.push('At least one CORS origin must be configured');
  }

  if (config.isProduction) {
    const hasLocalhostOrigin = config.cors.allowedOrigins.some(origin => 
      origin.includes('localhost') || origin.includes('127.0.0.1')
    );
    
    if (hasLocalhostOrigin) {
      errors.push('Production should not allow localhost origins');
    }

    const requiredProdVars = ['PROJECT_ID'];
    for (const varName of requiredProdVars) {
      if (!process.env[varName]) {
        errors.push(`Production environment variable ${varName} is required`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Environment configuration validation failed:\n${errors.join('\n')}`);
  }
}

function configureEmulators(config: EnvironmentConfig): void {
  if (!config.isProduction) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${config.firebase.emulatorPorts.auth}`;
    process.env.FIRESTORE_EMULATOR_HOST = `localhost:${config.firebase.emulatorPorts.firestore}`;
    
    logger.info('Configured Firebase emulators', {
      authPort: config.firebase.emulatorPorts.auth,
      firestorePort: config.firebase.emulatorPorts.firestore,
    });
  }
}

function getCorsOrigins(isProduction: boolean, isTest: boolean, projectId: string): string[] {
  if (isProduction) {
    return parseStringArray(
      process.env.CORS_ALLOWED_ORIGINS,
      [`https://${projectId}.web.app`, `https://${projectId}.firebaseapp.com`]
    );
  }
  
  if (isTest) {
    return [`http://localhost:${PORTS.LOCAL_3000}`, `http://localhost:${PORTS.LOCAL_5000}`];
  }
  
  return parseStringArray(
    process.env.CORS_ALLOWED_ORIGINS,
    [
      `http://localhost:${PORTS.LOCAL_3000}`, 
      `http://localhost:${PORTS.LOCAL_5000}`, 
      `http://localhost:${PORTS.LOCAL_5002}`,
      `http://127.0.0.1:${PORTS.LOCAL_5000}`,
      `http://127.0.0.1:${PORTS.LOCAL_5002}`
    ]
  );
}

function getLogLevel(isProduction: boolean): 'debug' | 'info' | 'warn' | 'error' {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  const validLevels = ['debug', 'info', 'warn', 'error'];
  
  if (level && validLevels.includes(level)) {
    return level as 'debug' | 'info' | 'warn' | 'error';
  }
  
  return isProduction ? 'info' : 'debug';
}

function createConfig(): EnvironmentConfig {
  const environment = getCurrentEnvironment();
  const isProduction = environment === 'production';
  const isDevelopment = environment === 'development';
  const isTest = environment === 'test';

  const projectId = requireEnvVar('PROJECT_ID', isTest ? 'test-project' : (isDevelopment ? 'splitifyd' : undefined));

  return {
    environment,
    isProduction,
    isDevelopment,
    isTest,
    firebase: {
      projectId,
      clientConfig: process.env.CLIENT_API_KEY ? {
        apiKey: requireEnvVar('CLIENT_API_KEY'),
        authDomain: requireEnvVar('CLIENT_AUTH_DOMAIN'),
        storageBucket: requireEnvVar('CLIENT_STORAGE_BUCKET'),
        messagingSenderId: requireEnvVar('CLIENT_MESSAGING_SENDER_ID'),
        appId: requireEnvVar('CLIENT_APP_ID'),
        measurementId: process.env.CLIENT_MEASUREMENT_ID,
      } : undefined,
      emulatorPorts: {
        auth: parseInteger(process.env.FIREBASE_AUTH_EMULATOR_PORT, PORTS.AUTH_EMULATOR),
        firestore: parseInteger(process.env.FIRESTORE_EMULATOR_PORT, PORTS.FIRESTORE_EMULATOR),
        functions: parseInteger(process.env.FIREBASE_FUNCTIONS_EMULATOR_PORT, PORTS.LOCAL_5001),
      },
    },
    cors: {
      allowedOrigins: getCorsOrigins(isProduction, isTest, projectId),
      credentials: true,
    },
    logging: {
      level: getLogLevel(isProduction),
      structuredLogging: parseBoolean(process.env.STRUCTURED_LOGGING, isProduction),
      includeStackTrace: parseBoolean(process.env.INCLUDE_STACK_TRACE, !isProduction),
    },
    security: {
      rateLimiting: {
        windowMs: parseInteger(process.env.RATE_LIMIT_WINDOW_MS, RATE_LIMITS.WINDOW_MS),
        maxRequests: parseInteger(process.env.RATE_LIMIT_MAX_REQUESTS, isProduction ? RATE_LIMITS.PROD_MAX_REQUESTS : RATE_LIMITS.DEV_MAX_REQUESTS),
        cleanupIntervalMs: parseInteger(process.env.RATE_LIMIT_CLEANUP_MS, RATE_LIMITS.CLEANUP_INTERVAL_MS),
      },
      validation: {
        maxRequestSizeBytes: parseInteger(process.env.MAX_REQUEST_SIZE_BYTES, SYSTEM.BYTES_PER_KB * SYSTEM.BYTES_PER_KB),
        maxObjectDepth: parseInteger(process.env.MAX_OBJECT_DEPTH, 10),
        maxStringLength: parseInteger(process.env.MAX_STRING_LENGTH, isProduction ? DOCUMENT_CONFIG.PROD_MAX_STRING_LENGTH : DOCUMENT_CONFIG.DEV_MAX_STRING_LENGTH),
        maxPropertyCount: parseInteger(process.env.MAX_PROPERTY_COUNT, isProduction ? DOCUMENT_CONFIG.PROD_MAX_PROPERTY_COUNT : DOCUMENT_CONFIG.DEV_MAX_PROPERTY_COUNT),
        maxPropertyNameLength: parseInteger(process.env.MAX_PROPERTY_NAME_LENGTH, DOCUMENT_CONFIG.MAX_PROPERTY_NAME_LENGTH),
      },
    },
    monitoring: {
      enableHealthChecks: parseBoolean(process.env.ENABLE_HEALTH_CHECKS, true),
      enableMetrics: parseBoolean(process.env.ENABLE_METRICS, isProduction),
      performanceThresholds: {
        slowRequestMs: parseInteger(process.env.SLOW_REQUEST_THRESHOLD_MS, isProduction ? RATE_LIMITS.PROD_SLOW_REQUEST_MS : RATE_LIMITS.DEV_SLOW_REQUEST_MS),
        healthCheckTimeoutMs: parseInteger(process.env.HEALTH_CHECK_TIMEOUT_MS, RATE_LIMITS.HEALTH_CHECK_TIMEOUT_MS),
      },
    },
  };
}

const config = createConfig();
validateConfig(config);
configureEmulators(config);

export const CONFIG = {
  ...config,
  request: {
    bodyLimit: `${Math.round(config.security.validation.maxRequestSizeBytes / (SYSTEM.BYTES_PER_KB * SYSTEM.BYTES_PER_KB))}mb`,
  },
  document: {
    maxSizeBytes: config.security.validation.maxRequestSizeBytes,
    listLimit: DOCUMENT_CONFIG.LIST_LIMIT,
    previewLength: DOCUMENT_CONFIG.PREVIEW_LENGTH,
  },
  corsOptions: {
    origin: config.cors.allowedOrigins,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: HTTP_STATUS.OK,
  },
};

export const {
  environment,
  isProduction,
  isDevelopment,
  isTest,
} = CONFIG;