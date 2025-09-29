import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationService, type ChangeType } from '../../../services/notification-service';
import { StubFirestoreReader, StubFirestoreWriter } from '../mocks/firestore-stubs';

// Mock logger
vi.mock('firebase-functions', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('../../../monitoring/measure', () => ({
    measureDb: vi.fn((name, fn) => fn()),
}));

describe('NotificationService - Comments', () => {
    let notificationService: NotificationService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;

    beforeEach(() => {
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();
        notificationService = new NotificationService(stubReader, stubWriter);
        vi.clearAllMocks();
    });

    it('should handle "comment" change type correctly in updateUserNotification', async () => {
        const userId = 'user123';
        const groupId = 'group456';

        await notificationService.updateUserNotification(userId, groupId, 'comment');

        expect(stubWriter.setUserNotificationsCalls).toHaveLength(1);
        const [call] = stubWriter.setUserNotificationsCalls;
        expect(call.userId).toBe(userId);
        expect(call.updates.groups[groupId]).toHaveProperty('lastCommentChange');
        expect(call.updates.groups[groupId]).toHaveProperty('commentChangeCount');
        expect(call.merge).toBe(true);
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

    it('should use correct field names for "comment" change type', async () => {
        const userId = 'user123';
        const groupId = 'group456';

        const testCase = {
            changeType: 'comment' as const,
            expectedFields: ['lastCommentChange', 'commentChangeCount'],
        };

        await notificationService.updateUserNotification(userId, groupId, testCase.changeType);

        expect(stubWriter.setUserNotificationsCalls).toHaveLength(1);
        const { updates } = stubWriter.setUserNotificationsCalls[0];


        testCase.expectedFields.forEach(fieldName => {
            expect(updates.groups[groupId]).toHaveProperty(fieldName);
        });
    });
});