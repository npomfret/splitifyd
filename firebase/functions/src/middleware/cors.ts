import { CorsOptions } from 'cors';
import { CONFIG } from '../config';

export function getCorsOptions(): CorsOptions {
  if (CONFIG.isProduction) {
    return {
      origin: (origin, callback) => {
        const allowedOrigins = [
          `https://${CONFIG.projectId}.web.app`,
          `https://${CONFIG.projectId}.firebaseapp.com`
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
      exposedHeaders: ['X-Correlation-Id'],
      maxAge: 86400,
      optionsSuccessStatus: 200
    };
  }
  
  return {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
    exposedHeaders: ['X-Correlation-Id'],
    optionsSuccessStatus: 200
  };
}