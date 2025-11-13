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
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'THEME_ARTIFACT_MISSING', 'Tenant has no published theme');
        }

        const cssContent = await this.readCssContent(artifact);

        res.setHeader('Content-Type', 'text/css; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
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
