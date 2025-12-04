import { SystemUserRoles, toTenantDomainName, toTenantImageId, type UserId } from '@billsplit-wl/shared';
import { AdminTenantRequestBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

// Create a valid PNG buffer with proper magic number header
function createValidPngBuffer(size: number = 100): Buffer {
    // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
    const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return Buffer.from([...pngHeader, ...Array(size).fill(0)]);
}

describe('Tenant Image Library API', () => {
    let appDriver: AppDriver;
    let adminUser: string;
    let tenantId: string;

    beforeEach(async () => {
        appDriver = new AppDriver();

        // Create admin user
        const adminReg = new UserRegistrationBuilder()
            .withEmail('imageadmin@example.com')
            .withDisplayName('Image Admin User')
            .withPassword('password12345')
            .build();
        const adminResult = await appDriver.registerUser(adminReg);
        adminUser = adminResult.user.uid;
        appDriver.seedAdminUser(adminUser);

        // Create a test tenant
        tenantId = `test-tenant-${Date.now()}`;
        const tenantPayload = AdminTenantRequestBuilder
            .forTenant(tenantId)
            .withAppName('Test Image Library Tenant')
            .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
            .build();

        await appDriver.adminUpsertTenant(tenantPayload, adminUser);
    });

    afterEach(() => {
        if (appDriver) {
            appDriver.dispose();
        }
    });

    describe('GET /admin/tenants/:tenantId/images - listTenantImages', () => {
        it('should return empty list when no images exist', async () => {
            const result = await appDriver.listTenantImages(tenantId, adminUser);

            expect(result).toMatchObject({
                images: [],
            });
        });

        it('should return images after upload', async () => {
            // Upload an image first
            const imageBuffer = createValidPngBuffer();
            await appDriver.uploadTenantLibraryImage(tenantId, 'Test Image', imageBuffer, 'image/png', adminUser);

            const result = await appDriver.listTenantImages(tenantId, adminUser);

            expect(result.images).toHaveLength(1);
            expect(result.images[0]).toMatchObject({
                name: 'Test Image',
                contentType: 'image/png',
            });
        });

        it('should require tenant admin permission', async () => {
            // Create a regular user (not admin)
            const regularReg = new UserRegistrationBuilder()
                .withEmail('regular@example.com')
                .withDisplayName('Regular User')
                .withPassword('password12345')
                .build();
            const regularResult = await appDriver.registerUser(regularReg);
            const regularUser = regularResult.user.uid;

            await expect(appDriver.listTenantImages(tenantId, regularUser))
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });
    });

    describe('POST /admin/tenants/:tenantId/images - uploadTenantLibraryImage', () => {
        it('should upload an image successfully', async () => {
            const imageBuffer = createValidPngBuffer(200);

            const result = await appDriver.uploadTenantLibraryImage(
                tenantId,
                'Upload Test Image',
                imageBuffer,
                'image/png',
                adminUser,
            );

            expect(result.image).toMatchObject({
                name: 'Upload Test Image',
                contentType: 'image/png',
                sizeBytes: imageBuffer.length,
            });
            expect(result.image.id).toBeTruthy();
            expect(result.image.url).toBeTruthy();
            expect(result.image.uploadedAt).toBeTruthy();
        });

        it('should reject empty image name', async () => {
            const imageBuffer = createValidPngBuffer();

            await expect(appDriver.uploadTenantLibraryImage(
                tenantId,
                '',
                imageBuffer,
                'image/png',
                adminUser,
            ))
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR' });
        });

        it('should reject empty file', async () => {
            const emptyBuffer = Buffer.from([]);

            await expect(appDriver.uploadTenantLibraryImage(
                tenantId,
                'Empty File Test',
                emptyBuffer,
                'image/png',
                adminUser,
            ))
                .rejects
                .toMatchObject({ code: 'INVALID_REQUEST' });
        });
    });

    describe('PATCH /admin/tenants/:tenantId/images/:imageId - renameTenantImage', () => {
        it('should rename an image successfully', async () => {
            // First upload an image
            const imageBuffer = createValidPngBuffer();
            const uploadResult = await appDriver.uploadTenantLibraryImage(
                tenantId,
                'Original Name',
                imageBuffer,
                'image/png',
                adminUser,
            );
            const imageId = uploadResult.image.id;

            // Rename the image
            await appDriver.renameTenantImage(tenantId, imageId, { name: 'New Name' }, adminUser);

            // Verify the rename
            const listResult = await appDriver.listTenantImages(tenantId, adminUser);
            const renamedImage = listResult.images.find((img) => img.id === imageId);

            expect(renamedImage).toBeDefined();
            expect(renamedImage!.name).toBe('New Name');
        });

        it('should reject empty name', async () => {
            const imageBuffer = createValidPngBuffer();
            const uploadResult = await appDriver.uploadTenantLibraryImage(
                tenantId,
                'Test Image',
                imageBuffer,
                'image/png',
                adminUser,
            );

            await expect(appDriver.renameTenantImage(tenantId, uploadResult.image.id, { name: '' }, adminUser))
                .rejects
                .toMatchObject({ code: 'VALIDATION_ERROR' });
        });

        it('should return 404 for non-existent image', async () => {
            const fakeImageId = toTenantImageId('non-existent-image-id');

            await expect(appDriver.renameTenantImage(tenantId, fakeImageId, { name: 'New Name' }, adminUser))
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });
    });

    describe('DELETE /admin/tenants/:tenantId/images/:imageId - deleteTenantImage', () => {
        it('should delete an image successfully', async () => {
            // First upload an image
            const imageBuffer = createValidPngBuffer();
            const uploadResult = await appDriver.uploadTenantLibraryImage(
                tenantId,
                'To Delete',
                imageBuffer,
                'image/png',
                adminUser,
            );
            const imageId = uploadResult.image.id;

            // Verify it exists
            let listResult = await appDriver.listTenantImages(tenantId, adminUser);
            expect(listResult.images.some((img) => img.id === imageId)).toBe(true);

            // Delete the image
            await appDriver.deleteTenantImage(tenantId, imageId, adminUser);

            // Verify it's gone
            listResult = await appDriver.listTenantImages(tenantId, adminUser);
            expect(listResult.images.some((img) => img.id === imageId)).toBe(false);
        });

        it('should return 404 for non-existent image', async () => {
            const fakeImageId = toTenantImageId('non-existent-image-id');

            await expect(appDriver.deleteTenantImage(tenantId, fakeImageId, adminUser))
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });
    });
});
