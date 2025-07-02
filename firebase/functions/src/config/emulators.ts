/**
 * Firebase emulator configuration
 */

import { EnvironmentConfig } from './types';
import { logger } from '../utils/logger';

/**
 * Set up emulator configuration if in development/test
 */
export function configureEmulators(config: EnvironmentConfig): void {
  if (!config.isProduction) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${config.firebase.emulatorPorts.auth}`;
    process.env.FIRESTORE_EMULATOR_HOST = `localhost:${config.firebase.emulatorPorts.firestore}`;
    
    logger.info('Configured Firebase emulators', {
      authPort: config.firebase.emulatorPorts.auth,
      firestorePort: config.firebase.emulatorPorts.firestore,
    });
  }
}