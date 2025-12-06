import { firebaseConfigManager } from '@/app/firebase-config';
import { configStore } from '@/stores/config-store.ts';
import { syncThemeHash } from '@/utils/theme-bootstrap';
import type { BrandingConfig, ClientAppConfiguration } from '@billsplit-wl/shared';
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
}));

const getMetaThemeColor = (): HTMLMetaElement | null => document.querySelector('meta[name="theme-color"]');
const getFavicon = (): HTMLLinkElement | null => document.querySelector('link[rel="icon"]');

describe('configStore', () => {
    const baseConfig = (branding?: BrandingConfig, appName?: string, logoUrl?: string, faviconUrl?: string): ClientAppConfiguration => ({
        firebase: {
            apiKey: 'test',
            authDomain: 'test',
            projectId: 'test',
            storageBucket: 'test',
            messagingSenderId: 'test',
            appId: 'test',
        },
        warningBanner: 'foo',
        formDefaults: {},
        tenant: branding
            ? {
                tenantId: toTenantId('tenant'),
                branding,
                brandingTokens: {
                    tokens: {
                        legal: {
                            appName: appName || 'Test App',
                        },
                        assets: {
                            logoUrl: logoUrl || 'https://logo.svg',
                            faviconUrl: faviconUrl || logoUrl || 'https://favicon.ico',
                        },
                    },
                } as any,
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
            .withPrimaryColor('#112233')
            .withSecondaryColor('#445566')
            .build();

        const config = baseConfig(branding, 'Branded', 'https://logo.svg', 'https://favicon.ico');
        config.theme = { hash: 'abc123' } as ClientAppConfiguration['theme'];
        vi.mocked(firebaseConfigManager.getConfig).mockResolvedValue(config);

        await configStore.loadConfig();

        expect(getMetaThemeColor()?.content).toBe(branding.primaryColor);
        expect(getFavicon()?.getAttribute('href')).toBe('https://favicon.ico');
        expect(document.title).toBe('Branded');
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
