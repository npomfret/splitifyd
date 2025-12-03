import { BrandingArtifactMetadata } from '@billsplit-wl/shared';
import type { RequestHandler } from 'express';
import { getAppConfig } from '../app-config';
import { HTTP_STATUS } from '../constants';
import { Errors } from '../errors';
import { logger } from '../logger';
import type { IFirestoreReader } from '../services/firestore';
import type { TenantRegistryService } from '../services/tenant/TenantRegistryService';

export class ThemeHandlers {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly tenantRegistry: TenantRegistryService,
    ) {}

    serveThemeCss: RequestHandler = async (req, res) => {
        const host = req.headers['x-forwarded-host'] as string | undefined
            ?? req.headers.host
            ?? req.hostname
            ?? null;

        const tenantContext = await this.tenantRegistry.resolveTenant({ host });

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

        const config = getAppConfig();
        const requestedVersion = req.query.v;
        if (requestedVersion) {
            res.setHeader('Cache-Control', `public, max-age=${config.cache.themeVersioned}, immutable`);
        } else {
            const maxAge = config.cache.themeUnversioned;
            res.setHeader('Cache-Control', maxAge > 0 ? `public, max-age=${maxAge}` : 'no-cache');
        }

        res.setHeader('ETag', `"${artifact.hash}"`);
        res.setHeader('Last-Modified', new Date(artifact.generatedAtEpochMs).toUTCString());

        res.status(HTTP_STATUS.OK).send(cssContent);
    };

    private async readCssContent(artifact: BrandingArtifactMetadata): Promise<string> {
        // Accept both https:// (production) and http:// (emulator)
        if (!artifact.cssUrl.startsWith('https://') && !artifact.cssUrl.startsWith('http://')) {
            logger.error('Invalid CSS artifact URL - must be HTTP(S)', { cssUrl: artifact.cssUrl });
            throw Errors.unavailable('THEME_STORAGE_INVALID');
        }

        const response = await fetch(artifact.cssUrl);
        if (!response.ok) {
            throw Errors.unavailable('THEME_FETCH_FAILED');
        }
        return response.text();
    }
}
