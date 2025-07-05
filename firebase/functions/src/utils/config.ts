import { Response } from 'express';
import { CONFIG } from '../config';
import { Errors, sendError } from './errors';

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


export const getFirebaseConfigResponse = (res: Response): void => {
  const clientConfig = CONFIG.clientConfig;
  
  if (!clientConfig) {
    console.error('Client config is undefined. Environment variables:', {
      CLIENT_API_KEY: process.env.CLIENT_API_KEY,
      NODE_ENV: process.env.NODE_ENV,
      FUNCTIONS_EMULATOR: process.env.FUNCTIONS_EMULATOR
    });
    sendError(res, Errors.INTERNAL_ERROR());
    return;
  }
  
  res.json({
    ...clientConfig,
    projectId: CONFIG.projectId,
    formDefaults: CONFIG.formDefaults,
    warningBanner: CONFIG.warningBanner
  } as FirebaseConfigResponse);
};