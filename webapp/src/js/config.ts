import { firebaseConfigManager } from './firebase-config-manager.js';
import type { ConfigData } from './types/global';
import type { AppConfiguration } from './types/config.types.js';

class Config {
  async getApiUrl(): Promise<string> {
    return await firebaseConfigManager.getApiBaseUrl();
  }

  async isLocalEnvironment(): Promise<boolean> {
    const env = await firebaseConfigManager.getEnvironment();
    return env.isDevelopment || env.isEmulator;
  }

  async getConfig(): Promise<ConfigData> {
    const appConfig = await firebaseConfigManager.getConfig();
    // Transform to legacy format for backward compatibility
    return {
      firebaseConfig: appConfig.firebase,
      apiUrl: appConfig.api.baseUrl,
      isLocal: appConfig.environment.isDevelopment || appConfig.environment.isEmulator,
      formDefaults: appConfig.formDefaults,
      warningBanner: appConfig.environment.warningBanner?.message
    };
  }

  // New methods for enhanced config access
  async getFullConfig(): Promise<AppConfiguration> {
    return await firebaseConfigManager.getConfig();
  }

  async getEnvironment() {
    return await firebaseConfigManager.getEnvironment();
  }

  async getFeatures() {
    const config = await firebaseConfigManager.getConfig();
    return config.features;
  }

  async getApiConfig() {
    const config = await firebaseConfigManager.getConfig();
    return config.api;
  }
}

export const config = new Config();