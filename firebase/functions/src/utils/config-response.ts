import { CONFIG } from '../config';
import { Errors } from './errors';
import { logger } from '../logger';
import { AppConfiguration, FirebaseConfig, ApiConfig, EnvironmentConfig, WarningBanner } from '../types/config.types';
import { validateAppConfiguration } from '../middleware/config-validation';

function getFirebaseAuthUrl(): string | undefined {
  if (CONFIG.isProduction) {
    return undefined;
  }
  
  // Get auth URL from Firebase environment variable if available
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (authHost) {
    return `http://${authHost}`;
  }
  
  // Default fallback
  return 'http://localhost:9099';
}

function getWarningBanner(): WarningBanner | undefined {
  if (!CONFIG.warningBanner) return undefined;
  
  return {
    enabled: true,
    message: CONFIG.warningBanner
  };
}



export const getEnhancedConfigResponse = (): AppConfiguration => {
  const clientConfig = CONFIG.clientConfig;
  
  if (!clientConfig) {
    logger.error('Client config is undefined. Environment variables:', {
      CLIENT_API_KEY: process.env.CLIENT_API_KEY,
      NODE_ENV: process.env.NODE_ENV,
      FUNCTIONS_EMULATOR: process.env.FUNCTIONS_EMULATOR
    });
    throw Errors.INTERNAL_ERROR();
  }
  
  const firebase: FirebaseConfig = {
    apiKey: clientConfig.apiKey,
    authDomain: clientConfig.authDomain,
    projectId: CONFIG.projectId,
    storageBucket: clientConfig.storageBucket,
    messagingSenderId: clientConfig.messagingSenderId,
    appId: clientConfig.appId,
    measurementId: clientConfig.measurementId,
    firebaseAuthUrl: getFirebaseAuthUrl()
  };
  
  const api: ApiConfig = {
    timeout: 30000,
    retryAttempts: 3
  };
  
  const environment: EnvironmentConfig = {
    isDevelopment: Boolean(CONFIG.isDevelopment),
    isProduction: Boolean(CONFIG.isProduction),
    warningBanner: getWarningBanner()
  };
  
  const appConfig: AppConfiguration = {
    firebase,
    api,
    features: {},
    environment
  };
  
  // Include form defaults for development environments only
  if (CONFIG.formDefaults) {
    appConfig.formDefaults = CONFIG.formDefaults;
  }
  
  try {
    return validateAppConfiguration(appConfig);
  } catch (error) {
    logger.error('Configuration validation failed', { 
      errorMessage: error instanceof Error ? error.message : String(error), 
      appConfig 
    });
    throw Errors.INTERNAL_ERROR();
  }
};