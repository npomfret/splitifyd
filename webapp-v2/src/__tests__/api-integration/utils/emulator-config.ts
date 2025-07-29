import { readFileSync } from 'fs';
import { join } from 'path';
import { findProjectRoot } from '../../../e2e/helpers/emulator-utils';

/**
 * Get Firebase emulator configuration from firebase.json
 */
function getEmulatorConfig() {
  const projectRoot = findProjectRoot();
  const firebaseConfigPath = join(projectRoot, 'firebase', 'firebase.json');
  const firebaseConfig = JSON.parse(readFileSync(firebaseConfigPath, 'utf-8'));
  
  return {
    hosting: {
      port: firebaseConfig.emulators?.hosting?.port || 6002,
    },
    functions: {
      port: firebaseConfig.emulators?.functions?.port || 6001,
    },
  };
}

const config = getEmulatorConfig();

export const EMULATOR_CONFIG = {
  HOSTING_PORT: config.hosting.port,
  FUNCTIONS_PORT: config.functions.port,
  HOSTING_URL: `http://localhost:${config.hosting.port}`,
  API_BASE_URL: `http://localhost:${config.functions.port}/splitifyd/us-central1`,
};