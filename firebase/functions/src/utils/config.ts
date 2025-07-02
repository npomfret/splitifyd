import { Response } from 'express';
import { CONFIG } from '../config/config';
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
  const clientConfig = CONFIG.firebase.clientConfig;
  
  if (!clientConfig) {
    sendError(res, Errors.INTERNAL_ERROR());
    return;
  }
  
  res.json({
    ...clientConfig,
    projectId: CONFIG.firebase.projectId
  } as FirebaseConfigResponse);
};