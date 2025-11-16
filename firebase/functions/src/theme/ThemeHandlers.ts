import { BrandingArtifactMetadata } from '@splitifyd/shared';
import type { RequestHandler } from 'express';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
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
        if (artifact.cssUrl.startsWith('file://')) {
            const path = fileURLToPath(artifact.cssUrl);
            return fs.readFile(path, 'utf8');
        }

        logger.error('Unsupported CSS artifact URL scheme', { cssUrl: artifact.cssUrl });
        throw new ApiError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'THEME_STORAGE_UNSUPPORTED', 'Theme storage backend not supported yet');
    }
}
