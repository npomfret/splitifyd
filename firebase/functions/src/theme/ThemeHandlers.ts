import { BrandingArtifactMetadata } from '@billsplit-wl/shared';
import type { RequestHandler } from 'express';
import { getAppConfig } from '../app-config';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import type { IFirestoreReader } from '../services/firestore';
import type { TenantRegistryService } from '../services/tenant/TenantRegistryService';

/** Error thrown when CSS fetch from storage fails. */
class CssFetchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CssFetchError';
    }
}

/** Error thrown when storage URL is invalid. */
class StorageConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'StorageConfigError';
    }
}

export class ThemeHandlers {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly tenantRegistry: TenantRegistryService,
    ) {}

    /**
     * Serves the tenant's theme CSS.
     *
     * Always returns Content-Type: text/css to prevent MIME type errors in browsers.
     * Errors are returned as CSS comments with appropriate HTTP status codes:
     * - 200: Success or no theme published (valid state)
     * - 500: Storage configuration or fetch errors
     * - 503: Tenant resolution failures
     *
     * This approach ensures:
     * 1. Browsers always receive valid CSS (even if empty/comment)
     * 2. Monitoring tools see proper error status codes
     * 3. No "empty MIME type" errors from missing Content-Type
     */
    serveThemeCss: RequestHandler = async (req, res) => {
        // Set Content-Type immediately - this endpoint ALWAYS returns CSS.
        // This prevents "empty MIME type" errors regardless of response path.
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
            // Map error types to appropriate HTTP status codes.
            // Content-Type is already set to text/css, so browsers handle gracefully.
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const sanitizedMessage = errorMessage.replace(/\*\//g, '* /');

            const status = this.getErrorStatusCode(error);
            logger.error('theme-css-error', error, { path: req.path, status });

            res.status(status).send(`/* Theme error: ${sanitizedMessage} */\n`);
        }
    };

    private getErrorStatusCode(error: unknown): number {
        if (error instanceof StorageConfigError || error instanceof CssFetchError) {
            return HTTP_STATUS.INTERNAL_ERROR; // 500
        }
        // Tenant resolution failures or unknown errors
        return HTTP_STATUS.SERVICE_UNAVAILABLE; // 503
    }

    private async readCssContent(artifact: BrandingArtifactMetadata): Promise<string> {
        // Accept both https:// (production) and http:// (emulator)
        if (!artifact.cssUrl.startsWith('https://') && !artifact.cssUrl.startsWith('http://')) {
            logger.error('Invalid CSS artifact URL - must be HTTP(S)', { cssUrl: artifact.cssUrl });
            throw new StorageConfigError('Invalid theme storage URL');
        }

        const response = await fetch(artifact.cssUrl);
        if (!response.ok) {
            throw new CssFetchError(`Failed to fetch theme CSS: ${response.status}`);
        }
        return response.text();
    }
}
