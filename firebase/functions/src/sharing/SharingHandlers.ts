import type { BrandingSharing } from '@billsplit-wl/shared';
import type { RequestHandler } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import type { TenantRegistryService } from '../services/tenant/TenantRegistryService';

interface OgTagSet {
    title: string;
    description: string;
    image: string;
    url: string;
    siteName: string;
}

interface SharingTranslations {
    ogDescription: string;
    joinTitle: string;
}

type ShareableRoute = 'join' | 'default';

// Hardcoded fallback if translations can't be loaded
const FALLBACK_TRANSLATIONS: SharingTranslations = {
    ogDescription: 'Split expenses easily with friends and family',
    joinTitle: 'Join a group on {{appName}}',
};

function escapeHtmlAttribute(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Supported languages for OG tags (must have translation files)
const SUPPORTED_LANGUAGES = [
    'en', 'ar', 'de', 'es', 'it', 'ja', 'ko', 'lv', 'nl-BE', 'no', 'ph', 'sv', 'uk',
] as const;

type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

function isSupportedLanguage(lang: string): lang is SupportedLanguage {
    return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}

export class SharingHandlers {
    private template: string | null = null;
    private translationsCache: Map<string, SharingTranslations> = new Map();

    constructor(private readonly tenantRegistry: TenantRegistryService) {}

    private loadTranslations(lang: string = 'en'): SharingTranslations {
        // Normalize and validate language
        const normalizedLang = isSupportedLanguage(lang) ? lang : 'en';

        // Check cache first
        const cached = this.translationsCache.get(normalizedLang);
        if (cached) {
            return cached;
        }

        // Try to load requested language, fall back to English
        const translations = this.loadTranslationsForLanguage(normalizedLang)
            ?? this.loadTranslationsForLanguage('en')
            ?? FALLBACK_TRANSLATIONS;

        this.translationsCache.set(normalizedLang, translations);
        return translations;
    }

    private loadTranslationsForLanguage(lang: string): SharingTranslations | null {
        // Check multiple locations for translations:
        // 1. Same directory as compiled JS (production: lib/locales/)
        // 2. Webapp locales directory (dev mode with tsx)
        const possiblePaths = [
            path.resolve(__dirname, `../locales/${lang}/translation.json`),
            path.resolve(__dirname, `../../../webapp-v2/src/locales/${lang}/translation.json`),
            path.resolve(__dirname, `../../../../webapp-v2/src/locales/${lang}/translation.json`),
        ];

        for (const translationPath of possiblePaths) {
            if (fs.existsSync(translationPath)) {
                try {
                    const content = fs.readFileSync(translationPath, 'utf-8');
                    const parsed = JSON.parse(content) as { sharing?: SharingTranslations };
                    if (parsed.sharing) {
                        logger.info('sharing-translations-loaded', { path: translationPath, lang });
                        return parsed.sharing;
                    }
                } catch (error) {
                    logger.warn('sharing-translations-parse-error', {
                        path: translationPath,
                        lang,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        }

        if (lang !== 'en') {
            logger.info('sharing-translations-fallback', {
                requestedLang: lang,
                message: 'Language not found, will fall back to English',
            });
        }
        return null;
    }

    private loadTemplate(): string {
        if (this.template) {
            return this.template;
        }

        // Check multiple locations for the template:
        // 1. Same directory as compiled JS (production: lib/sharing/)
        // 2. Webapp dist directory (dev mode with tsx, where __dirname is src/sharing/)
        const possiblePaths = [
            path.join(__dirname, 'index-template.html'),
            path.resolve(__dirname, '../../../webapp-v2/dist/index.html'),
            path.resolve(__dirname, '../../../../webapp-v2/dist/index.html'),
        ];

        for (const templatePath of possiblePaths) {
            if (fs.existsSync(templatePath)) {
                this.template = fs.readFileSync(templatePath, 'utf-8');
                logger.info('sharing-template-loaded', { path: templatePath });
                return this.template;
            }
        }

        logger.warn('sharing-template-missing', {
            checkedPaths: possiblePaths,
            message: 'index-template.html not found, using fallback',
        });
        return this.getFallbackTemplate();
    }

    private getFallbackTemplate(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loading...</title>
</head>
<body>
    <div id="app"></div>
    <script>window.location.reload();</script>
</body>
</html>`;
    }

    serveShareablePage: RequestHandler = async (req, res) => {
        try {
            const host =
                (req.headers['x-forwarded-host'] as string | undefined) ??
                req.headers.host ??
                req.hostname ??
                null;

            // Extract language from query param (e.g., /join?shareToken=...&lang=de)
            const lang = typeof req.query.lang === 'string' ? req.query.lang : 'en';

            const tenantContext = await this.tenantRegistry.resolveTenant({ host });
            const route = this.determineRoute(req.path);

            const ogTags = this.buildOgTags({
                tenantContext,
                route,
                url: this.buildCanonicalUrl(req, host),
                lang,
            });

            const template = this.loadTemplate();
            const html = this.injectOgTags(template, ogTags);

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Vary', 'Host');
            res.setHeader('Cache-Control', 'public, max-age=300');
            res.status(HTTP_STATUS.OK).send(html);
        } catch (error) {
            logger.error('sharing-page-error', {
                error: error instanceof Error ? error.message : String(error),
                path: req.path,
            });
            res.status(HTTP_STATUS.INTERNAL_ERROR).send('Internal Server Error');
        }
    };

    private buildOgTags({
        tenantContext,
        route,
        url,
        lang,
    }: {
        tenantContext: { config: { brandingTokens?: { tokens?: { legal?: { appName?: string }; sharing?: BrandingSharing; assets?: { logoUrl?: string } } } } };
        route: ShareableRoute;
        url: string;
        lang: string;
    }): OgTagSet {
        const tokens = tenantContext.config.brandingTokens?.tokens;
        const appName = tokens?.legal?.appName ?? 'BillSplit';
        const sharing = tokens?.sharing;
        const translations = this.loadTranslations(lang);

        // Image fallback chain: tenant ogImage -> tenant logo (always exists)
        const image = sharing?.ogImage ?? tokens?.assets?.logoUrl ?? '';

        // Description from translations (not tenant config)
        const description = translations.ogDescription;

        return {
            title: this.getTitleForRoute(route, appName, translations),
            description,
            image,
            url,
            siteName: appName,
        };
    }

    private getTitleForRoute(route: ShareableRoute, appName: string, translations: SharingTranslations): string {
        switch (route) {
            case 'join':
                // Use translated title with interpolation
                return translations.joinTitle.replace('{{appName}}', appName);
            default:
                return appName;
        }
    }

    private injectOgTags(template: string, tags: OgTagSet): string {
        const metaTags = `
    <!-- Open Graph (Facebook, LinkedIn, WhatsApp) -->
    <meta property="og:title" content="${escapeHtmlAttribute(tags.title)}" />
    <meta property="og:description" content="${escapeHtmlAttribute(tags.description)}" />
    <meta property="og:image" content="${escapeHtmlAttribute(tags.image)}" />
    <meta property="og:url" content="${escapeHtmlAttribute(tags.url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtmlAttribute(tags.siteName)}" />
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtmlAttribute(tags.title)}" />
    <meta name="twitter:description" content="${escapeHtmlAttribute(tags.description)}" />
    <meta name="twitter:image" content="${escapeHtmlAttribute(tags.image)}" />`;

        if (template.includes('</head>')) {
            return template.replace('</head>', `${metaTags}\n</head>`);
        }

        return template.replace('<head>', `<head>${metaTags}`);
    }

    private buildCanonicalUrl(req: { originalUrl: string; protocol: string }, host: string | null): string {
        const protocol = 'https';
        const effectiveHost = host ?? 'localhost';
        const path = req.originalUrl;
        return `${protocol}://${effectiveHost}${path}`;
    }

    private determineRoute(path: string): ShareableRoute {
        if (path.startsWith('/join')) {
            return 'join';
        }
        return 'default';
    }
}
