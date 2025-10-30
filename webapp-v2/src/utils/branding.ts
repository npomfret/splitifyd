import type { BrandingConfig } from '@splitifyd/shared';

const BRAND_META_SELECTOR = 'meta[name="theme-color"]';
const FAVICON_SELECTOR = 'link[rel="icon"]';

const ensureMetaThemeColor = (): HTMLMetaElement | null => {
    if (typeof document === 'undefined') {
        return null;
    }

    let meta = document.querySelector<HTMLMetaElement>(BRAND_META_SELECTOR);
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
    }
    return meta;
};

const ensureFaviconLink = (): HTMLLinkElement | null => {
    if (typeof document === 'undefined') {
        return null;
    }

    let link = document.querySelector<HTMLLinkElement>(FAVICON_SELECTOR);
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    return link;
};

export const applyDocumentTitle = (brandName?: string | null): void => {
    if (typeof document === 'undefined' || !brandName) {
        return;
    }

    if (!document.title || /Splitifyd/i.test(document.title)) {
        document.title = brandName;
    }
};

export const applyBrandingPalette = (branding?: BrandingConfig | null): void => {
    if (typeof document === 'undefined') {
        return;
    }

    const metaTheme = ensureMetaThemeColor();
    if (metaTheme) {
        metaTheme.content = branding?.primaryColor ?? '#1a73e8';
    }

    const favicon = ensureFaviconLink();
    if (favicon) {
        favicon.href = branding?.faviconUrl ?? '/src/assets/logo.svg';
    }

    if (!branding) {
        document.documentElement.style.removeProperty('--brand-primary');
        document.documentElement.style.removeProperty('--brand-secondary');
        document.documentElement.style.removeProperty('--brand-accent');
        document.documentElement.dataset.brandName = '';
        applyDocumentTitle(null);
        return;
    }

    document.documentElement.style.setProperty('--brand-primary', branding.primaryColor);
    document.documentElement.style.setProperty('--brand-secondary', branding.secondaryColor);
    if (branding.accentColor) {
        document.documentElement.style.setProperty('--brand-accent', branding.accentColor);
    } else {
        document.documentElement.style.removeProperty('--brand-accent');
    }

    document.documentElement.dataset.brandName = branding.appName;
    applyDocumentTitle(branding.appName);
};
