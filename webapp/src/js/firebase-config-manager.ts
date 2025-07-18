import { logger } from './utils/logger.js';
import type { AppConfiguration } from './types/config.types.js';

class FirebaseConfigManager {
  private configPromise: Promise<AppConfiguration> | null = null;

  async getConfig(): Promise<AppConfiguration> {
    if (!this.configPromise) {
      this.configPromise = this.fetchConfig();
    }
    
    return this.configPromise;
  }

  private async fetchConfig(): Promise<AppConfiguration> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const apiBaseUrl = (window as any).API_BASE_URL;
        
        // Assert that API_BASE_URL is properly set
        if (apiBaseUrl === undefined) {
          throw new Error('API_BASE_URL is undefined - AppInit.setupApiBaseUrl() must be called first');
        }
        
        const configUrl = `${apiBaseUrl}/api/config`;
        
        // Assert that we don't have "undefined" in the URL
        if (configUrl.includes('undefined')) {
          throw new Error(`Invalid config URL: "${configUrl}" contains "undefined"`);
        }
        
        const response = await fetch(configUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Config fetch failed: ${response.status}`);
        }

        const config = await response.json();
        return config as AppConfiguration;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }
      }
    }

    throw new Error(`Failed to fetch config after ${maxRetries} attempts: ${lastError?.message}`);
  }

  // Convenience methods for common config access
  async getFormDefaults() {
    const config = await this.getConfig();
    return config.formDefaults;
  }

  async getWarningBanner() {
    const config = await this.getConfig();
    return config.environment.warningBanner;
  }

}

export const firebaseConfigManager = new FirebaseConfigManager();