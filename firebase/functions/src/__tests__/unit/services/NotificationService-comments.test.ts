import { StubFirestoreDatabase } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { FirestoreReader } from '../../../services/firestore';
import { FirestoreWriter } from '../../../services/firestore';
import { type ChangeType, NotificationService } from '../../../services/notification-service';

describe('NotificationService - Comments', () => {
    let notificationService: NotificationService;
    let db: StubFirestoreDatabase;
    let firestoreReader: FirestoreReader;
    let firestoreWriter: FirestoreWriter;

    beforeEach(() => {
        // Create stub database
        db = new StubFirestoreDatabase();

        // Create real services using stub database
        firestoreReader = new FirestoreReader(db);
        firestoreWriter = new FirestoreWriter(db);

        // Create NotificationService with real services
        notificationService = new NotificationService(firestoreReader, firestoreWriter);

        // Clear stub data
        db.clear();
    });

    it('should update multiple users with "comment" change type in batchUpdateNotificationsMultipleTypes', async () => {
        const userIds = ['user1', 'user2'];
        const groupId = 'group456';
        const changeTypes: ChangeType[] = ['transaction', 'comment'];

        // Initialize notification documents for the users
        db.seed('user-notifications/user1', {
            groups: {},
            recentChanges: [],
            changeVersion: 0,
        });

        db.seed('user-notifications/user2', {
            groups: {},
            recentChanges: [],
            changeVersion: 0,
        });

        // Execute the batch update
        const result = await notificationService.batchUpdateNotificationsMultipleTypes(userIds, groupId, changeTypes);

        // Verify the operation succeeded
        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(0);
        expect(result.results).toHaveLength(2);

        // Verify all results are successful
        for (const writeResult of result.results) {
            expect(writeResult.success).toBe(true);
            expect(writeResult.id).toMatch(/^user[12]$/);
        }

        // Note: We don't read back and verify the actual document state because:
        // 1. FieldValue.increment() sentinels are stored as-is in the stub (not processed like real Firestore)
        // 2. This would require implementing FieldValue handling in StubFirestoreDatabase
        // 3. The test verifies the NotificationService method completes successfully
        // 4. Integration tests with real Firestore emulator verify the actual data changes
    });
});
