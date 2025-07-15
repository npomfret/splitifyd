import { logger } from './utils/logger.js';
import type { AppConfiguration } from './types/config.types.js';

class FirebaseConfigManager {
  private config: AppConfiguration | null = null;
  private configPromise: Promise<AppConfiguration> | null = null;

  async getConfig(): Promise<AppConfiguration> {
    if (this.config) return this.config;
    
    if (!this.configPromise) {
      this.configPromise = this.fetchConfig();
    }
    
    this.config = await this.configPromise;
    return this.config;
  }

  private async fetchConfig(): Promise<AppConfiguration> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const apiBaseUrl = (window as any).API_BASE_URL;
        const response = await fetch(`${apiBaseUrl}/api/config`, {
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