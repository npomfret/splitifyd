import { CONFIG, APP_CONFIG } from '../config';
import { Errors } from './errors';
import { logger } from '../logger';
import { AppConfiguration, FirebaseConfig, ApiConfig, EnvironmentConfig, EmulatorPorts, WarningBanner, AppMetadata } from '../types/config.types';
import { validateAppConfiguration } from '../middleware/config-validation';

export interface FirebaseConfigResponse {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  formDefaults?: {
    displayName?: string;
    email?: string;
    password?: string;
  };
  warningBanner?: string;
}

function getApiBaseUrl(): string {
  if (CONFIG.isProduction) {
    return '/api';
  }
  
  const functionsPort = CONFIG.emulatorPorts?.functions || 5001;
  return `http://localhost:${functionsPort}/${CONFIG.projectId}/us-central1/api`;
}

function getEmulatorPort(envVar: string): number | undefined {
  const value = process.env[envVar];
  if (!value) return undefined;
  
  const match = value.match(/:(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  return undefined;
}

function getWarningBanner(): WarningBanner | undefined {
  if (!CONFIG.warningBanner) return undefined;
  
  return {
    enabled: true,
    message: CONFIG.warningBanner
  };
}

function getAppMetadata(): AppMetadata {
  return {
    name: APP_CONFIG.appName,
    displayName: APP_CONFIG.appDisplayName, 
    firebaseProjectId: APP_CONFIG.firebaseProjectId,
    productionBaseUrl: APP_CONFIG.productionBaseUrl,
    apiBaseUrl: APP_CONFIG.apiBaseUrl
  };
}

export const getFirebaseConfigResponse = (): FirebaseConfigResponse => {
  const clientConfig = CONFIG.clientConfig;
  
  if (!clientConfig) {
    logger.error('Client config is undefined. Environment variables:', {
      CLIENT_API_KEY: process.env.CLIENT_API_KEY,
      NODE_ENV: process.env.NODE_ENV,
      FUNCTIONS_EMULATOR: process.env.FUNCTIONS_EMULATOR
    });
    throw Errors.INTERNAL_ERROR();
  }
  
  return {
    ...clientConfig,
    projectId: CONFIG.projectId,
    formDefaults: CONFIG.formDefaults,
    warningBanner: CONFIG.warningBanner
  } as FirebaseConfigResponse;
};

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
    measurementId: clientConfig.measurementId
  };
  
  const api: ApiConfig = {
    baseUrl: getApiBaseUrl(),
    timeout: 30000,
    retryAttempts: 3
  };
  
  const environment: EnvironmentConfig = {
    isDevelopment: Boolean(CONFIG.isDevelopment),
    isProduction: Boolean(CONFIG.isProduction),
    isEmulator: process.env.FUNCTIONS_EMULATOR === 'true',
    warningBanner: getWarningBanner()
  };
  
  if (environment.isEmulator) {
    const emulatorPorts: EmulatorPorts = {
      auth: getEmulatorPort('FIREBASE_AUTH_EMULATOR_HOST'),
      firestore: getEmulatorPort('FIRESTORE_EMULATOR_HOST'),
      functions: getEmulatorPort('FIREBASE_FUNCTIONS_EMULATOR_HOST') || CONFIG.emulatorPorts?.functions,
      hosting: getEmulatorPort('FIREBASE_HOSTING_EMULATOR_HOST')
    };
    environment.emulatorPorts = emulatorPorts;
  }
  
  const appConfig: AppConfiguration = {
    firebase,
    api,
    features: {},
    environment,
    app: getAppMetadata()
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