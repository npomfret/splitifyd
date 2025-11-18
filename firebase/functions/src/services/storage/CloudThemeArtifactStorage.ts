import type * as admin from 'firebase-admin';
import { logger } from '../../logger';
import type { ThemeArtifactLocation, ThemeArtifactPayload, ThemeArtifactStorage } from './ThemeArtifactStorage';

export class CloudThemeArtifactStorage implements ThemeArtifactStorage {
    constructor(private readonly getStorageInstance: () => admin.storage.Storage) {}

    async save(payload: ThemeArtifactPayload): Promise<ThemeArtifactLocation> {
        const bucket = this.getStorageInstance().bucket();
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

        // Make files publicly readable
        await Promise.all([
            cssFile.makePublic(),
            tokensFile.makePublic(),
        ]);

        // Get public URLs - use emulator URL for test/dev environments
        let cssUrl: string;
        let tokensUrl: string;

        const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;

        if (storageHost) {
            // Emulator URL format: http://localhost:PORT/v0/b/BUCKET/o/PATH
            const baseUrl = `http://${storageHost}/v0/b/${bucket.name}/o`;
            cssUrl = `${baseUrl}/${encodeURIComponent(cssPath)}?alt=media`;
            tokensUrl = `${baseUrl}/${encodeURIComponent(tokensPath)}?alt=media`;
        } else {
            // Production URL format
            cssUrl = `https://storage.googleapis.com/${bucket.name}/${cssPath}`;
            tokensUrl = `https://storage.googleapis.com/${bucket.name}/${tokensPath}`;
        }

        logger.info('Saved cloud theme artifacts', {
            tenantId,
            hash,
            cssUrl,
            tokensUrl,
        });

        return { cssUrl, tokensUrl };
    }
}
