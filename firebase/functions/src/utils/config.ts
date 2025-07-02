import { Response } from 'express';
import { CONFIG } from '../config/constants';

export interface FirebaseConfigResponse {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface ConfigErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export const getFirebaseConfigResponse = (res: Response): void => {
  const clientConfig = CONFIG.FIREBASE.clientConfig;
  
  if (!clientConfig) {
    res.status(500).json({
      error: {
        code: 'CONFIG_NOT_FOUND',
        message: 'Firebase configuration not found. Please set environment variables.'
      }
    } as ConfigErrorResponse);
    return;
  }
  
  res.json({
    ...clientConfig,
    projectId: CONFIG.FIREBASE.PROJECT_ID
  } as FirebaseConfigResponse);
};