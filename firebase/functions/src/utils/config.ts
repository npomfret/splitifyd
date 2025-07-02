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
}


export const getFirebaseConfigResponse = (res: Response): void => {
  const clientConfig = CONFIG.clientConfig;
  
  if (!clientConfig) {
    sendError(res, Errors.INTERNAL_ERROR());
    return;
  }
  
  res.json({
    ...clientConfig,
    projectId: CONFIG.projectId
  } as FirebaseConfigResponse);
};