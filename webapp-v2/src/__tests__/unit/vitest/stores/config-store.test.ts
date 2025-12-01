import { firebaseConfigManager } from '@/app/firebase-config';
import { configStore } from '@/stores/config-store.ts';
import { syncThemeHash } from '@/utils/theme-bootstrap';
import { TenantConfigBuilder } from '@billsplit-wl/shared';
import { AppConfigurationBuilder } from '@billsplit-wl/test-support';
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

const buildConfig = (branding?: BrandingConfig) => {
    const builder = new AppConfigurationBuilder();
    if (branding) {
        builder.withTenantConfig(new TenantConfigBuilder().withBranding(branding).build());
    }
    return builder.build();
};

describe('configStore', () => {
    beforeEach(() => {
        vi.mocked(firebaseConfigManager.getConfig).mockResolvedValue(buildConfig());
        document.title = 'Splitifyd';
        getMetaThemeColor()?.remove();
        getFavicon()?.remove();
    });

    afterEach(() => {
        configStore.reset();
        vi.clearAllMocks();
    });

    it('updates branding metadata and theme when tenant branding exists', async () => {
        const tenantConfig = new TenantConfigBuilder()
            .withAppName('Branded')
            .withLogoUrl('https://logo.svg')
            .withFaviconUrl('https://favicon.ico')
            .withPrimaryColor('#112233')
            .withSecondaryColor('#445566')
            .build();

        const config = new AppConfigurationBuilder()
            .withTenantConfig(tenantConfig)
            .withThemeConfig({ hash: 'abc123' })
            .build();
        vi.mocked(firebaseConfigManager.getConfig).mockResolvedValue(config);

        await configStore.loadConfig();

        expect(getMetaThemeColor()?.content).toBe(tenantConfig.branding.primaryColor);
        expect(getFavicon()?.getAttribute('href')).toBe(tenantConfig.branding.faviconUrl);
        expect(document.title).toBe(tenantConfig.branding.appName);
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
