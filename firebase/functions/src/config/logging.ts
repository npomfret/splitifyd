/**
 * Logging configuration
 */

import { LoggingConfig } from './types';
import { parseBoolean, getCurrentEnvironment } from './utils';

export function createLoggingConfig(): LoggingConfig {
  const environment = getCurrentEnvironment();
  const isProduction = environment === 'production';

  const level = (() => {
    const level = process.env.LOG_LEVEL?.toLowerCase();
    const validLevels = ['debug', 'info', 'warn', 'error'];
    
    if (level && validLevels.includes(level)) {
      return level as 'debug' | 'info' | 'warn' | 'error';
    }
    
    return isProduction ? 'info' : 'debug';
  })();

  return {
    level,
    structuredLogging: parseBoolean(process.env.STRUCTURED_LOGGING, isProduction),
    includeStackTrace: parseBoolean(process.env.INCLUDE_STACK_TRACE, !isProduction),
  };
}