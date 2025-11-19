import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StubStorage } from '@billsplit-wl/firebase-simulator';

let stubStorage: StubStorage;
const createStorageMock = vi.fn(() => stubStorage);
const getStorageMock = vi.fn(() => ({}));

vi.mock('../../../../storage-wrapper', async () => {
    const actual = await vi.importActual<typeof import('../../../../storage-wrapper')>('../../../../storage-wrapper');
    return {
        ...actual,
        createStorage: createStorageMock,
    };
});

vi.mock('../../../../firebase', () => ({
    getStorage: getStorageMock,
}));

describe('ThemeArtifactStorage factory', () => {
    beforeEach(() => {
        stubStorage = new StubStorage({ defaultBucketName: 'unit-theme-bucket' });
        createStorageMock.mockClear();
        getStorageMock.mockClear();
        vi.resetModules();
    });

    it('creates a singleton and wires through createStorage', async () => {
        const { createThemeArtifactStorage } = await import('../../../../services/storage/ThemeArtifactStorage');
        const first = createThemeArtifactStorage();
        const second = createThemeArtifactStorage();

        expect(first).toBe(second);
        expect(createStorageMock).toHaveBeenCalledTimes(1);
        expect(getStorageMock).toHaveBeenCalledTimes(1);
    });

    it('saves artifacts via the stub storage instance', async () => {
        const { createThemeArtifactStorage } = await import('../../../../services/storage/ThemeArtifactStorage');
        const storage = createThemeArtifactStorage();

        const payload = {
            tenantId: 'tenant-abc',
            hash: 'hash-123',
            cssContent: 'body { color: #000; }',
            tokensJson: '{"palette":{"primary":"#000000"}}',
        };

        const result = await storage.save(payload);

        expect(result.cssUrl).toContain(`theme-artifacts/${payload.tenantId}/${payload.hash}/theme.css`);
        expect(result.tokensUrl).toContain(`theme-artifacts/${payload.tenantId}/${payload.hash}/tokens.json`);

        const bucketName = stubStorage.bucket().name;
        const cssSnapshot = stubStorage.getFile(bucketName, `theme-artifacts/${payload.tenantId}/${payload.hash}/theme.css`);
        const tokensSnapshot = stubStorage.getFile(bucketName, `theme-artifacts/${payload.tenantId}/${payload.hash}/tokens.json`);

        expect(cssSnapshot?.content.toString('utf8')).toBe(payload.cssContent);
        expect(tokensSnapshot?.content.toString('utf8')).toBe(payload.tokensJson);
    });

    it('computes stable SHA-256 hashes', async () => {
        const { computeSha256 } = await import('../../../../services/storage/ThemeArtifactStorage');

        const value = computeSha256('hello world');
        const sameValue = computeSha256('hello world');
        const differentValue = computeSha256('goodbye');

        expect(value).toBe(sameValue);
        expect(value).toMatch(/^[a-f0-9]{64}$/);
        expect(differentValue).not.toBe(value);
    });
});
