import { StubStorage } from '@billsplit-wl/firebase-simulator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTenantAssetStorage, resetTenantAssetStorage } from '../../../../services/storage/TenantAssetStorage';

describe('TenantAssetStorage', () => {
    let stubStorage: StubStorage;
    const emulatorHost = 'localhost:9199';

    beforeEach(() => {
        stubStorage = new StubStorage({ defaultBucketName: 'test-bucket' });
    });

    afterEach(() => {
        resetTenantAssetStorage();
    });

    describe('uploadAsset', () => {
        it('should upload logo and return emulator URL', async () => {
            const assetStorage = createTenantAssetStorage({ storage: stubStorage, storageEmulatorHost: emulatorHost });
            const buffer = Buffer.from('fake-png-data');

            const url = await assetStorage.uploadAsset('tenant-123', 'logo', buffer, 'image/png');

            expect(url).toContain(emulatorHost);
            expect(url).toContain('tenant-123');
            expect(url).toMatch(/logo-\d+\.png/);
            expect(url).toContain('?alt=media');

            const files = stubStorage.getAllFiles();
            expect(files.size).toBe(1);
        });

        it('should upload favicon and return emulator URL', async () => {
            const assetStorage = createTenantAssetStorage({ storage: stubStorage, storageEmulatorHost: emulatorHost });
            const buffer = Buffer.from('fake-ico-data');

            const url = await assetStorage.uploadAsset('tenant-456', 'favicon', buffer, 'image/x-icon');

            expect(url).toContain(emulatorHost);
            expect(url).toContain('tenant-456');
            expect(url).toMatch(/favicon-\d+\.ico/);

            const files = stubStorage.getAllFiles();
            expect(files.size).toBe(1);
        });

        it('should set correct content type metadata', async () => {
            const assetStorage = createTenantAssetStorage({ storage: stubStorage, storageEmulatorHost: emulatorHost });
            const buffer = Buffer.from('fake-webp-data');

            await assetStorage.uploadAsset('tenant-789', 'logo', buffer, 'image/webp');

            const files = stubStorage.getAllFiles();
            const file = Array.from(files.values())[0];
            expect(file.metadata.contentType).toBe('image/webp');
        });

        it('should set immutable cache control', async () => {
            const assetStorage = createTenantAssetStorage({ storage: stubStorage, storageEmulatorHost: emulatorHost });
            const buffer = Buffer.from('fake-data');

            await assetStorage.uploadAsset('tenant-abc', 'logo', buffer, 'image/jpeg');

            const files = stubStorage.getAllFiles();
            const file = Array.from(files.values())[0];
            expect(file.metadata.cacheControl).toBe('public, max-age=31536000, immutable');
        });

        it('should include tenant metadata', async () => {
            const assetStorage = createTenantAssetStorage({ storage: stubStorage, storageEmulatorHost: emulatorHost });
            const buffer = Buffer.from('fake-data');

            await assetStorage.uploadAsset('tenant-xyz', 'favicon', buffer, 'image/png');

            const files = stubStorage.getAllFiles();
            const file = Array.from(files.values())[0];
            expect(file.metadata.metadata?.tenantId).toBe('tenant-xyz');
            expect(file.metadata.metadata?.assetType).toBe('favicon');
            expect(file.metadata.metadata?.uploadedAt).toBeDefined();
        });

        it('should use correct file path structure', async () => {
            const assetStorage = createTenantAssetStorage({ storage: stubStorage, storageEmulatorHost: emulatorHost });
            const buffer = Buffer.from('fake-data');

            await assetStorage.uploadAsset('tenant-path', 'logo', buffer, 'image/png');

            const files = stubStorage.getAllFiles();
            const filePath = Array.from(files.keys())[0];
            // StubStorage includes bucket name in key: "bucket:path"
            expect(filePath).toMatch(/^test-bucket:tenant-assets\/tenant-path\/logo-\d+\.png$/);
        });

        it('should handle different image formats', async () => {
            const assetStorage = createTenantAssetStorage({ storage: stubStorage, storageEmulatorHost: emulatorHost });

            const formats = [
                { contentType: 'image/jpeg', expectedExt: 'jpg' },
                { contentType: 'image/png', expectedExt: 'png' },
                { contentType: 'image/gif', expectedExt: 'gif' },
                { contentType: 'image/svg+xml', expectedExt: 'svg' },
                { contentType: 'image/webp', expectedExt: 'webp' },
                { contentType: 'image/x-icon', expectedExt: 'ico' },
            ];

            for (const { contentType, expectedExt } of formats) {
                resetTenantAssetStorage();
                stubStorage = new StubStorage({ defaultBucketName: 'test-bucket' });
                const newStorage = createTenantAssetStorage({ storage: stubStorage, storageEmulatorHost: emulatorHost });

                const url = await newStorage.uploadAsset('tenant-fmt', 'logo', Buffer.from('test'), contentType);

                expect(url).toContain(`.${expectedExt}`);
            }
        });

        it('should generate production URL when no emulator host', async () => {
            const assetStorage = createTenantAssetStorage({ storage: stubStorage, storageEmulatorHost: null });
            const buffer = Buffer.from('fake-data');

            const url = await assetStorage.uploadAsset('tenant-prod', 'logo', buffer, 'image/png');

            expect(url).toMatch(/^https:\/\/storage\.googleapis\.com\/test-bucket\/tenant-assets\/tenant-prod\/logo-\d+\.png$/);
            expect(url).not.toContain('?alt=media');
        });
    });

    describe('deleteAsset', () => {
        it('should delete asset by emulator URL', async () => {
            const assetStorage = createTenantAssetStorage({ storage: stubStorage, storageEmulatorHost: emulatorHost });
            const buffer = Buffer.from('fake-data');

            // Upload first
            const url = await assetStorage.uploadAsset('tenant-del', 'logo', buffer, 'image/png');
            expect(stubStorage.getAllFiles().size).toBe(1);

            // Delete
            await assetStorage.deleteAsset(url);

            expect(stubStorage.getAllFiles().size).toBe(0);
        });

        it('should delete asset by production URL', async () => {
            const assetStorage = createTenantAssetStorage({ storage: stubStorage, storageEmulatorHost: null });
            const buffer = Buffer.from('fake-data');

            // Upload first
            const url = await assetStorage.uploadAsset('tenant-del-prod', 'logo', buffer, 'image/png');
            expect(stubStorage.getAllFiles().size).toBe(1);

            // Delete
            await assetStorage.deleteAsset(url);

            expect(stubStorage.getAllFiles().size).toBe(0);
        });

        it('should skip deletion of external URLs', async () => {
            const assetStorage = createTenantAssetStorage({ storage: stubStorage, storageEmulatorHost: emulatorHost });

            // Try to delete external URL (should not throw)
            await assetStorage.deleteAsset('https://cdn.example.com/logo.png');

            // Should not have any files
            expect(stubStorage.getAllFiles().size).toBe(0);
        });

        it('should not throw on delete failure', async () => {
            const assetStorage = createTenantAssetStorage({ storage: stubStorage, storageEmulatorHost: emulatorHost });

            // Try to delete non-existent file (should not throw)
            await expect(assetStorage.deleteAsset(`http://${emulatorHost}/v0/b/test-bucket/o/tenant-assets%2Fnon-existent%2Flogo.png?alt=media`)).resolves.toBeUndefined();
        });
    });
});
