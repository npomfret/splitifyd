import { PooledTestUser } from '@splitifyd/shared';
import { ApiDriver, borrowTestUsers, CreateExpenseRequestBuilder, generateShortId, NotificationDriver } from '@splitifyd/test-support';
import { beforeEach, describe, expect, test } from 'vitest';
import { getFirestore } from '../../firebase';

/**
 * Minimal Comments integration tests - ONLY testing Firebase security rules
 * that cannot be stubbed.
 *
 * IMPORTANT: All other comment tests have been moved to unit tests:
 * - firebase/functions/src/__tests__/unit/comments/CommentHandlers.test.ts - CRUD business logic
 * - firebase/functions/src/__tests__/unit/comments/CommentRealtime.test.ts - Real-time subscriptions
 */
describe('Comments Integration Tests (Firebase Security Rules Only)', () => {
    const apiDriver = new ApiDriver();
    const notificationDriver = new NotificationDriver(getFirestore());
    let testGroup: any;
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(3);
        const members = users.slice(0, 2);

        // Create group
        testGroup = await apiDriver.createGroupWithMembers(generateShortId(), members, members[0].token);

        // Create expense for comment testing
        const expenseData = new CreateExpenseRequestBuilder()
            .withGroupId(testGroup.id)
            .withDescription(`Expense for comment testing ${generateShortId()}`)
            .withAmount(50.0, 'USD')
            .withPaidBy(members[0].uid)
            .withParticipants(members.map((u) => u.uid))
            .withCategory('test')
            .withSplitType('equal')
            .build();

        await apiDriver.createExpense(expenseData, members[0].token);
    });

    afterEach(async () => {
        // Wait for system to settle before stopping listeners
        await notificationDriver.waitForQuiet();
        await notificationDriver.stopAllListeners();
    });

    describe('Firebase Security Rules and Authentication', () => {
        test('should enforce authentication for comment creation via API', async () => {
            // This tests actual Firebase security rules that cannot be stubbed
            await expect(apiDriver.createGroupComment(testGroup.id, 'Test comment', '')).rejects.toThrow(/401|unauthorized/i);
        });

        test('should enforce group membership via security rules', async () => {
            // This tests actual Firebase security rules for access control
            await expect(apiDriver.createGroupComment(testGroup.id, 'Test comment', users[2].token)).rejects.toThrow(/403|forbidden|access denied/i);
        });
    });

    // REMOVED: Real-time Firestore Subscriptions tests (2 tests)
    // These have been migrated to unit tests in:
    // firebase/functions/src/__tests__/unit/comments/CommentRealtime.test.ts
    //
    // The unit tests provide:
    // - Faster execution (10ms vs 200-300ms per test)
    // - No Firebase emulator dependency
    // - Identical coverage using StubFirestoreDatabase.onSnapshot()
});
