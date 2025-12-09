import { logger } from '../../logger';
import type { IStorage } from '../../storage-wrapper';
import type { ThemeArtifactLocation, ThemeArtifactPayload, ThemeArtifactStorage } from './ThemeArtifactStorage';

export class CloudThemeArtifactStorage implements ThemeArtifactStorage {
    private readonly storageEmulatorHost: string | null;

    constructor(
        private readonly storage: IStorage,
        storageEmulatorHost: string | null | undefined = process.env.FIREBASE_STORAGE_EMULATOR_HOST,
    ) {
        this.storageEmulatorHost = storageEmulatorHost ?? null;
    }

    async save(payload: ThemeArtifactPayload): Promise<ThemeArtifactLocation> {
        const bucket = this.storage.bucket();
        const { tenantId, hash, cssContent, tokensJson } = payload;

        const cssPath = `theme-artifacts/${tenantId}/${hash}/theme.css`;
        const tokensPath = `theme-artifacts/${tenantId}/${hash}/tokens.json`;

        const cssFile = bucket.file(cssPath);
        const tokensFile = bucket.file(tokensPath);

        // Upload both files in parallel
        await Promise.all([
            cssFile.save(cssContent, {
                metadata: {
                    contentType: 'text/css; charset=utf-8',
                    cacheControl: 'public, max-age=31536000, immutable',
                    metadata: {
                        tenantId,
                        hash,
                        generatedAt: new Date().toISOString(),
                    },
                },
            }),
            tokensFile.save(tokensJson, {
                metadata: {
                    contentType: 'application/json; charset=utf-8',
                    cacheControl: 'public, max-age=31536000, immutable',
                    metadata: {
                        tenantId,
                        hash,
                        generatedAt: new Date().toISOString(),
                    },
                },
            }),
        ]);

        // Make files publicly accessible
        await Promise.all([
            cssFile.makePublic(),
            tokensFile.makePublic(),
        ]);

        // Generate public URLs using Firebase Storage format (works with security rules)
        const cssUrl = this.generatePublicUrl(bucket.name, cssPath);
        const tokensUrl = this.generatePublicUrl(bucket.name, tokensPath);

        logger.info('Saved cloud theme artifacts', {
            tenantId,
            hash,
            cssUrl,
            tokensUrl,
        });

        return { cssUrl, tokensUrl };
    }

    private generatePublicUrl(bucketName: string, filePath: string): string {
        const encodedPath = encodeURIComponent(filePath);
        if (this.storageEmulatorHost) {
            // Emulator URL format: http://localhost:PORT/v0/b/BUCKET/o/PATH?alt=media
            return `http://${this.storageEmulatorHost}/v0/b/${bucketName}/o/${encodedPath}?alt=media`;
        } else {
            // Firebase Storage URL format (works with Firebase security rules)
            return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media`;
        }
    }
}
