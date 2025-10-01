/**
 * Unit Tests for Expense Change Tracking Logic
 *
 * These tests verify the core logic for extracting affected users from expense changes:
 * 1. Extracts all affected users (paidBy + participants)
 * 2. Handles shared expenses between multiple users
 * 3. Removes duplicate users correctly
 * 4. Handles edge cases (missing data, empty arrays)
 */

import { describe, test, expect } from 'vitest';
import { ExpenseBuilder } from '@splitifyd/test-support';

/**
 * Extract affected users from expense data (before and after states)
 * This is the core logic from trackExpenseChanges trigger
 */
function extractAffectedUsersFromExpense(beforeData: any, afterData: any): string[] {
    const affectedUsers = new Set<string>();

    if (afterData) {
        affectedUsers.add(afterData.paidBy);
        afterData.participants.forEach((userId: string) => affectedUsers.add(userId));
    }
    if (beforeData) {
        affectedUsers.add(beforeData.paidBy);
        beforeData.participants.forEach((userId: string) => affectedUsers.add(userId));
    }

    return Array.from(affectedUsers);
}

describe('Expense Change Tracking Logic', () => {
    describe('Shared Expense Notifications', () => {
        test('should extract all participants when shared expense is created', () => {
            // Arrange: Create a shared expense between 3 users
            const expenseData = new ExpenseBuilder()
                .withGroupId('test-group-123')
                .withPaidBy('user1')
                .withParticipants(['user1', 'user2', 'user3']) // 3 participants
                .withAmount(30.0)
                .withDescription('Shared dinner')
                .build();

            // Act: Extract affected users (expense creation = no beforeData)
            const affectedUsers = extractAffectedUsersFromExpense(null, expenseData);

            // Assert: All 3 users should be identified as affected
            expect(affectedUsers).toHaveLength(3);
            expect(affectedUsers).toEqual(expect.arrayContaining(['user1', 'user2', 'user3']));
        });

        test('should extract both payer and participant when different users', () => {
            // Arrange: User1 pays, User2 participates
            const expenseData = new ExpenseBuilder()
                .withGroupId('test-group-456')
                .withPaidBy('user1')
                .withParticipants(['user2']) // Only user2 participates, but user1 paid
                .withAmount(20.0)
                .withDescription('Coffee for friend')
                .build();

            // Act
            const affectedUsers = extractAffectedUsersFromExpense(null, expenseData);

            // Assert: Both users should be identified (paidBy + participants)
            expect(affectedUsers).toHaveLength(2);
            expect(affectedUsers).toEqual(expect.arrayContaining(['user1', 'user2']));
        });

        test('should handle duplicate users correctly (payer is also participant)', () => {
            // Arrange: User1 pays and is also a participant (common case)
            const expenseData = new ExpenseBuilder()
                .withGroupId('test-group-789')
                .withPaidBy('user1')
                .withParticipants(['user1', 'user2']) // user1 appears in both paidBy and participants
                .withAmount(25.0)
                .withDescription('Shared lunch')
                .build();

            // Act
            const affectedUsers = extractAffectedUsersFromExpense(null, expenseData);

            // Assert: Each user should only appear once in the list
            expect(affectedUsers).toHaveLength(2); // Should deduplicate user1
            expect(affectedUsers).toEqual(expect.arrayContaining(['user1', 'user2']));
        });
    });

    describe('Bug Reproduction: Multi-user Notification Failure', () => {
        test('BUG: should extract User2 when User1 creates shared expense', () => {
            // Arrange: Reproduce the exact scenario from failing integration test
            // User1 creates a shared expense where both User1 and User2 participate
            const sharedExpenseData = new ExpenseBuilder()
                .withGroupId('multi-user-test-group')
                .withPaidBy('user1') // User1 pays
                .withParticipants(['user1', 'user2']) // Both users participate
                .withAmount(50.0)
                .withDescription('Shared expense between User1 and User2')
                .build();

            // Act: Extract affected users from shared expense
            const affectedUsers = extractAffectedUsersFromExpense(null, sharedExpenseData);

            // Assert: CRITICAL - Both users must be identified as affected
            expect(affectedUsers).toHaveLength(2);
            expect(affectedUsers).toEqual(expect.arrayContaining(['user1', 'user2']));

            // Log for debugging: Show exactly what users are extracted
            console.log('🐛 BUG TEST - Affected users extracted:', affectedUsers);

            // If this test passes but the integration test fails, the bug is in:
            // 1. NotificationService.batchUpdateNotifications implementation
            // 2. Individual user notification document updates
            // 3. FirestoreWriter.updateUserNotification method
            // 4. The expense trigger is not receiving the correct expense data
        });

        test('should handle edge case: empty participants array', () => {
            // Arrange: Expense with no participants (only payer)
            const expenseData = new ExpenseBuilder()
                .withGroupId('test-group-solo')
                .withPaidBy('user1')
                .withParticipants([]) // Empty participants
                .withAmount(15.0)
                .withDescription('Solo expense')
                .build();

            // Act
            const affectedUsers = extractAffectedUsersFromExpense(null, expenseData);

            // Assert: Only the payer should be identified
            expect(affectedUsers).toHaveLength(1);
            expect(affectedUsers).toEqual(['user1']);
        });

        test('should handle edge case: missing participants array', () => {
            // Arrange: Expense with undefined participants (malformed data)
            const expenseData = {
                groupId: 'test-group-broken',
                paidBy: 'user1',
                // Missing participants array entirely
                amount: 15.0,
                description: 'Broken expense',
            };

            // Act & Assert: Should throw error when trying to iterate undefined participants
            expect(() => {
                extractAffectedUsersFromExpense(null, expenseData);
            }).toThrow();
        });
    });
});
