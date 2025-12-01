import { firebaseConfigManager } from '@/app/firebase-config';
import { configStore } from '@/stores/config-store.ts';
import { syncThemeHash } from '@/utils/theme-bootstrap';
import type { ClientAppConfiguration, BrandingConfig } from '@billsplit-wl/shared';
import { toISOString, toTenantId } from '@billsplit-wl/shared';
import { BrandingConfigBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/firebase-config', () => ({
    firebaseConfigManager: {
        getConfig: vi.fn(),
    },
}));

vi.mock('@/utils/theme-bootstrap', () => ({
    syncThemeHash: vi.fn(),
    registerThemeServiceWorker: vi.fn(),
}));

const getMetaThemeColor = (): HTMLMetaElement | null => document.querySelector('meta[name="theme-color"]');
const getFavicon = (): HTMLLinkElement | null => document.querySelector('link[rel="icon"]');

describe('configStore', () => {
    const baseConfig = (branding?: BrandingConfig): ClientAppConfiguration => ({
        firebase: {
            apiKey: 'test',
            authDomain: 'test',
            projectId: 'test',
            storageBucket: 'test',
            messagingSenderId: 'test',
            appId: 'test',
        },
        warningBanner: "foo",
        formDefaults: {},
        tenant: branding
            ? {
                tenantId: toTenantId('tenant'),
                branding,
                createdAt: toISOString('2025-01-01T00:00:00.000Z'),
                updatedAt: toISOString('2025-01-01T00:00:00.000Z'),
            }
            : undefined,
    });

    beforeEach(() => {
        vi.mocked(firebaseConfigManager.getConfig).mockResolvedValue(baseConfig());
        document.title = 'Splitifyd';
        getMetaThemeColor()?.remove();
        getFavicon()?.remove();
    });

    afterEach(() => {
        configStore.reset();
        vi.clearAllMocks();
    });

    it('updates branding metadata and theme when tenant branding exists', async () => {
        const branding: BrandingConfig = new BrandingConfigBuilder()
            .withAppName('Branded')
            .withLogoUrl('https://logo.svg')
            .withFaviconUrl('https://favicon.ico')
            .withPrimaryColor('#112233')
            .withSecondaryColor('#445566')
            .build();

        const config = baseConfig(branding);
        config.theme = { hash: 'abc123' } as ClientAppConfiguration['theme'];
        vi.mocked(firebaseConfigManager.getConfig).mockResolvedValue(config);

        await configStore.loadConfig();

        expect(getMetaThemeColor()?.content).toBe(branding.primaryColor);
        expect(getFavicon()?.getAttribute('href')).toBe(branding.faviconUrl);
        expect(document.title).toBe(branding.appName);
        expect(syncThemeHash).toHaveBeenCalledWith('abc123');
    });

    it('resets branding metadata when reset is called', async () => {
        await configStore.loadConfig();
        configStore.reset();

        expect(getMetaThemeColor()?.content).toBe('#1a73e8');
        expect(getFavicon()?.getAttribute('href')).toBe('/src/assets/logo.svg');
        expect(document.title).toBe('Splitifyd');
        expect(syncThemeHash).toHaveBeenCalled();
    });

    it('syncs theme hash even when branding is absent', async () => {
        await configStore.loadConfig();
        expect(syncThemeHash).toHaveBeenCalledWith(null);
    });
});
