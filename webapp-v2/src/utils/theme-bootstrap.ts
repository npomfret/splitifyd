export const getThemeStorageKey = (): string => {
    if (typeof window === 'undefined') {
        return 'tenant-theme:default:hash';
    }

    if (window.__tenantTheme?.storageKey) {
        return window.__tenantTheme.storageKey;
    }

    const hostKey = window.location.host || 'default';
    const storageKey = `tenant-theme:${hostKey}:hash`;
    window.__tenantTheme = {
        storageKey,
        hash: window.__tenantTheme?.hash ?? null,
    };

    return storageKey;
};
const THEME_LINK_ID = 'tenant-theme-stylesheet';

const absoluteHref = (href: string): string => {
    try {
        return new URL(href, window.location.origin).href;
    } catch {
        return href;
    }
};

const buildThemeHref = (hash?: string | null): string => {
    if (!hash) {
        return '/api/theme.css';
    }
    return `/api/theme.css?v=${encodeURIComponent(hash)}`;
};

export function syncThemeHash(hash?: string | null): void {
    if (typeof window === 'undefined') return;
    if (!hash) {
        return;
    }

    const normalizedHash = hash.trim();
    if (!normalizedHash) {
        return;
    }

    const nextHref = buildThemeHref(normalizedHash);
    const link = document.getElementById(THEME_LINK_ID) as HTMLLinkElement | null;

    if (link) {
        const current = absoluteHref(link.getAttribute('href') ?? '');
        const desired = absoluteHref(nextHref);
        if (current !== desired) {
            link.href = nextHref;
        }
    }

    try {
        localStorage.setItem(getThemeStorageKey(), normalizedHash);
    } catch {
        // Ignore storage failures (e.g., private mode)
    }

    if (window.__tenantTheme) {
        window.__tenantTheme.hash = normalizedHash;
    }
}

export function registerThemeServiceWorker(): void {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) {
        return;
    }

    const register = () => {
        navigator.serviceWorker
            .register('/theme-sw.js', { scope: '/' })
            .catch(() => {
                // Ignore registration failures; theme CSS still loads via network.
            });
    };

    if (document.readyState === 'complete') {
        register();
    } else {
        window.addEventListener('load', register, { once: true });
    }
}
