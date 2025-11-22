import { toGroupId, toUserId } from '@billsplit-wl/shared';
import { TenantFirestoreTestDatabase } from '@billsplit-wl/test-support';
import { GroupMemberDocumentBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../../constants';
import { ActivityFeedService } from '../../../../services/ActivityFeedService';
import { GroupCommentStrategy } from '../../../../services/comments/GroupCommentStrategy';
import { FirestoreReader } from '../../../../services/firestore';
import { FirestoreWriter } from '../../../../services/firestore';
import { GroupMemberService } from '../../../../services/GroupMemberService';

const testUser = toUserId('test-user');

describe('GroupCommentStrategy', () => {
    let strategy: GroupCommentStrategy;
    let db: TenantFirestoreTestDatabase;
    let firestoreReader: FirestoreReader;
    let groupMemberService: GroupMemberService;

    beforeEach(() => {
        // Create stub database
        db = new TenantFirestoreTestDatabase();

        // Create real services using stub database
        firestoreReader = new FirestoreReader(db);
        const firestoreWriter = new FirestoreWriter(db);
        const activityFeedService = new ActivityFeedService(firestoreReader, firestoreWriter);
        groupMemberService = new GroupMemberService(firestoreReader, firestoreWriter, activityFeedService);

        // Create strategy with real services
        strategy = new GroupCommentStrategy(firestoreReader, groupMemberService);
    });

    describe('verifyAccess', () => {
        it('should allow access when group exists and user is member', async () => {
            // Arrange
            const groupId = toGroupId('test-group');
            const userId = testUser;

            // Seed group data
            db.seedGroup(groupId, { name: 'Test Group' });

            // Seed user and group membership
            db.seedUser(userId, { email: 'test@example.com', displayName: 'Test User' });
            const membershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, userId, membershipDoc);

            // Act & Assert
            await expect(strategy.verifyAccess(groupId, userId)).resolves.not.toThrow();
        });

        it('should throw NOT_FOUND when group does not exist', async () => {
            // Arrange
            const nonexistentGroupId = toGroupId('nonexistent-group');
            const userId = testUser;

            // No group data seeded - simulating non-existent group

            // Act & Assert
            await expect(strategy.verifyAccess(nonexistentGroupId, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'GROUP_NOT_FOUND',
                }),
            );
        });

        it('should throw FORBIDDEN when user is not a group member', async () => {
            // Arrange
            const groupId = toGroupId('test-group');
            const userId = toUserId('unauthorized-user');

            // Seed group but not user membership
            db.seedGroup(groupId, { name: 'Test Group' });
            db.seedUser(userId, { email: 'unauthorized@example.com', displayName: 'Unauthorized User' });

            // No group membership seeded for this user

            // Act & Assert
            await expect(strategy.verifyAccess(groupId, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                    code: 'ACCESS_DENIED',
                }),
            );
        });
    });
});
