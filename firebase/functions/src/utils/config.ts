import { Response } from 'express';
import { FLAT_CONFIG as CONFIG } from '../config/config';
import { Errors, sendError } from './errors';

export interface FirebaseConfigResponse {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}


export const getFirebaseConfigResponse = (res: Response): void => {
  const clientConfig = CONFIG.FIREBASE.clientConfig;
  
  if (!clientConfig) {
    sendError(res, Errors.INTERNAL_ERROR());
    return;
  }
  
  res.json({
    ...clientConfig,
    projectId: CONFIG.FIREBASE.PROJECT_ID
  } as FirebaseConfigResponse);
};