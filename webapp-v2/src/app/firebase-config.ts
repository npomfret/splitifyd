import type { WarningBanner } from '@shared/shared-types';

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
    firebaseFirestoreUrl?: string;
    environment: {
        warningBanner?: WarningBanner;
    };
    formDefaults: {
        displayName?: string;
        email?: string;
        password?: string;
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
                    await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
                }
            }
        }

        throw new Error(`Failed to fetch config after ${maxRetries} attempts: ${lastError?.message}`);
    }
}

export const firebaseConfigManager = new FirebaseConfigManager();

// Set up API base URL from window object (injected during build)
const setupApiBaseUrl = () => {
    // Skip during SSG
    if (typeof window === 'undefined') {
        return;
    }

    const apiBaseUrl = (window as any).API_BASE_URL;
    if (!apiBaseUrl) {
        throw new Error('API_BASE_URL is not set - check build configuration');
    }
    firebaseConfigManager.setApiBaseUrl(apiBaseUrl);
};

setupApiBaseUrl();
