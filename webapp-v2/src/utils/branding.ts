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

    // Convert hex to RGB for Tailwind compatibility
    const hexToRgb = (hex: string): string => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : '124 58 237';
    };

    document.documentElement.style.setProperty('--brand-primary', branding.primaryColor);
    document.documentElement.style.setProperty('--brand-secondary', branding.secondaryColor);
    document.documentElement.style.setProperty('--brand-primary-rgb', hexToRgb(branding.primaryColor));
    document.documentElement.style.setProperty('--brand-secondary-rgb', hexToRgb(branding.secondaryColor));

    if (branding.backgroundColor) {
        document.documentElement.style.setProperty('--brand-background', branding.backgroundColor);
        document.documentElement.style.setProperty('--brand-background-rgb', hexToRgb(branding.backgroundColor));
        // Apply background color to body
        document.body.style.backgroundColor = branding.backgroundColor;
    } else {
        document.documentElement.style.removeProperty('--brand-background');
        document.documentElement.style.removeProperty('--brand-background-rgb');
        document.body.style.backgroundColor = '';
    }

    if (branding.headerBackgroundColor) {
        document.documentElement.style.setProperty('--brand-header-background', branding.headerBackgroundColor);
        document.documentElement.style.setProperty('--brand-header-background-rgb', hexToRgb(branding.headerBackgroundColor));
        // Use header background color for cards (darker orange)
        document.documentElement.style.setProperty('--brand-card-background', branding.headerBackgroundColor);
    } else {
        document.documentElement.style.removeProperty('--brand-header-background');
        document.documentElement.style.removeProperty('--brand-header-background-rgb');
        // Fall back to white for cards if no header color
        document.documentElement.style.setProperty('--brand-card-background', 'white');
    }

    if (branding.accentColor) {
        document.documentElement.style.setProperty('--brand-accent', branding.accentColor);
    } else {
        document.documentElement.style.removeProperty('--brand-accent');
    }

    document.documentElement.dataset.brandName = branding.appName;
    applyDocumentTitle(branding.appName);
};
