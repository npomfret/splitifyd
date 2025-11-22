import { toGroupId, toUserId } from '@billsplit-wl/shared';
import { CreateGroupRequestBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../../constants';
import { ActivityFeedService } from '../../../../services/ActivityFeedService';
import { GroupCommentStrategy } from '../../../../services/comments/GroupCommentStrategy';
import { FirestoreReader, FirestoreWriter } from '../../../../services/firestore';
import { GroupMemberService } from '../../../../services/GroupMemberService';
import { AppDriver } from '../../AppDriver';

describe('GroupCommentStrategy', () => {
    let strategy: GroupCommentStrategy;
    let appDriver: AppDriver;

    beforeEach(() => {
        // Create AppDriver which sets up all real services
        appDriver = new AppDriver();

        // Get the strategy using appDriver's database but our own service instances
        const db = appDriver.database;
        const firestoreReader = new FirestoreReader(db);
        const firestoreWriter = new FirestoreWriter(db);
        const activityFeedService = new ActivityFeedService(firestoreReader, firestoreWriter);
        const groupMemberService = new GroupMemberService(firestoreReader, firestoreWriter, activityFeedService);

        strategy = new GroupCommentStrategy(firestoreReader, groupMemberService);
    });

    describe('verifyAccess', () => {
        it('should allow access when group exists and user is member', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            // Act & Assert
            await expect(strategy.verifyAccess(groupId, userId)).resolves.not.toThrow();
        });

        it('should throw NOT_FOUND when group does not exist', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);

            const nonexistentGroupId = toGroupId('nonexistent-group');

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
            const owner = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const ownerId = toUserId(owner.user.uid);

            const nonMember = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const nonMemberId = toUserId(nonMember.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), ownerId);
            const groupId = toGroupId(group.id);

            // Act & Assert
            await expect(strategy.verifyAccess(groupId, nonMemberId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                    code: 'ACCESS_DENIED',
                }),
            );
        });
    });
});
