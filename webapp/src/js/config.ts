import { firebaseConfigManager } from './firebase-config.js';
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
    
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    
    if (isLocal) {
      return `http://${hostname}:5001/splitifyd/us-central1/api`;
    }
    
    return `${window.location.protocol}//${window.location.host}/api`;
  }

  isLocalEnvironment(): boolean {
    const hostname = window.location.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
  }

  async getConfig(): Promise<ConfigData> {
    if (!firebaseConfigManager.isInitialized()) {
      await firebaseConfigManager.initialize();
    }
    return firebaseConfigManager.getConfig();
  }
}

export const config = new Config();