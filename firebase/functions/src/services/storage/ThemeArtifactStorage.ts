import crypto from 'crypto';
import { getStorage } from '../../firebase';
import { createStorage, type IStorage } from '../../storage-wrapper';
import { CloudThemeArtifactStorage } from './CloudThemeArtifactStorage';

export interface ThemeArtifactPayload {
    tenantId: string;
    hash: string;
    cssContent: string;
    tokensJson: string;
}

export interface ThemeArtifactLocation {
    cssUrl: string;
    tokensUrl: string;
}

export interface ThemeArtifactStorage {
    save(payload: ThemeArtifactPayload): Promise<ThemeArtifactLocation>;
}

let _instance: ThemeArtifactStorage | undefined;

interface ThemeArtifactStorageConfig {
    storage?: IStorage;
    storageEmulatorHost?: string | null;
}

/**
 * Factory function to create ThemeArtifactStorage with dependency injection support.
 *
 * @param config - Optional configuration for testing
 * @param config.storage - IStorage instance (defaults to production Firebase Storage)
 * @param config.storageEmulatorHost - Emulator host for URL generation (defaults to process.env.FIREBASE_STORAGE_EMULATOR_HOST)
 * @returns Singleton ThemeArtifactStorage instance
 */
export function createThemeArtifactStorage(config?: IStorage | ThemeArtifactStorageConfig): ThemeArtifactStorage {
    if (!_instance) {
        // Support legacy signature: createThemeArtifactStorage(storage)
        // and new signature: createThemeArtifactStorage({ storage, storageEmulatorHost })
        let storage: IStorage;
        let storageEmulatorHost: string | null | undefined;

        if (config && 'bucket' in config) {
            // Legacy: IStorage passed directly
            storage = config;
            storageEmulatorHost = undefined; // Use default from process.env
        } else {
            // New: Config object
            const cfg = config as ThemeArtifactStorageConfig | undefined;
            storage = cfg?.storage ?? createStorage(getStorage());
            storageEmulatorHost = cfg?.storageEmulatorHost;
        }

        _instance = new CloudThemeArtifactStorage(storage, storageEmulatorHost);
    }
    return _instance;
}

/**
 * Reset the singleton instance. Only used for testing.
 * @internal
 */
export function resetThemeArtifactStorage(): void {
    _instance = undefined;
}

export function computeSha256(content: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
}
