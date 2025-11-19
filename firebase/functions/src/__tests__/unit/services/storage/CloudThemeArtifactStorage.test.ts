import { StubStorage } from '@billsplit-wl/firebase-simulator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CloudThemeArtifactStorage } from '../../../../services/storage/CloudThemeArtifactStorage';

describe('CloudThemeArtifactStorage', () => {
    let stubStorage: StubStorage;
    let storage: CloudThemeArtifactStorage;

    beforeEach(() => {
        stubStorage = new StubStorage({ defaultBucketName: 'test-bucket' });
        storage = new CloudThemeArtifactStorage(stubStorage);
    });

    afterEach(() => {
        delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    });

    it('uploads css and tokens content and returns public urls', async () => {
        const result = await storage.save({
            tenantId: 'tenant-123',
            hash: 'abc',
            cssContent: 'body { color: black; }',
            tokensJson: '{"foo":"bar"}',
        });

        const files = stubStorage.getAllFiles();
        expect(files.size).toBe(2);
        expect(result.cssUrl).toBe('https://storage.googleapis.com/test-bucket/theme-artifacts/tenant-123/abc/theme.css');
        expect(result.tokensUrl).toBe('https://storage.googleapis.com/test-bucket/theme-artifacts/tenant-123/abc/tokens.json');
    });

    it('uses emulator url pattern when FIREBASE_STORAGE_EMULATOR_HOST is set', async () => {
        process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';

        const result = await storage.save({
            tenantId: 'tenant-123',
            hash: 'hashy-hash',
            cssContent: '/* css */',
            tokensJson: '{"ok":true}',
        });

        expect(result.cssUrl).toBe('http://localhost:9199/v0/b/test-bucket/o/theme-artifacts%2Ftenant-123%2Fhashy-hash%2Ftheme.css?alt=media');
        expect(result.tokensUrl).toBe('http://localhost:9199/v0/b/test-bucket/o/theme-artifacts%2Ftenant-123%2Fhashy-hash%2Ftokens.json?alt=media');
    });
});
