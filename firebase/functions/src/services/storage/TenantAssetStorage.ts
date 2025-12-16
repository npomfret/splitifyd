import type { TenantImageId } from '@billsplit-wl/shared';
import crypto from 'crypto';
import { logger } from '../../logger';
import type { IStorage } from '../../storage-wrapper';

type AssetType = 'logo' | 'favicon';

export interface TenantAssetStorage {
    uploadAsset(tenantId: string, assetType: AssetType, buffer: Buffer, contentType: string, oldUrl?: string): Promise<string>;
    uploadLibraryImage(tenantId: string, imageId: TenantImageId, buffer: Buffer, contentType: string): Promise<string>;
    deleteAsset(url: string): Promise<void>;
}

export class CloudTenantAssetStorage implements TenantAssetStorage {
    constructor(
        private readonly storage: IStorage,
        private readonly storagePublicBaseUrl: string,
    ) {}

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

    async uploadLibraryImage(tenantId: string, imageId: TenantImageId, buffer: Buffer, contentType: string): Promise<string> {
        const bucket = this.storage.bucket();

        const extension = this.getExtensionFromContentType(contentType);
        const filePath = `tenant-assets/${tenantId}/library/${imageId}.${extension}`;

        const file = bucket.file(filePath);

        await file.save(buffer, {
            metadata: {
                contentType,
                cacheControl: 'public, max-age=31536000, immutable',
                metadata: {
                    tenantId,
                    imageId,
                    uploadedAt: new Date().toISOString(),
                },
            },
        });

        logger.info('Uploaded tenant library image', {
            tenantId,
            imageId,
            filePath,
            size: buffer.length,
        });

        // Generate public URL
        return this.generatePublicUrl(bucket.name, filePath);
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
        const encodedPath = encodeURIComponent(filePath);
        return `${this.storagePublicBaseUrl}/v0/b/${bucketName}/o/${encodedPath}?alt=media`;
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
