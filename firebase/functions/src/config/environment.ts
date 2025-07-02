/**
 * Environment-specific configuration management
 * Centralizes all environment variable handling and validation
 */

import { logger } from '../utils/logger';

// Environment types
export type Environment = 'development' | 'test' | 'staging' | 'production';

// Configuration interface
export interface EnvironmentConfig {
  environment: Environment;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  firebase: {
    projectId: string;
    clientConfig?: {
      apiKey: string;
      authDomain: string;
      storageBucket: string;
      messagingSenderId: string;
      appId: string;
      measurementId?: string;
    };
    emulatorPorts: {
      auth: number;
      firestore: number;
      functions: number;
    };
  };
  cors: {
    allowedOrigins: string[];
    credentials: boolean;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    structuredLogging: boolean;
    includeStackTrace: boolean;
  };
  security: {
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
  };
  monitoring: {
    enableHealthChecks: boolean;
    enableMetrics: boolean;
    performanceThresholds: {
      slowRequestMs: number;
      healthCheckTimeoutMs: number;
    };
  };
}

/**
 * Get current environment from NODE_ENV or default to development
 */
export function getCurrentEnvironment(): Environment {
  const env = process.env.NODE_ENV?.toLowerCase() as Environment;
  const validEnvironments: Environment[] = ['development', 'test', 'staging', 'production'];
  
  return validEnvironments.includes(env) ? env : 'development';
}

/**
 * Parse comma-separated string into array
 */
function parseStringArray(value: string | undefined, defaultValue: string[]): string[] {
  if (!value) return defaultValue;
  return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Parse integer with default value
 */
function parseInteger(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse boolean with default value
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Validate required environment variable
 */
function requireEnvVar(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Create environment-specific configuration
 */
export function createEnvironmentConfig(): EnvironmentConfig {
  const environment = getCurrentEnvironment();
  const isProduction = environment === 'production';
  const isDevelopment = environment === 'development';
  const isTest = environment === 'test';

  // Firebase configuration
  const firebaseConfig = {
    projectId: requireEnvVar('PROJECT_ID', isTest ? 'test-project' : (isDevelopment ? 'splitifyd' : undefined)),
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
  };

  // CORS configuration based on environment
  const corsConfig = {
    allowedOrigins: (() => {
      if (isProduction) {
        return parseStringArray(
          process.env.CORS_ALLOWED_ORIGINS,
          [`https://${firebaseConfig.projectId}.web.app`, `https://${firebaseConfig.projectId}.firebaseapp.com`]
        );
      } else if (isTest) {
        return ['http://localhost:3000', 'http://localhost:5000'];
      } else {
        // Development - more permissive but still controlled
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
    })(),
    credentials: true,
  };

  // Logging configuration
  const loggingConfig = {
    level: (() => {
      const level = process.env.LOG_LEVEL?.toLowerCase();
      const validLevels = ['debug', 'info', 'warn', 'error'];
      
      if (level && validLevels.includes(level)) {
        return level as 'debug' | 'info' | 'warn' | 'error';
      }
      
      return isProduction ? 'info' : 'debug';
    })(),
    structuredLogging: parseBoolean(process.env.STRUCTURED_LOGGING, isProduction),
    includeStackTrace: parseBoolean(process.env.INCLUDE_STACK_TRACE, !isProduction),
  };

  // Security configuration
  const securityConfig = {
    rateLimiting: {
      windowMs: parseInteger(process.env.RATE_LIMIT_WINDOW_MS, 60000), // 1 minute
      maxRequests: parseInteger(process.env.RATE_LIMIT_MAX_REQUESTS, isProduction ? 10 : 100),
      cleanupIntervalMs: parseInteger(process.env.RATE_LIMIT_CLEANUP_MS, 60000),
    },
    validation: {
      maxRequestSizeBytes: parseInteger(process.env.MAX_REQUEST_SIZE_BYTES, 1024 * 1024), // 1MB
      maxObjectDepth: parseInteger(process.env.MAX_OBJECT_DEPTH, 10),
      maxStringLength: parseInteger(process.env.MAX_STRING_LENGTH, isProduction ? 50000 : 100000),
      maxPropertyCount: parseInteger(process.env.MAX_PROPERTY_COUNT, isProduction ? 500 : 1000),
      maxPropertyNameLength: parseInteger(process.env.MAX_PROPERTY_NAME_LENGTH, 200),
    },
  };

  // Monitoring configuration
  const monitoringConfig = {
    enableHealthChecks: parseBoolean(process.env.ENABLE_HEALTH_CHECKS, true),
    enableMetrics: parseBoolean(process.env.ENABLE_METRICS, isProduction),
    performanceThresholds: {
      slowRequestMs: parseInteger(process.env.SLOW_REQUEST_THRESHOLD_MS, isProduction ? 1000 : 5000),
      healthCheckTimeoutMs: parseInteger(process.env.HEALTH_CHECK_TIMEOUT_MS, 5000),
    },
  };

  return {
    environment,
    isProduction,
    isDevelopment,
    isTest,
    firebase: firebaseConfig,
    cors: corsConfig,
    logging: loggingConfig,
    security: securityConfig,
    monitoring: monitoringConfig,
  };
}

/**
 * Validate configuration and environment
 */
export function validateEnvironmentConfig(config: EnvironmentConfig): void {
  const errors: string[] = [];

  // Validate Firebase project ID
  if (!config.firebase.projectId) {
    errors.push('Firebase project ID is required');
  }

  // Validate CORS origins
  if (config.cors.allowedOrigins.length === 0) {
    errors.push('At least one CORS origin must be configured');
  }

  // Validate production-specific requirements
  if (config.isProduction) {
    // In production, we should have specific origins
    const hasWildcardOrigin = config.cors.allowedOrigins.some(origin => 
      origin.includes('localhost') || origin.includes('127.0.0.1')
    );
    
    if (hasWildcardOrigin) {
      errors.push('Production should not allow localhost origins');
    }

    // Validate required production environment variables
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

/**
 * Set up emulator configuration if in development/test
 */
export function configureEmulators(config: EnvironmentConfig): void {
  if (!config.isProduction) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${config.firebase.emulatorPorts.auth}`;
    process.env.FIRESTORE_EMULATOR_HOST = `localhost:${config.firebase.emulatorPorts.firestore}`;
    
    logger.info('Configured Firebase emulators', {
      authPort: config.firebase.emulatorPorts.auth,
      firestorePort: config.firebase.emulatorPorts.firestore,
    });
  }
}

// Create and validate configuration
export const ENV_CONFIG = createEnvironmentConfig();

// Validate configuration on module load
validateEnvironmentConfig(ENV_CONFIG);

// Configure emulators if needed
configureEmulators(ENV_CONFIG);

// Export convenience flags
export const {
  environment,
  isProduction,
  isDevelopment,
  isTest,
} = ENV_CONFIG;