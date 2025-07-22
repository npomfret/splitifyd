interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

interface AppConfiguration {
  firebase: FirebaseConfig;
  firebaseAuthUrl?: string;
  environment: {
    warningBanner?: string;
  };
}

class FirebaseConfigManager {
  private configPromise: Promise<AppConfiguration> | null = null;
  private apiBaseUrl: string | null = null;

  setApiBaseUrl(url: string) {
    this.apiBaseUrl = url;
  }

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
        if (!this.apiBaseUrl) {
          throw new Error('API_BASE_URL is not set - call setApiBaseUrl() first');
        }
        
        const configUrl = `${this.apiBaseUrl}/api/config`;
        
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
}

export const firebaseConfigManager = new FirebaseConfigManager();

// Set up API base URL based on environment
const setupApiBaseUrl = () => {
  if (import.meta.env.DEV) {
    // Development - use local emulator
    firebaseConfigManager.setApiBaseUrl('http://127.0.0.1:5001/splitifyd/us-central1');
  } else {
    // Production - will be set by deployment
    const prodUrl = (window as any).API_BASE_URL;
    if (prodUrl) {
      firebaseConfigManager.setApiBaseUrl(prodUrl);
    } else {
      console.warn('API_BASE_URL not set in production');
    }
  }
};

setupApiBaseUrl();