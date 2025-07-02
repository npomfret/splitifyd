import { EnvironmentConfig } from './types';
import { parseInteger, parseBoolean, parseStringArray, requireEnvVar, getCurrentEnvironment } from './utils';
import { logger } from '../utils/logger';

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
    return ['http://localhost:3000', 'http://localhost:5000'];
  }
  
  return parseStringArray(
    process.env.CORS_ALLOWED_ORIGINS,
    [
      'http://localhost:3000', 
      'http://localhost:5000', 
      'http://localhost:5002',
      'http://127.0.0.1:5000',
      'http://127.0.0.1:5002'
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
        auth: parseInteger(process.env.FIREBASE_AUTH_EMULATOR_PORT, 9099),
        firestore: parseInteger(process.env.FIRESTORE_EMULATOR_PORT, 8080),
        functions: parseInteger(process.env.FIREBASE_FUNCTIONS_EMULATOR_PORT, 5001),
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
        windowMs: parseInteger(process.env.RATE_LIMIT_WINDOW_MS, 60000),
        maxRequests: parseInteger(process.env.RATE_LIMIT_MAX_REQUESTS, isProduction ? 10 : 100),
        cleanupIntervalMs: parseInteger(process.env.RATE_LIMIT_CLEANUP_MS, 60000),
      },
      validation: {
        maxRequestSizeBytes: parseInteger(process.env.MAX_REQUEST_SIZE_BYTES, 1024 * 1024),
        maxObjectDepth: parseInteger(process.env.MAX_OBJECT_DEPTH, 10),
        maxStringLength: parseInteger(process.env.MAX_STRING_LENGTH, isProduction ? 50000 : 100000),
        maxPropertyCount: parseInteger(process.env.MAX_PROPERTY_COUNT, isProduction ? 500 : 1000),
        maxPropertyNameLength: parseInteger(process.env.MAX_PROPERTY_NAME_LENGTH, 200),
      },
    },
    monitoring: {
      enableHealthChecks: parseBoolean(process.env.ENABLE_HEALTH_CHECKS, true),
      enableMetrics: parseBoolean(process.env.ENABLE_METRICS, isProduction),
      performanceThresholds: {
        slowRequestMs: parseInteger(process.env.SLOW_REQUEST_THRESHOLD_MS, isProduction ? 1000 : 5000),
        healthCheckTimeoutMs: parseInteger(process.env.HEALTH_CHECK_TIMEOUT_MS, 5000),
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
    bodyLimit: `${Math.round(config.security.validation.maxRequestSizeBytes / (1024 * 1024))}mb`,
  },
  document: {
    maxSizeBytes: config.security.validation.maxRequestSizeBytes,
    listLimit: 100,
    previewLength: 100,
  },
  corsOptions: {
    origin: config.cors.allowedOrigins,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
  },
};

export const {
  environment,
  isProduction,
  isDevelopment,
  isTest,
} = CONFIG;