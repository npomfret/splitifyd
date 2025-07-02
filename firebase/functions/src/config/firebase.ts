/**
 * Firebase-specific configuration
 */

import { FirebaseConfig } from './types';
import { parseInteger, requireEnvVar, getCurrentEnvironment } from './utils';

export function createFirebaseConfig(): FirebaseConfig {
  const environment = getCurrentEnvironment();
  const isTest = environment === 'test';
  const isDevelopment = environment === 'development';

  return {
    projectId: requireEnvVar('PROJECT_ID', isTest ? 'test-project' : (isDevelopment ? 'splitifyd' : undefined)),
    clientConfig: process.env.CLIENT_API_KEY ? {
      apiKey: requireEnvVar('CLIENT_API_KEY'),
      authDomain: requireEnvVar('CLIENT_AUTH_DOMAIN'),
      storageBucket: requireEnvVar('CLIENT_STORAGE_BUCKET'),
      messagingSenderId: requireEnvVar('CLIENT_MESSAGING_SENDER_ID'),
      appId: requireEnvVar('CLIENT_APP_ID'),
      measurementId: process.env.CLIENT_MEASUREMENT_ID,
    } : undefined,
    emulatorPorts: {
      auth: parseInteger(process.env.FIREBASE_AUTH_EMULATOR_PORT, 9099),
      firestore: parseInteger(process.env.FIRESTORE_EMULATOR_PORT, 8080),
      functions: parseInteger(process.env.FIREBASE_FUNCTIONS_EMULATOR_PORT, 5001),
    },
  };
}