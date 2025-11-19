import { StubStorage } from '@billsplit-wl/firebase-simulator';
import { beforeEach, describe, expect, it } from 'vitest';
import { CloudThemeArtifactStorage } from '../../../../services/storage/CloudThemeArtifactStorage';

describe('CloudThemeArtifactStorage', () => {
    let stubStorage: StubStorage;

    beforeEach(() => {
        stubStorage = new StubStorage({ defaultBucketName: 'test-bucket' });
    });

    it('generates production URLs when storageEmulatorHost is null', async () => {
        const storage = new CloudThemeArtifactStorage(stubStorage, null);

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

    it('generates emulator URLs when storageEmulatorHost is provided', async () => {
        const storage = new CloudThemeArtifactStorage(stubStorage, 'localhost:9199');

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
