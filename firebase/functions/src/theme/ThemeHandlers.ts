import { BrandingArtifactMetadata } from '@billsplit-wl/shared';
import type { RequestHandler } from 'express';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import type { IFirestoreReader } from '../services/firestore';
import { ApiError } from '../utils/errors';

export class ThemeHandlers {
    constructor(private readonly firestoreReader: IFirestoreReader) {}

    serveThemeCss: RequestHandler = async (req, res) => {
        const tenantContext = req.tenant;

        if (!tenantContext) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'TENANT_NOT_FOUND', 'Unable to resolve tenant for this request');
        }

        const record = await this.firestoreReader.getTenantById(tenantContext.tenantId);
        const artifact = record?.brandingTokens?.artifact;

        if (!artifact) {
            logger.warn('theme-artifact-missing', { tenantId: tenantContext.tenantId });
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.status(HTTP_STATUS.OK).send('/* No theme published for this tenant */\n');
            return;
        }

        const cssContent = await this.readCssContent(artifact);

        res.setHeader('Content-Type', 'text/css; charset=utf-8');

        // Content-addressed caching: when ?v=hash is present, cache aggressively since content is immutable
        // Otherwise, use no-cache to ensure browsers check for updates
        const requestedVersion = req.query.v;
        if (requestedVersion) {
            // Version parameter present - enable aggressive caching
            // The presence of ?v= indicates the client is requesting a specific immutable version
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
            // No version - use no-cache so browsers always check for updates
            res.setHeader('Cache-Control', 'no-cache');
        }

        res.setHeader('ETag', `"${artifact.hash}"`);
        res.setHeader('Last-Modified', new Date(artifact.generatedAtEpochMs).toUTCString());

        res.status(HTTP_STATUS.OK).send(cssContent);
    };

    private async readCssContent(artifact: BrandingArtifactMetadata): Promise<string> {
        // Accept both https:// (production) and http:// (emulator)
        if (!artifact.cssUrl.startsWith('https://') && !artifact.cssUrl.startsWith('http://')) {
            logger.error('Invalid CSS artifact URL - must be HTTP(S)', { cssUrl: artifact.cssUrl });
            throw new ApiError(
                HTTP_STATUS.SERVICE_UNAVAILABLE,
                'THEME_STORAGE_INVALID',
                'Theme CSS URL must be HTTP(S)',
            );
        }

        const response = await fetch(artifact.cssUrl);
        if (!response.ok) {
            throw new ApiError(
                HTTP_STATUS.SERVICE_UNAVAILABLE,
                'THEME_FETCH_FAILED',
                `Failed to fetch theme from Cloud Storage: ${response.status}`,
            );
        }
        return response.text();
    }
}
