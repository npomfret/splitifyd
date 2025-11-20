import { StubStorage } from '@billsplit-wl/test-support';
import { toGroupId } from '@billsplit-wl/shared';
import { toDisplayName } from '@billsplit-wl/shared';
import { toTenantAppName, toTenantDomainName, toTenantFaviconUrl, toTenantId, toTenantLogoUrl, toTenantPrimaryColor, toTenantSecondaryColor } from '@billsplit-wl/shared';
import { GroupDTOBuilder, GroupMemberDocumentBuilder, TenantFirestoreTestDatabase } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import type { IFirestoreReader, IFirestoreWriter } from '../../../services/firestore';
import { ApiError } from '../../../utils/errors';
import { StubAuthService } from '../mocks/StubAuthService';
import { TenantPayloadBuilder } from '../TenantPayloadBuilder';

describe('FirestoreWriter.updateGroupMemberDisplayName', () => {
    let db: TenantFirestoreTestDatabase;
    let firestoreReader: IFirestoreReader;
    let firestoreWriter: IFirestoreWriter;

    beforeEach(() => {
        db = new TenantFirestoreTestDatabase();

        const applicationBuilder = new ComponentBuilder(new StubAuthService(), db, new StubStorage({ defaultBucketName: 'test-bucket' }));
        firestoreWriter = applicationBuilder.buildFirestoreWriter();
        firestoreReader = applicationBuilder.buildFirestoreReader();
    });

    describe('updateGroupMemberDisplayName', () => {
        const groupId = toGroupId('test-group');
        const userId = 'test-user';
        const newDisplayName = toDisplayName('Updated Display Name');

        beforeEach(() => {
            // Set up test group
            const testGroup = new GroupDTOBuilder()
                .withId(groupId)
                .withCreatedBy('owner-id')
                .build();
            db.seedGroup(groupId, testGroup);

            // Set up test member in top-level collection
            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .withGroupDisplayName('Original Name')
                .buildDocument();
            db.seedGroupMember(groupId, userId, memberDoc);
        });

        it('should successfully update group member display name', async () => {
            // Act
            await firestoreWriter.updateGroupMemberDisplayName(groupId, userId, newDisplayName);

            // Assert
            const updatedMember = await firestoreReader.getGroupMember(groupId, userId);
            expect(updatedMember).toBeDefined();
            expect(updatedMember?.groupDisplayName).toBe(newDisplayName);
        });

        it('should preserve other fields when updating display name', async () => {
            const beforeUpdate = await firestoreReader.getGroupMember(groupId, userId);

            // Act
            await firestoreWriter.updateGroupMemberDisplayName(groupId, userId, newDisplayName);

            // Assert
            const afterUpdate = await firestoreReader.getGroupMember(groupId, userId);
            expect(afterUpdate).toBeDefined();
            expect(afterUpdate?.uid).toBe(beforeUpdate?.uid);
            expect(afterUpdate?.groupId).toBe(beforeUpdate?.groupId);
            expect(afterUpdate?.memberRole).toBe(beforeUpdate?.memberRole);
        });

        it('should throw NOT_FOUND when member document does not exist', async () => {
            const nonExistentUserId = 'nonexistent-user';

            // Act & Assert
            let caughtError: ApiError | undefined;
            try {
                await firestoreWriter.updateGroupMemberDisplayName(groupId, nonExistentUserId, newDisplayName);
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(caughtError?.code).toBe('GROUP_MEMBER_NOT_FOUND');
        });

        it('should throw INVALID_INPUT when display name is empty', async () => {
            // Act & Assert
            let caughtError: ApiError | undefined;
            try {
                await firestoreWriter.updateGroupMemberDisplayName(groupId, userId, toDisplayName(''));
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
            expect(caughtError?.code).toBe('INVALID_INPUT');
        });

        it('should not modify other member fields when updating display name', async () => {
            const beforeUpdate = await firestoreReader.getGroupMember(groupId, userId);
            const originalRole = beforeUpdate?.memberRole;
            const originalStatus = beforeUpdate?.memberStatus;
            const originalTheme = beforeUpdate?.theme;

            // Act
            await firestoreWriter.updateGroupMemberDisplayName(groupId, userId, newDisplayName);

            // Assert - other fields should remain unchanged
            const afterUpdate = await firestoreReader.getGroupMember(groupId, userId);
            expect(afterUpdate?.memberRole).toBe(originalRole);
            expect(afterUpdate?.memberStatus).toBe(originalStatus);
            expect(afterUpdate?.theme).toEqual(originalTheme);
        });

        it('should handle display names with special characters', async () => {
            const specialName = toDisplayName('O\'Brien-Smith (Admin)');

            // Act
            await firestoreWriter.updateGroupMemberDisplayName(groupId, userId, specialName);

            // Assert
            const updatedMember = await firestoreReader.getGroupMember(groupId, userId);
            expect(updatedMember?.groupDisplayName).toBe(specialName);
        });

        it('should handle display names at maximum length', async () => {
            const maxLengthName = toDisplayName('A'.repeat(50)); // Assuming 50 is max length from validation

            // Act
            await firestoreWriter.updateGroupMemberDisplayName(groupId, userId, maxLengthName);

            // Assert
            const updatedMember = await firestoreReader.getGroupMember(groupId, userId);
            expect(updatedMember?.groupDisplayName).toBe(maxLengthName);
        });

        it('should throw DISPLAY_NAME_TAKEN when name is already in use by another member', async () => {
            // Set up second member with a different display name
            const otherUserId = 'other-user';
            const takenName = toDisplayName('Taken Display Name');
            const otherMember = new GroupMemberDocumentBuilder()
                .withUserId(otherUserId)
                .withGroupId(groupId)
                .withGroupDisplayName(takenName)
                .buildDocument();
            db.seedGroupMember(groupId, otherUserId, otherMember);

            // Act & Assert - try to update first user to the taken name
            let caughtError: ApiError | undefined;
            try {
                await firestoreWriter.updateGroupMemberDisplayName(groupId, userId, takenName);
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.CONFLICT);
            expect(caughtError?.code).toBe('DISPLAY_NAME_TAKEN');
            expect(caughtError?.message).toContain(takenName);
        });

        it('should allow user to keep their current display name (idempotent)', async () => {
            const currentName = toDisplayName('Original Name');

            // Verify current name
            const beforeUpdate = await firestoreReader.getGroupMember(groupId, userId);
            expect(beforeUpdate?.groupDisplayName).toBe(currentName);

            // Act - update to same name (idempotent operation)
            await firestoreWriter.updateGroupMemberDisplayName(groupId, userId, currentName);

            // Assert - should succeed without error
            const afterUpdate = await firestoreReader.getGroupMember(groupId, userId);
            expect(afterUpdate?.groupDisplayName).toBe(currentName);
        });
    });
});

describe('FirestoreWriter.upsertTenant - Default Tenant Enforcement', () => {
    let db: TenantFirestoreTestDatabase;
    let firestoreReader: IFirestoreReader;
    let firestoreWriter: IFirestoreWriter;

    beforeEach(() => {
        db = new TenantFirestoreTestDatabase();

        const applicationBuilder = new ComponentBuilder(new StubAuthService(), db, new StubStorage({ defaultBucketName: 'test-bucket' }));
        firestoreWriter = applicationBuilder.buildFirestoreWriter();
        firestoreReader = applicationBuilder.buildFirestoreReader();
    });

    it('should prevent removing default flag from default tenant', async () => {
        const tenantId = 'test-tenant-1';

        // Create a default tenant
        await firestoreWriter.upsertTenant(
            tenantId,
            new TenantPayloadBuilder('test-tenant')
                .withBranding({
                    appName: toTenantAppName('Test Tenant 1'),
                    logoUrl: toTenantLogoUrl('/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#000000'),
                    secondaryColor: toTenantSecondaryColor('#ffffff'),
                })
                .withDomains([toTenantDomainName('test1.example.com')])
                .withDefaultTenantFlag(true)
                .build(),
        );

        // Try to remove the default flag
        let caughtError: ApiError | undefined;
        try {
            await firestoreWriter.upsertTenant(
                tenantId,
                new TenantPayloadBuilder('test-tenant')
                    .withBranding({
                        appName: toTenantAppName('Test Tenant 1'),
                        logoUrl: toTenantLogoUrl('/logo.svg'),
                        faviconUrl: toTenantFaviconUrl('/favicon.ico'),
                        primaryColor: toTenantPrimaryColor('#000000'),
                        secondaryColor: toTenantSecondaryColor('#ffffff'),
                    })
                    .withDomains([toTenantDomainName('test1.example.com')])
                    .withDefaultTenantFlag(false)
                    .build(),
            );
        } catch (error) {
            caughtError = error as ApiError;
        }

        // Assert
        expect(caughtError).toBeInstanceOf(ApiError);
        expect(caughtError?.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
        expect(caughtError?.code).toBe('CANNOT_REMOVE_DEFAULT_TENANT');
        expect(caughtError?.message).toContain('Cannot remove default tenant flag');
    });

    it('should transfer default flag when setting another tenant as default', async () => {
        const tenant1Id = 'test-tenant-1';
        const tenant2Id = 'test-tenant-2';

        // Create first tenant as default
        await firestoreWriter.upsertTenant(
            tenant1Id,
            new TenantPayloadBuilder('test-tenant')
                .withBranding({
                    appName: toTenantAppName('Test Tenant 1'),
                    logoUrl: toTenantLogoUrl('/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#000000'),
                    secondaryColor: toTenantSecondaryColor('#ffffff'),
                })
                .withDomains([toTenantDomainName('test1.example.com')])
                .withDefaultTenantFlag(true)
                .build(),
        );

        // Verify tenant1 is default
        const tenant1Before = await firestoreReader.getTenantById(toTenantId(tenant1Id));
        expect(tenant1Before?.isDefault).toBe(true);

        // Create second tenant and make it default
        await firestoreWriter.upsertTenant(
            tenant2Id,
            new TenantPayloadBuilder('test-tenant')
                .withBranding({
                    appName: toTenantAppName('Test Tenant 2'),
                    logoUrl: toTenantLogoUrl('/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#000000'),
                    secondaryColor: toTenantSecondaryColor('#ffffff'),
                })
                .withDomains([toTenantDomainName('test2.example.com')])
                .withDefaultTenantFlag(true)
                .build(),
        );

        // Verify tenant2 is now default
        const tenant2After = await firestoreReader.getTenantById(toTenantId(tenant2Id));
        expect(tenant2After?.isDefault).toBe(true);

        // Verify tenant1 is no longer default
        const tenant1After = await firestoreReader.getTenantById(toTenantId(tenant1Id));
        expect(tenant1After?.isDefault).toBe(false);
    });

    it('should allow creating a non-default tenant when a default already exists', async () => {
        const tenant1Id = 'test-tenant-1';
        const tenant2Id = 'test-tenant-2';

        // Create default tenant
        await firestoreWriter.upsertTenant(
            tenant1Id,
            new TenantPayloadBuilder('test-tenant')
                .withBranding({
                    appName: toTenantAppName('Test Tenant 1'),
                    logoUrl: toTenantLogoUrl('/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#000000'),
                    secondaryColor: toTenantSecondaryColor('#ffffff'),
                })
                .withDomains([toTenantDomainName('test1.example.com')])
                .withDefaultTenantFlag(true)
                .build(),
        );

        // Create non-default tenant (should not throw)
        await firestoreWriter.upsertTenant(
            tenant2Id,
            new TenantPayloadBuilder('test-tenant')
                .withBranding({
                    appName: toTenantAppName('Test Tenant 2'),
                    logoUrl: toTenantLogoUrl('/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#000000'),
                    secondaryColor: toTenantSecondaryColor('#ffffff'),
                })
                .withDomains([toTenantDomainName('test2.example.com')])
                .withDefaultTenantFlag(false)
                .build(),
        );

        // Verify both tenants exist with correct default flags
        const tenant1 = await firestoreReader.getTenantById(toTenantId(tenant1Id));
        const tenant2 = await firestoreReader.getTenantById(toTenantId(tenant2Id));

        expect(tenant1?.isDefault).toBe(true);
        expect(tenant2?.isDefault).toBe(false);
    });

    it('should allow updating non-default tenant without affecting default tenant', async () => {
        const tenant1Id = 'test-tenant-1';
        const tenant2Id = 'test-tenant-2';

        // Create default and non-default tenants
        await firestoreWriter.upsertTenant(
            tenant1Id,
            new TenantPayloadBuilder('test-tenant')
                .withBranding({
                    appName: toTenantAppName('Test Tenant 1'),
                    logoUrl: toTenantLogoUrl('/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#000000'),
                    secondaryColor: toTenantSecondaryColor('#ffffff'),
                })
                .withDomains([toTenantDomainName('test1.example.com')])
                .withDefaultTenantFlag(true)
                .build(),
        );
        await firestoreWriter.upsertTenant(
            tenant2Id,
            new TenantPayloadBuilder('test-tenant')
                .withBranding({
                    appName: toTenantAppName('Test Tenant 2'),
                    logoUrl: toTenantLogoUrl('/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#000000'),
                    secondaryColor: toTenantSecondaryColor('#ffffff'),
                })
                .withDomains([toTenantDomainName('test2.example.com')])
                .withDefaultTenantFlag(false)
                .build(),
        );

        // Update non-default tenant (keeping it non-default)
        await firestoreWriter.upsertTenant(
            tenant2Id,
            new TenantPayloadBuilder('test-tenant')
                .withBranding({
                    appName: toTenantAppName('Updated Tenant 2'),
                    logoUrl: toTenantLogoUrl('/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#000000'),
                    secondaryColor: toTenantSecondaryColor('#ffffff'),
                })
                .withDomains([toTenantDomainName('test2.example.com')])
                .withDefaultTenantFlag(false)
                .build(),
        );

        // Verify tenant1 is still default
        const tenant1 = await firestoreReader.getTenantById(toTenantId(tenant1Id));
        expect(tenant1?.isDefault).toBe(true);

        // Verify tenant2 is updated but still not default
        const tenant2 = await firestoreReader.getTenantById(toTenantId(tenant2Id));
        expect(tenant2?.isDefault).toBe(false);
        expect(tenant2?.tenant.branding.appName).toBe('Updated Tenant 2');
    });
});
