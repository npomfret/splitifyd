import { CONFIG } from '../config';
import { Errors } from './errors';
import { logger } from '../logger';

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