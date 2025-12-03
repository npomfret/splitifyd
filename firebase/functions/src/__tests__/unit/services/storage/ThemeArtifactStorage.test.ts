import { StubStorage } from 'ts-firebase-simulator';
import { ThemeArtifactPayloadBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { computeSha256, createThemeArtifactStorage, resetThemeArtifactStorage } from '../../../../services/storage/ThemeArtifactStorage';

describe('ThemeArtifactStorage factory', () => {
    let stubStorage: StubStorage;

    beforeEach(() => {
        // Reset singleton for test isolation
        resetThemeArtifactStorage();
        stubStorage = new StubStorage({ defaultBucketName: 'unit-theme-bucket' });
    });

    it('creates a singleton and wires through injected storage', () => {
        const first = createThemeArtifactStorage({ storage: stubStorage, storageEmulatorHost: null });
        const second = createThemeArtifactStorage({ storage: stubStorage, storageEmulatorHost: null });

        expect(first).toBe(second);
    });

    it('saves artifacts via the stub storage instance', async () => {
        const storage = createThemeArtifactStorage({ storage: stubStorage, storageEmulatorHost: null });

        const payload = new ThemeArtifactPayloadBuilder()
            .withTenantId('tenant-abc')
            .withHash('hash-123')
            .withCssContent('body { color: #000; }')
            .withTokensJson('{"palette":{"primary":"#000000"}}')
            .build();

        const result = await storage.save(payload);

        expect(result.cssUrl).toContain(`theme-artifacts/${payload.tenantId}/${payload.hash}/theme.css`);
        expect(result.tokensUrl).toContain(`theme-artifacts/${payload.tenantId}/${payload.hash}/tokens.json`);

        const bucketName = stubStorage.bucket().name;
        const cssSnapshot = stubStorage.getFile(bucketName, `theme-artifacts/${payload.tenantId}/${payload.hash}/theme.css`);
        const tokensSnapshot = stubStorage.getFile(bucketName, `theme-artifacts/${payload.tenantId}/${payload.hash}/tokens.json`);

        expect(cssSnapshot?.content.toString('utf8')).toBe(payload.cssContent);
        expect(tokensSnapshot?.content.toString('utf8')).toBe(payload.tokensJson);
    });

    it('computes stable SHA-256 hashes', () => {
        const value = computeSha256('hello world');
        const sameValue = computeSha256('hello world');
        const differentValue = computeSha256('goodbye');

        expect(value).toBe(sameValue);
        expect(value).toMatch(/^[a-f0-9]{64}$/);
        expect(differentValue).not.toBe(value);
    });
});
