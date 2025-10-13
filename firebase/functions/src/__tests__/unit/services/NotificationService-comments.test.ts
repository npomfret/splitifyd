import { beforeEach, describe, expect, it } from 'vitest';
import { type ChangeType, NotificationService } from '../../../services/notification-service';
import { StubFirestore, StubFirestoreReader } from '../mocks/firestore-stubs';

describe('NotificationService - Comments', () => {
    let notificationService: NotificationService;
    let stubReader: StubFirestore;
    let stubWriter: StubFirestore;

    beforeEach(() => {
        const stub = new StubFirestoreReader();
        stubReader = stub;
        stubWriter = stub;
        notificationService = new NotificationService(stubReader, stubWriter);
    });

    it('should update multiple users with "comment" change type in batchUpdateNotificationsMultipleTypes', async () => {
        const userIds = ['user1', 'user2'];
        const groupId = 'group456';
        const changeTypes: ChangeType[] = ['transaction', 'comment'];

        await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

        expect(stubWriter.setUserNotificationsCalls).toHaveLength(2);

        const firstUserCall = stubWriter.setUserNotificationsCalls[0];
        const firstUserUpdates = firstUserCall.updates;

        expect(firstUserUpdates.changeVersion).toBeDefined();
        expect(firstUserUpdates.groups[groupId]).toHaveProperty('lastTransactionChange');
        expect(firstUserUpdates.groups[groupId]).toHaveProperty('transactionChangeCount');
        expect(firstUserUpdates.groups[groupId]).toHaveProperty('lastCommentChange');
        expect(firstUserUpdates.groups[groupId]).toHaveProperty('commentChangeCount');
    });
});
