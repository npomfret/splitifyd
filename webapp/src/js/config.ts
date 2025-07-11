import { firebaseConfigManager } from './firebase-config.js';
import { getEnvironment, isLocalEnvironment } from './utils/env-loader.js';
import type { ConfigData } from './types/global';

class Config {
  constructor() {
  }

  async getApiUrl(): Promise<string> {
    if (!firebaseConfigManager.isInitialized()) {
      await firebaseConfigManager.initialize();
    }
    return firebaseConfigManager.getApiUrl();
  }

  getApiUrlSync(): string {
    if (firebaseConfigManager.isInitialized()) {
      return firebaseConfigManager.getApiUrl();
    }
    
    try {
      const env = getEnvironment();
      return env.API_BASE_URL;
    } catch (error) {
      throw new Error('Environment configuration not loaded. Cannot determine API URL.');
    }
  }

  isLocalEnvironment(): boolean {
    return isLocalEnvironment();
  }

  async getConfig(): Promise<ConfigData> {
    if (!firebaseConfigManager.isInitialized()) {
      await firebaseConfigManager.initialize();
    }
    return firebaseConfigManager.getConfig();
  }
}

export const config = new Config();