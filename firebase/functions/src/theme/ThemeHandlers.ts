import { BrandingArtifactMetadata } from '@billsplit-wl/shared';
import type { RequestHandler } from 'express';
import { getAppConfig } from '../app-config';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import type { IFirestoreReader } from '../services/firestore';
import type { TenantRegistryService } from '../services/tenant/TenantRegistryService';

export class ThemeHandlers {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly tenantRegistry: TenantRegistryService,
    ) {}

    /**
     * Serves the tenant's theme CSS.
     *
     * This endpoint ALWAYS returns CSS with Content-Type: text/css.
     * Errors are returned as CSS comments rather than JSON because:
     * 1. Browsers expect CSS from <link> tags - JSON errors are useless to them
     * 2. Ensures consistent MIME type handling across all response paths
     * 3. Prevents "empty MIME type" errors when errors occur
     */
    serveThemeCss: RequestHandler = async (req, res) => {
        // Set Content-Type and Cache-Control immediately.
        // This endpoint ALWAYS returns CSS, even on errors.
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');

        try {
            const host = req.headers['x-forwarded-host'] as string | undefined
                ?? req.headers.host
                ?? req.hostname
                ?? null;

            const tenantContext = await this.tenantRegistry.resolveTenant({ host });

            const record = await this.firestoreReader.getTenantById(tenantContext.tenantId);
            const artifact = record?.tenant.brandingTokens?.artifact;

            if (!artifact) {
                logger.warn('theme-artifact-missing', { tenantId: tenantContext.tenantId });
                res.status(HTTP_STATUS.OK).send('/* No theme published for this tenant */\n');
                return;
            }

            const cssContent = await this.readCssContent(artifact);

            // Override cache headers for successful responses
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
        } catch (error) {
            // Return errors as CSS comments - JSON errors are useless to <link> tags.
            // Content-Type is already set to text/css, Cache-Control to no-cache.
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('theme-css-error', error, { path: req.path });
            res.status(HTTP_STATUS.OK).send(`/* Theme loading error: ${errorMessage.replace(/\*\//g, '* /')} */\n`);
        }
    };

    private async readCssContent(artifact: BrandingArtifactMetadata): Promise<string> {
        // Accept both https:// (production) and http:// (emulator)
        if (!artifact.cssUrl.startsWith('https://') && !artifact.cssUrl.startsWith('http://')) {
            logger.error('Invalid CSS artifact URL - must be HTTP(S)', { cssUrl: artifact.cssUrl });
            throw new Error('Invalid theme storage URL');
        }

        const response = await fetch(artifact.cssUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch theme CSS: ${response.status}`);
        }
        return response.text();
    }
}
