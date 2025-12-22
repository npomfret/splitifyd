import { StubStorage } from 'ts-firebase-simulator';
import { beforeEach, describe, expect, it } from 'vitest';
import { CloudTenantAssetStorage } from '../../../../services/storage/TenantAssetStorage';

describe('TenantAssetStorage', () => {
    let stubStorage: StubStorage;
    const emulatorHost = 'localhost:9199';
    const emulatorBaseUrl = `http://${emulatorHost}`;
    const prodBaseUrl = 'https://firebasestorage.googleapis.com';

    beforeEach(() => {
        stubStorage = new StubStorage({ defaultBucketName: 'test-bucket' });
    });

    describe('uploadAsset', () => {
        it('should upload logo and return emulator URL', async () => {
            const assetStorage = new CloudTenantAssetStorage(stubStorage, emulatorBaseUrl);
            const buffer = Buffer.from('fake-png-data');

            const url = await assetStorage.uploadAsset('tenant-123', 'logo', buffer, 'image/png');

            expect(url).toContain(emulatorHost);
            expect(url).toContain('tenant-123');
            expect(url).toMatch(/logo-[0-9a-f]{16}\.png/); // Content hash format: 16 hex chars
            expect(url).toContain('?alt=media');

            const files = stubStorage.getAllFiles();
            expect(files.size).toBe(1);
        });

        it('should upload favicon and return emulator URL', async () => {
            const assetStorage = new CloudTenantAssetStorage(stubStorage, emulatorBaseUrl);
            const buffer = Buffer.from('fake-ico-data');

            const url = await assetStorage.uploadAsset('tenant-456', 'favicon', buffer, 'image/x-icon');

            expect(url).toContain(emulatorHost);
            expect(url).toContain('tenant-456');
            expect(url).toMatch(/favicon-[0-9a-f]{16}\.ico/); // Content hash format: 16 hex chars

            const files = stubStorage.getAllFiles();
            expect(files.size).toBe(1);
        });

        it('should set correct content type metadata', async () => {
            const assetStorage = new CloudTenantAssetStorage(stubStorage, emulatorBaseUrl);
            const buffer = Buffer.from('fake-webp-data');

            await assetStorage.uploadAsset('tenant-789', 'logo', buffer, 'image/webp');

            const files = stubStorage.getAllFiles();
            const file = Array.from(files.values())[0];
            expect(file.metadata?.contentType).toBe('image/webp');
        });

        it('should set immutable cache control', async () => {
            const assetStorage = new CloudTenantAssetStorage(stubStorage, emulatorBaseUrl);
            const buffer = Buffer.from('fake-data');

            await assetStorage.uploadAsset('tenant-abc', 'logo', buffer, 'image/jpeg');

            const files = stubStorage.getAllFiles();
            const file = Array.from(files.values())[0];
            expect(file.metadata?.cacheControl).toBe('public, max-age=31536000, immutable');
        });

        it('should include tenant metadata', async () => {
            const assetStorage = new CloudTenantAssetStorage(stubStorage, emulatorBaseUrl);
            const buffer = Buffer.from('fake-data');

            await assetStorage.uploadAsset('tenant-xyz', 'favicon', buffer, 'image/png');

            const files = stubStorage.getAllFiles();
            const file = Array.from(files.values())[0];
            expect(file.metadata?.metadata?.tenantId).toBe('tenant-xyz');
            expect(file.metadata?.metadata?.assetType).toBe('favicon');
            expect(file.metadata?.metadata?.uploadedAt).toBeDefined();
        });

        it('should use correct file path structure', async () => {
            const assetStorage = new CloudTenantAssetStorage(stubStorage, emulatorBaseUrl);
            const buffer = Buffer.from('fake-data');

            await assetStorage.uploadAsset('tenant-path', 'logo', buffer, 'image/png');

            const files = stubStorage.getAllFiles();
            const filePath = Array.from(files.keys())[0];
            // StubStorage includes bucket name in key: "bucket:path"
            expect(filePath).toMatch(/^test-bucket:tenant-assets\/tenant-path\/logo-[0-9a-f]{16}\.png$/);
        });

        it('should handle different image formats', async () => {
            const assetStorage = new CloudTenantAssetStorage(stubStorage, emulatorBaseUrl);

            const formats = [
                { contentType: 'image/jpeg', expectedExt: 'jpg' },
                { contentType: 'image/png', expectedExt: 'png' },
                { contentType: 'image/gif', expectedExt: 'gif' },
                { contentType: 'image/svg+xml', expectedExt: 'svg' },
                { contentType: 'image/webp', expectedExt: 'webp' },
                { contentType: 'image/x-icon', expectedExt: 'ico' },
            ];

            for (const { contentType, expectedExt } of formats) {
                stubStorage = new StubStorage({ defaultBucketName: 'test-bucket' });
                const newStorage = new CloudTenantAssetStorage(stubStorage, emulatorBaseUrl);

                const url = await newStorage.uploadAsset('tenant-fmt', 'logo', Buffer.from('test'), contentType);

                expect(url).toContain(`.${expectedExt}`);
            }
        });

        it('should generate production URL when no emulator host', async () => {
            const assetStorage = new CloudTenantAssetStorage(stubStorage, prodBaseUrl);
            const buffer = Buffer.from('fake-data');

            const url = await assetStorage.uploadAsset('tenant-prod', 'logo', buffer, 'image/png');

            expect(url).toMatch(/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/test-bucket\/o\/tenant-assets%2Ftenant-prod%2Flogo-[0-9a-f]{16}\.png\?alt=media$/);
        });
    });

    describe('deleteAsset', () => {
        it('should delete asset by emulator URL', async () => {
            const assetStorage = new CloudTenantAssetStorage(stubStorage, emulatorBaseUrl);
            const buffer = Buffer.from('fake-data');

            // Upload first
            const url = await assetStorage.uploadAsset('tenant-del', 'logo', buffer, 'image/png');
            expect(stubStorage.getAllFiles().size).toBe(1);

            // Delete
            await assetStorage.deleteAsset(url);

            expect(stubStorage.getAllFiles().size).toBe(0);
        });

        it('should delete asset by production URL', async () => {
            const assetStorage = new CloudTenantAssetStorage(stubStorage, prodBaseUrl);
            const buffer = Buffer.from('fake-data');

            // Upload first
            const url = await assetStorage.uploadAsset('tenant-del-prod', 'logo', buffer, 'image/png');
            expect(stubStorage.getAllFiles().size).toBe(1);

            // Delete
            await assetStorage.deleteAsset(url);

            expect(stubStorage.getAllFiles().size).toBe(0);
        });

        it('should skip deletion of external URLs', async () => {
            const assetStorage = new CloudTenantAssetStorage(stubStorage, emulatorBaseUrl);

            // Try to delete external URL (should not throw)
            await assetStorage.deleteAsset('https://cdn.example.com/logo.png');

            // Should not have any files
            expect(stubStorage.getAllFiles().size).toBe(0);
        });

        it('should not throw on delete failure', async () => {
            const assetStorage = new CloudTenantAssetStorage(stubStorage, emulatorBaseUrl);

            // Try to delete non-existent file (should not throw)
            await expect(assetStorage.deleteAsset(`http://${emulatorHost}/v0/b/test-bucket/o/tenant-assets%2Fnon-existent%2Flogo.png?alt=media`)).resolves.toBeUndefined();
        });
    });
});
