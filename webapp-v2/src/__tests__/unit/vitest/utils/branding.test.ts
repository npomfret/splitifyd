import { describe, expect, it, beforeEach } from 'vitest';
import {
    applyBrandingPalette,
    applyDocumentTitle,
} from '@/utils/branding.ts';
import {
    toTenantAppName,
    toTenantFaviconUrl,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    type BrandingConfig,
} from '@splitifyd/shared';

describe('branding utilities', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.documentElement.style.cssText = '';
        document.documentElement.dataset.brandName = '';
        document.title = 'Splitifyd';
    });

    const buildBranding = (): BrandingConfig => ({
        appName: toTenantAppName('Acme Splitter'),
        logoUrl: toTenantLogoUrl('https://cdn.example.com/logo.svg'),
        faviconUrl: toTenantFaviconUrl('https://cdn.example.com/favicon.ico'),
        primaryColor: toTenantPrimaryColor('#123456'),
        secondaryColor: toTenantSecondaryColor('#abcdef'),
    });

    it('applies favicon, meta theme colour, css variables, and document title', () => {
        const branding = buildBranding();

        applyBrandingPalette(branding);

        const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
        expect(meta?.getAttribute('content')).toBe(branding.primaryColor);

        const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        expect(favicon?.getAttribute('href')).toBe(branding.faviconUrl);

        expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe(branding.primaryColor);
        expect(document.documentElement.style.getPropertyValue('--brand-secondary')).toBe(branding.secondaryColor);
        expect(document.documentElement.dataset.brandName).toBe(branding.appName);
        expect(document.title).toBe(branding.appName);
    });

    it('resets branding artefacts when called with null', () => {
        applyBrandingPalette(buildBranding());

        applyBrandingPalette(null);

        const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
        expect(meta?.getAttribute('content')).toBe('#1a73e8');

        const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        expect(favicon?.getAttribute('href')).toBe('/src/assets/logo.svg');

        expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('');
        expect(document.documentElement.dataset.brandName).toBe('');
    });

    it('preserves custom titles when applyDocumentTitle is called explicitly', () => {
        document.title = 'Tenant Portal';
        applyDocumentTitle('New Name');

        expect(document.title).toBe('Tenant Portal');
    });
});
