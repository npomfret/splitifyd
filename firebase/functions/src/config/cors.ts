/**
 * CORS configuration
 */

import { CorsConfig } from './types';
import { parseStringArray, getCurrentEnvironment } from './utils';

export function createCorsConfig(projectId: string): CorsConfig {
  const environment = getCurrentEnvironment();
  const isProduction = environment === 'production';
  const isTest = environment === 'test';

  const allowedOrigins = (() => {
    if (isProduction) {
      return parseStringArray(
        process.env.CORS_ALLOWED_ORIGINS,
        [`https://${projectId}.web.app`, `https://${projectId}.firebaseapp.com`]
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
  })();

  return {
    allowedOrigins,
    credentials: true,
  };
}