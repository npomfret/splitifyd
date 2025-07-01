import * as functions from 'firebase-functions';
import express from 'express';
import cors from 'cors';
import { authenticate } from '../auth/middleware';
import { CONFIG } from '../config/constants';

const corsMiddleware = cors(CONFIG.CORS);

export const createAuthenticatedFunction = (
  handler: express.RequestHandler
): functions.HttpsFunction => {
  return functions.https.onRequest((req, res) => {
    corsMiddleware(req, res, () => {
      authenticate(req as any, res, (err?: any) => {
        if (err) return;
        handler(req as any, res, () => {});
      });
    });
  });
};