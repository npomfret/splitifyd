/**
 * Configuration type definitions
 */

export type Environment = 'development' | 'test' | 'staging' | 'production';

export interface FirebaseConfig {
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
}

export interface CorsConfig {
  allowedOrigins: string[];
  credentials: boolean;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  structuredLogging: boolean;
  includeStackTrace: boolean;
}

export interface SecurityConfig {
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
}

export interface MonitoringConfig {
  enableHealthChecks: boolean;
  enableMetrics: boolean;
  performanceThresholds: {
    slowRequestMs: number;
    healthCheckTimeoutMs: number;
  };
}

export interface EnvironmentConfig {
  environment: Environment;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  firebase: FirebaseConfig;
  cors: CorsConfig;
  logging: LoggingConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
}