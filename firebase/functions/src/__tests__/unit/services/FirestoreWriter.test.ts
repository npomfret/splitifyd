import { toDisplayName, toGroupId, toTenantDomainName, toTenantId, toUserId } from '@billsplit-wl/shared';
import { CreateGroupRequestBuilder, StubFirestoreDatabase, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { StubCloudTasksClient, StubStorage } from 'ts-firebase-simulator';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ErrorCode } from '../../../errors';
import { ApiError } from '../../../errors';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { FakeEmailService } from '../../../services/email';
import type { IFirestoreReader, IFirestoreWriter } from '../../../services/firestore';
import { AppDriver } from '../AppDriver';
import { StubAuthService } from '../mocks/StubAuthService';
import { TenantPayloadBuilder } from '../TenantPayloadBuilder';

import { createUnitTestServiceConfig, StubGroupAttachmentStorage } from '../../test-config';

describe('FirestoreWriter.updateGroupMemberDisplayName', () => {
    let app: AppDriver;
    let firestoreReader: IFirestoreReader;
    let firestoreWriter: IFirestoreWriter;

    beforeEach(() => {
        app = new AppDriver();

        firestoreWriter = app.componentBuilder.buildFirestoreWriter();
        firestoreReader = app.componentBuilder.buildFirestoreReader();
    });

    describe('updateGroupMemberDisplayName', () => {
        let groupId: string;
        let userId: string;
        let ownerToken: string;
        const newDisplayName = toDisplayName('Updated Display Name');

        beforeEach(async () => {
            // Register owner via API
            const ownerReg = new UserRegistrationBuilder()
                .withEmail('owner@test.com')
                .withPassword('password123456')
                .withDisplayName('Owner User')
                .build();
            const ownerResult = await app.registerUser(ownerReg);
            ownerToken = ownerResult.user.uid;

            // Register test user via API
            const userReg = new UserRegistrationBuilder()
                .withEmail('testuser@test.com')
                .withPassword('password123456')
                .withDisplayName('Original Name')
                .build();
            const userResult = await app.registerUser(userReg);
            userId = userResult.user.uid;

            // Create group via API
            const groupRequest = new CreateGroupRequestBuilder()
                .withName('Test Group')
                .build();
            const group = await app.createGroup(groupRequest, ownerToken);
            groupId = group.id;

            // Add test user as member - need to use group sharing
            const shareLink = await app.generateShareableLink(groupId, undefined, ownerToken);
            await app.joinGroupByLink(shareLink.shareToken, 'Original Name', userId);
        });

        it('should successfully update group member display name', async () => {
            // Act
            await firestoreWriter.updateGroupMemberDisplayName(toGroupId(groupId), toUserId(userId), newDisplayName);

            // Assert
            const updatedMember = await firestoreReader.getGroupMember(toGroupId(groupId), toUserId(userId));
            expect(updatedMember).toBeDefined();
            expect(updatedMember?.groupDisplayName).toBe(newDisplayName);
        });

        it('should preserve other fields when updating display name', async () => {
            const beforeUpdate = await firestoreReader.getGroupMember(toGroupId(groupId), toUserId(userId));

            // Act
            await firestoreWriter.updateGroupMemberDisplayName(toGroupId(groupId), toUserId(userId), newDisplayName);

            // Assert
            const afterUpdate = await firestoreReader.getGroupMember(toGroupId(groupId), toUserId(userId));
            expect(afterUpdate).toBeDefined();
            expect(afterUpdate?.uid).toBe(beforeUpdate?.uid);
            expect(afterUpdate?.groupId).toBe(beforeUpdate?.groupId);
            expect(afterUpdate?.memberRole).toBe(beforeUpdate?.memberRole);
        });

        it('should throw NOT_FOUND when member document does not exist', async () => {
            const nonExistentUserId = toUserId('nonexistent-user');

            // Act & Assert
            let caughtError: ApiError | undefined;
            try {
                await firestoreWriter.updateGroupMemberDisplayName(toGroupId(groupId), nonExistentUserId, newDisplayName);
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(caughtError?.code).toBe(ErrorCode.NOT_FOUND);
        });

        it('should throw VALIDATION_ERROR when display name is empty', async () => {
            // Act & Assert
            let caughtError: ApiError | undefined;
            try {
                await firestoreWriter.updateGroupMemberDisplayName(toGroupId(groupId), toUserId(userId), toDisplayName(''));
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
            expect(caughtError?.code).toBe(ErrorCode.VALIDATION_ERROR);
        });

        it('should not modify other member fields when updating display name', async () => {
            const beforeUpdate = await firestoreReader.getGroupMember(toGroupId(groupId), toUserId(userId));
            const originalRole = beforeUpdate?.memberRole;
            const originalStatus = beforeUpdate?.memberStatus;
            const originalTheme = beforeUpdate?.theme;

            // Act
            await firestoreWriter.updateGroupMemberDisplayName(toGroupId(groupId), toUserId(userId), newDisplayName);

            // Assert - other fields should remain unchanged
            const afterUpdate = await firestoreReader.getGroupMember(toGroupId(groupId), toUserId(userId));
            expect(afterUpdate?.memberRole).toBe(originalRole);
            expect(afterUpdate?.memberStatus).toBe(originalStatus);
            expect(afterUpdate?.theme).toEqual(originalTheme);
        });

        it('should handle display names with special characters', async () => {
            const specialName = toDisplayName('O\'Brien-Smith (Admin)');

            // Act
            await firestoreWriter.updateGroupMemberDisplayName(toGroupId(groupId), toUserId(userId), specialName);

            // Assert
            const updatedMember = await firestoreReader.getGroupMember(toGroupId(groupId), toUserId(userId));
            expect(updatedMember?.groupDisplayName).toBe(specialName);
        });

        it('should handle display names at maximum length', async () => {
            const maxLengthName = toDisplayName('A'.repeat(50)); // Assuming 50 is max length from validation

            // Act
            await firestoreWriter.updateGroupMemberDisplayName(toGroupId(groupId), toUserId(userId), maxLengthName);

            // Assert
            const updatedMember = await firestoreReader.getGroupMember(toGroupId(groupId), toUserId(userId));
            expect(updatedMember?.groupDisplayName).toBe(maxLengthName);
        });

        it('should throw DISPLAY_NAME_TAKEN when name is already in use by another member', async () => {
            // Register and add second member via API
            const otherUserReg = new UserRegistrationBuilder()
                .withEmail('other@test.com')
                .withPassword('password123456')
                .withDisplayName('Taken Display Name')
                .build();
            const otherUserResult = await app.registerUser(otherUserReg);
            const otherUserId = otherUserResult.user.uid;

            // Add other user to the group
            const shareLink = await app.generateShareableLink(groupId, undefined, ownerToken);
            await app.joinGroupByLink(shareLink.shareToken, 'Taken Display Name', otherUserId);

            const takenName = toDisplayName('Taken Display Name');

            // Act & Assert - try to update first user to the taken name
            let caughtError: ApiError | undefined;
            try {
                await firestoreWriter.updateGroupMemberDisplayName(toGroupId(groupId), toUserId(userId), takenName);
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.CONFLICT);
            expect(caughtError?.code).toBe(ErrorCode.CONFLICT);
        });

        it('should allow user to keep their current display name (idempotent)', async () => {
            const currentName = toDisplayName('Original Name');

            // Verify current name
            const beforeUpdate = await firestoreReader.getGroupMember(toGroupId(groupId), toUserId(userId));
            expect(beforeUpdate?.groupDisplayName).toBe(currentName);

            // Act - update to same name (idempotent operation)
            await firestoreWriter.updateGroupMemberDisplayName(toGroupId(groupId), toUserId(userId), currentName);

            // Assert - should succeed without error
            const afterUpdate = await firestoreReader.getGroupMember(toGroupId(groupId), toUserId(userId));
            expect(afterUpdate?.groupDisplayName).toBe(currentName);
        });
    });
});

describe('FirestoreWriter.upsertTenant - Default Tenant Enforcement', () => {
    let db: StubFirestoreDatabase;
    let firestoreReader: IFirestoreReader;
    let firestoreWriter: IFirestoreWriter;

    beforeEach(() => {
        db = new StubFirestoreDatabase();
        const storage = new StubStorage({ defaultBucketName: 'test-bucket' });

        const applicationBuilder = new ComponentBuilder(
            new StubAuthService(),
            new FakeEmailService(),
            db,
            storage,
            new StubCloudTasksClient(),
            createUnitTestServiceConfig(),
            new StubGroupAttachmentStorage(storage),
        );
        firestoreWriter = applicationBuilder.buildFirestoreWriter();
        firestoreReader = applicationBuilder.buildFirestoreReader();
    });

    it('should prevent removing default flag from default tenant', async () => {
        const tenantId = 'test-tenant-1';

        // Create a default tenant
        await firestoreWriter.upsertTenant(
            tenantId,
            new TenantPayloadBuilder('test-tenant')
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
        expect(caughtError?.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should transfer default flag when setting another tenant as default', async () => {
        const tenant1Id = 'test-tenant-1';
        const tenant2Id = 'test-tenant-2';

        // Create first tenant as default
        await firestoreWriter.upsertTenant(
            tenant1Id,
            new TenantPayloadBuilder('test-tenant')
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
                .withDomains([toTenantDomainName('test1.example.com')])
                .withDefaultTenantFlag(true)
                .build(),
        );

        // Create non-default tenant (should not throw)
        await firestoreWriter.upsertTenant(
            tenant2Id,
            new TenantPayloadBuilder('test-tenant')
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
                .withDomains([toTenantDomainName('test1.example.com')])
                .withDefaultTenantFlag(true)
                .build(),
        );
        await firestoreWriter.upsertTenant(
            tenant2Id,
            new TenantPayloadBuilder('test-tenant')
                .withDomains([toTenantDomainName('test2.example.com')])
                .withDefaultTenantFlag(false)
                .build(),
        );

        // Update non-default tenant (keeping it non-default)
        await firestoreWriter.upsertTenant(
            tenant2Id,
            new TenantPayloadBuilder('test-tenant')
                .withAppName('Updated Tenant 2')
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
        expect(tenant2?.tenant.brandingTokens.tokens.legal.appName).toBe('Updated Tenant 2');
    });
});
