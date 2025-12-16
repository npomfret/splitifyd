import type { ResolveRedirectResponse } from '@billsplit-wl/shared';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { Errors } from '../errors';
import { logger } from '../logger';

const ResolveRedirectRequestSchema = z.object({
    url: z.string().url('Invalid URL format'),
});

const ALLOWED_DOMAINS = [
    'maps.app.goo.gl',
    'goo.gl',
    'maps.google.com',
    'google.com',
    'waze.com',
    'maps.apple.com',
    'bing.com',
    'openstreetmap.org',
    'osm.org',
    'here.com',
    'map.baidu.com',
    'yandex.com',
    'yandex.ru',
    'map.kakao.com',
    'map.naver.com',
];

function isAllowedDomain(url: string): boolean {
    try {
        const parsedUrl = new URL(url);
        return ALLOWED_DOMAINS.some((domain) => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`));
    } catch {
        return false;
    }
}

export class UrlRedirectHandlers {
    resolveRedirect: RequestHandler = async (req, res, next) => {
        try {
            const parsed = ResolveRedirectRequestSchema.safeParse(req.body);
            if (!parsed.success) {
                throw Errors.validationError('url', 'INVALID_URL');
            }

            const { url } = parsed.data;

            if (!isAllowedDomain(url)) {
                throw Errors.validationError('url', 'DOMAIN_NOT_ALLOWED');
            }

            const resolvedUrl = await this.followRedirects(url);

            const response: ResolveRedirectResponse = {
                resolvedUrl,
            };

            res.status(200).json(response);
        } catch (error) {
            next(error);
        }
    };

    private async followRedirects(url: string, maxRedirects = 10): Promise<string> {
        let currentUrl = url;
        let redirectCount = 0;

        while (redirectCount < maxRedirects) {
            try {
                const response = await fetch(currentUrl, {
                    method: 'HEAD',
                    redirect: 'manual',
                });

                if (response.status >= 300 && response.status < 400) {
                    const location = response.headers.get('location');
                    if (!location) {
                        return currentUrl;
                    }

                    currentUrl = new URL(location, currentUrl).href;
                    redirectCount++;

                    logger.info('url-redirect-followed', {
                        redirectCount,
                        currentUrl,
                    });
                } else {
                    return currentUrl;
                }
            } catch (error) {
                logger.warn('url-redirect-fetch-error', {
                    url: currentUrl,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                return currentUrl;
            }
        }

        logger.warn('url-redirect-max-reached', {
            maxRedirects,
            finalUrl: currentUrl,
        });

        return currentUrl;
    }
}
