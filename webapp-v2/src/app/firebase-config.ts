import type { AppConfiguration } from '@splitifyd/shared';
import { ApiError, apiClient } from './apiClient';

class FirebaseConfigManager {
    private configPromise: Promise<AppConfiguration> | null = null;

    async getConfig(): Promise<AppConfiguration> {
        if (!this.configPromise) {
            this.configPromise = this.fetchConfig();
        }

        return this.configPromise;
    }

    private async fetchConfig(): Promise<AppConfiguration> {
        try {
            return await apiClient.getAppConfig();
        } catch (error) {
            // Preserve abort semantics from the API client so callers can break out cleanly.
            if (error instanceof ApiError && error.details instanceof Error && error.details.name === 'AbortError') {
                throw error;
            }

            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to fetch config: ${message}`);
        }
    }
}

export const firebaseConfigManager = new FirebaseConfigManager();
