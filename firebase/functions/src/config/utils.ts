/**
 * Configuration utility functions
 */

import { Environment } from './types';

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
export function parseStringArray(value: string | undefined, defaultValue: string[]): string[] {
  if (!value) return defaultValue;
  return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Parse integer with default value
 */
export function parseInteger(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse boolean with default value
 */
export function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Validate required environment variable
 */
export function requireEnvVar(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}