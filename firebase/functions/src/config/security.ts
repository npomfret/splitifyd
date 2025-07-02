/**
 * Security configuration
 */

import { SecurityConfig } from './types';
import { parseInteger, getCurrentEnvironment } from './utils';

export function createSecurityConfig(): SecurityConfig {
  const environment = getCurrentEnvironment();
  const isProduction = environment === 'production';

  return {
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
}