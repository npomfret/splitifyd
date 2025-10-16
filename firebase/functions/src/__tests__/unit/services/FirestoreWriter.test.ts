import { GroupDTOBuilder, StubFirestoreDatabase } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import { FirestoreReader } from '../../../services/firestore';
import type { IFirestoreWriter } from '../../../services/firestore';
import { ApiError } from '../../../utils/errors';
import { GroupMemberDocumentBuilder } from '../../support/GroupMemberDocumentBuilder';
import { StubAuthService } from '../mocks/StubAuthService';

describe('FirestoreWriter.updateGroupMemberDisplayName', () => {
    let db: StubFirestoreDatabase;
    let firestoreReader: FirestoreReader;
    let firestoreWriter: IFirestoreWriter;
    let stubAuth: StubAuthService;

    beforeEach(() => {
        // Create stub database
        db = new StubFirestoreDatabase();

        // Create reader and writer instances that wrap the database
        firestoreReader = new FirestoreReader(db);
        stubAuth = new StubAuthService();

        // Create ApplicationBuilder and build FirestoreWriter
        const applicationBuilder = new ApplicationBuilder(stubAuth, db);
        firestoreWriter = applicationBuilder.buildFirestoreWriter();
    });

    describe('updateGroupMemberDisplayName', () => {
        const groupId = 'test-group';
        const userId = 'test-user';
        const newDisplayName = 'Updated Display Name';

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
                await firestoreWriter.updateGroupMemberDisplayName(groupId, userId, '');
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
            const specialName = 'O\'Brien-Smith (Admin)';

            // Act
            await firestoreWriter.updateGroupMemberDisplayName(groupId, userId, specialName);

            // Assert
            const updatedMember = await firestoreReader.getGroupMember(groupId, userId);
            expect(updatedMember?.groupDisplayName).toBe(specialName);
        });

        it('should handle display names at maximum length', async () => {
            const maxLengthName = 'A'.repeat(50); // Assuming 50 is max length from validation

            // Act
            await firestoreWriter.updateGroupMemberDisplayName(groupId, userId, maxLengthName);

            // Assert
            const updatedMember = await firestoreReader.getGroupMember(groupId, userId);
            expect(updatedMember?.groupDisplayName).toBe(maxLengthName);
        });

        it('should throw DISPLAY_NAME_TAKEN when name is already in use by another member', async () => {
            // Set up second member with a different display name
            const otherUserId = 'other-user';
            const takenName = 'Taken Display Name';
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
            const currentName = 'Original Name';

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
