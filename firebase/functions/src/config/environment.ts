/**
 * Environment configuration with lazy loading
 * Replaces the monolithic environment.ts file
 */

import { EnvironmentConfig } from './types';
import { getCurrentEnvironment } from './utils';
import { createFirebaseConfig } from './firebase';
import { createCorsConfig } from './cors';
import { createLoggingConfig } from './logging';
import { createSecurityConfig } from './security';
import { createMonitoringConfig } from './monitoring';
import { validateEnvironmentConfig } from './validation';
import { configureEmulators } from './emulators';

let _cachedConfig: EnvironmentConfig | null = null;

/**
 * Create environment-specific configuration
 */
function createEnvironmentConfig(): EnvironmentConfig {
  const environment = getCurrentEnvironment();
  const isProduction = environment === 'production';
  const isDevelopment = environment === 'development';
  const isTest = environment === 'test';

  // Create configuration sections
  const firebase = createFirebaseConfig();
  const cors = createCorsConfig(firebase.projectId);
  const logging = createLoggingConfig();
  const security = createSecurityConfig();
  const monitoring = createMonitoringConfig();

  return {
    environment,
    isProduction,
    isDevelopment,
    isTest,
    firebase,
    cors,
    logging,
    security,
    monitoring,
  };
}

/**
 * Get configuration with lazy loading and caching
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  if (_cachedConfig === null) {
    _cachedConfig = createEnvironmentConfig();
    validateEnvironmentConfig(_cachedConfig);
    configureEmulators(_cachedConfig);
  }
  return _cachedConfig;
}

/**
 * Reset cached configuration (useful for testing)
 */
export function resetEnvironmentConfig(): void {
  _cachedConfig = null;
}

// Export the configuration getter
export const ENV_CONFIG = getEnvironmentConfig();

// Export convenience flags for backward compatibility
export const {
  environment,
  isProduction,
  isDevelopment,
  isTest,
} = ENV_CONFIG;