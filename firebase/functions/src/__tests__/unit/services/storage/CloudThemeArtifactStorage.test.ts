import { ThemeArtifactPayloadBuilder } from '@billsplit-wl/test-support';
import { StubStorage } from 'ts-firebase-simulator';
import { beforeEach, describe, expect, it } from 'vitest';
import { CloudThemeArtifactStorage } from '../../../../services/storage/CloudThemeArtifactStorage';

describe('CloudThemeArtifactStorage', () => {
    let stubStorage: StubStorage;
    const emulatorHost = 'localhost:9199';
    const emulatorBaseUrl = `http://${emulatorHost}`;
    const prodBaseUrl = 'https://firebasestorage.googleapis.com';

    beforeEach(() => {
        stubStorage = new StubStorage({ defaultBucketName: 'test-bucket' });
    });

    it('generates production URLs when using production base URL', async () => {
        const storage = new CloudThemeArtifactStorage(stubStorage, prodBaseUrl);

        const payload = new ThemeArtifactPayloadBuilder()
            .withTenantId('tenant-123')
            .withHash('abc')
            .withCssContent('body { color: black; }')
            .withTokensJson('{"foo":"bar"}')
            .build();

        const result = await storage.save(payload);

        const files = stubStorage.getAllFiles();
        expect(files.size).toBe(2);
        expect(result.cssUrl).toBe('https://firebasestorage.googleapis.com/v0/b/test-bucket/o/theme-artifacts%2Ftenant-123%2Fabc%2Ftheme.css?alt=media');
        expect(result.tokensUrl).toBe('https://firebasestorage.googleapis.com/v0/b/test-bucket/o/theme-artifacts%2Ftenant-123%2Fabc%2Ftokens.json?alt=media');
    });

    it('generates emulator URLs when using emulator base URL', async () => {
        const storage = new CloudThemeArtifactStorage(stubStorage, emulatorBaseUrl);

        const payload = new ThemeArtifactPayloadBuilder()
            .withTenantId('tenant-123')
            .withHash('hashy-hash')
            .withCssContent('/* css */')
            .withTokensJson('{"ok":true}')
            .build();

        const result = await storage.save(payload);

        expect(result.cssUrl).toBe('http://localhost:9199/v0/b/test-bucket/o/theme-artifacts%2Ftenant-123%2Fhashy-hash%2Ftheme.css?alt=media');
        expect(result.tokensUrl).toBe('http://localhost:9199/v0/b/test-bucket/o/theme-artifacts%2Ftenant-123%2Fhashy-hash%2Ftokens.json?alt=media');
    });
});
