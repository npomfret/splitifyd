/**
 * Configuration validation
 */

import { EnvironmentConfig } from './types';

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
    // In production, we should not have localhost origins
    const hasLocalhostOrigin = config.cors.allowedOrigins.some(origin => 
      origin.includes('localhost') || origin.includes('127.0.0.1')
    );
    
    if (hasLocalhostOrigin) {
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