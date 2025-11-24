import crypto from 'crypto';
import { getStorage } from '../../firebase';
import { logger } from '../../logger';
import { createStorage, type IStorage } from '../../storage-wrapper';

export type AssetType = 'logo' | 'favicon';

export interface TenantAssetStorage {
    uploadAsset(tenantId: string, assetType: AssetType, buffer: Buffer, contentType: string, oldUrl?: string): Promise<string>;
    deleteAsset(url: string): Promise<void>;
}

let _instance: TenantAssetStorage | undefined;

export interface TenantAssetStorageConfig {
    storage?: IStorage;
    storageEmulatorHost?: string | null;
}

/**
 * Factory function to create TenantAssetStorage with dependency injection support.
 *
 * @param config - Optional configuration for testing
 * @param config.storage - IStorage instance (defaults to production Firebase Storage)
 * @param config.storageEmulatorHost - Emulator host for URL generation (defaults to process.env.FIREBASE_STORAGE_EMULATOR_HOST)
 * @returns Singleton TenantAssetStorage instance
 */
export function createTenantAssetStorage(config?: IStorage | TenantAssetStorageConfig): TenantAssetStorage {
    if (!_instance) {
        // Support legacy signature: createTenantAssetStorage(storage)
        // and new signature: createTenantAssetStorage({ storage, storageEmulatorHost })
        let storage: IStorage;
        let storageEmulatorHost: string | null | undefined;

        if (config && 'bucket' in config) {
            // Legacy: IStorage passed directly
            storage = config;
            storageEmulatorHost = undefined; // Use default from process.env
        } else {
            // New: Config object
            const cfg = config as TenantAssetStorageConfig | undefined;
            storage = cfg?.storage ?? createStorage(getStorage());
            storageEmulatorHost = cfg?.storageEmulatorHost;
        }

        _instance = new CloudTenantAssetStorage(storage, storageEmulatorHost);
    }
    return _instance;
}

/**
 * Reset the singleton instance. Only used for testing.
 * @internal
 */
export function resetTenantAssetStorage(): void {
    _instance = undefined;
}

class CloudTenantAssetStorage implements TenantAssetStorage {
    private readonly storageEmulatorHost: string | null;

    constructor(
        private readonly storage: IStorage,
        storageEmulatorHost: string | null | undefined = process.env.FIREBASE_STORAGE_EMULATOR_HOST,
    ) {
        this.storageEmulatorHost = storageEmulatorHost ?? null;
    }

    async uploadAsset(
        tenantId: string,
        assetType: AssetType,
        buffer: Buffer,
        contentType: string,
        oldUrl?: string,
    ): Promise<string> {
        const bucket = this.storage.bucket();

        // Generate content hash for true immutability
        const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);
        const extension = this.getExtensionFromContentType(contentType);
        const filePath = `tenant-assets/${tenantId}/${assetType}-${hash}.${extension}`;

        const file = bucket.file(filePath);

        await file.save(buffer, {
            metadata: {
                contentType,
                cacheControl: 'public, max-age=31536000, immutable',
                metadata: {
                    tenantId,
                    assetType,
                    uploadedAt: new Date().toISOString(),
                    contentHash: hash,
                },
            },
        });

        // Make file publicly readable
        await file.makePublic();

        logger.info('Uploaded tenant asset', {
            tenantId,
            assetType,
            filePath,
            size: buffer.length,
            contentHash: hash,
        });

        // Generate public URL
        const url = this.generatePublicUrl(bucket.name, filePath);

        // Cleanup old asset after successful upload
        if (oldUrl && oldUrl !== url) {
            await this.deleteAsset(oldUrl);
        }

        return url;
    }

    async deleteAsset(url: string): Promise<void> {
        const bucket = this.storage.bucket();

        // Only delete assets we own (in our bucket)
        if (!url.includes(bucket.name)) {
            logger.info('Skipping deletion of external asset', { url });
            return;
        }

        try {
            const filePath = this.extractPathFromUrl(url);
            await bucket.file(filePath).delete();
            logger.info('Deleted tenant asset', { url, filePath });
        } catch (error) {
            // Don't throw - old files aren't critical
            logger.warn('Failed to delete tenant asset', { url, error });
        }
    }

    private generatePublicUrl(bucketName: string, filePath: string): string {
        if (this.storageEmulatorHost) {
            // Emulator URL format: http://localhost:PORT/v0/b/BUCKET/o/PATH?alt=media
            const baseUrl = `http://${this.storageEmulatorHost}/v0/b/${bucketName}/o`;
            return `${baseUrl}/${encodeURIComponent(filePath)}?alt=media`;
        } else {
            // Production URL format
            return `https://storage.googleapis.com/${bucketName}/${filePath}`;
        }
    }

    private extractPathFromUrl(url: string): string {
        // Handle both emulator and production URLs
        if (url.includes('/v0/b/')) {
            // Emulator URL: http://localhost:8006/v0/b/bucket/o/path?alt=media
            const match = url.match(/\/o\/([^?]+)/);
            return match ? decodeURIComponent(match[1]) : '';
        } else {
            // Production URL: https://storage.googleapis.com/bucket/path
            const match = url.match(/googleapis\.com\/[^/]+\/(.+)$/);
            return match ? match[1] : '';
        }
    }

    private getExtensionFromContentType(contentType: string): string {
        const map: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/svg+xml': 'svg',
            'image/webp': 'webp',
            'image/x-icon': 'ico',
            'image/vnd.microsoft.icon': 'ico',
        };

        return map[contentType.toLowerCase()] || 'bin';
    }
}
