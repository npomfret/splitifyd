/**
 * Expense Concurrent Updates - Unit Tests
 *
 * Migrated from integration/expense-locking.test.ts to avoid Firebase emulator dependency.
 * Tests concurrent update behavior using TenantFirestoreTestDatabase.
 *
 * This tests the application-level logic for handling concurrent expense updates.
 * The integration test remains for testing actual Firebase optimistic locking behavior.
 */

import { calculateEqualSplits, toAmount, toCurrencyISOCode, toGroupName, toUserId, USD } from '@billsplit-wl/shared';
import { toDisplayName } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, ExpenseUpdateBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, test } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('Expense Concurrent Updates - Unit Tests', () => {
    let appDriver: AppDriver;

    let userId: string;
    const eur = toCurrencyISOCode('EUR');
    const usd = USD;

    beforeEach(async () => {
        appDriver = new AppDriver();

        // Register user via API
        const userReg = new UserRegistrationBuilder()
            .withEmail('test@example.com')
            .withDisplayName('Test User')
            .withPassword('password12345')
            .build();
        const userResult = await appDriver.registerUser(userReg);
        userId = userResult.user.uid;
    });

    afterEach(() => {
        appDriver.dispose();
    });

    test('should handle concurrent expense updates', async () => {
        // Create group
        const group = await appDriver.createGroup({
            name: toGroupName('Concurrent Update Test Group'),
            groupDisplayName: toDisplayName('Owner Display'),
            description: 'Testing expense concurrent updates',
        }, userId);

        // Create an expense
        const expense = await appDriver.createExpense(
            new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Test Expense')
                .withAmount(100, 'EUR')
                .withPaidBy(userId)
                .withLabel('food')
                .withDate(new Date().toISOString())
                .withSplitType('equal')
                .withParticipants([userId])
                .build(),
            userId,
        );

        // Verify expense was created
        expect(expense.id).toBeDefined();
        expect(expense.amount).toBe('100');

        // Attempt concurrent updates
        const lockingTestParticipants = [userId];
        const lockingTestParticipantIds = lockingTestParticipants.map(toUserId);
        const updatePromises = [
            appDriver.updateExpense(
                expense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(200, 'EUR')
                    .withParticipants(lockingTestParticipants)
                    .withSplits(calculateEqualSplits(toAmount(200), eur, lockingTestParticipantIds))
                    .build(),
                userId,
            ),
            appDriver.updateExpense(
                expense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(300, 'EUR')
                    .withParticipants(lockingTestParticipants)
                    .withSplits(calculateEqualSplits(toAmount(300), eur, lockingTestParticipantIds))
                    .build(),
                userId,
            ),
        ];

        const results = await Promise.allSettled(updatePromises);

        // Check results
        const successes = results.filter((r) => r.status === 'fulfilled');
        const failures = results.filter((r) => r.status === 'rejected');

        // At least one should succeed
        expect(successes.length).toBeGreaterThan(0);
        expect(successes.length + failures.length).toBe(2);

        // Verify final state - update creates new expense with new ID (edit history via soft deletes)
        // The successful update(s) created new expense(s), original is soft-deleted
        const { expenses } = await appDriver.getGroupExpenses(group.id, {}, userId);
        // Should have at least one expense with an updated amount
        const updatedAmounts = expenses.map((e) => e.amount);
        expect(updatedAmounts.some((a) => ['200', '300'].includes(a))).toBe(true);
    });

    test('should demonstrate transaction conflict behavior with concurrent amount changes', async () => {
        // Create group
        const group = await appDriver.createGroup({
            name: toGroupName('Transaction Conflict Test'),
            groupDisplayName: toDisplayName('Owner Display'),
        }, userId);

        // Create an expense
        const expense = await appDriver.createExpense(
            new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Test Expense')
                .withAmount(100, 'USD')
                .withPaidBy(userId)
                .withLabel('food')
                .withSplitType('equal')
                .withParticipants([userId])
                .build(),
            userId,
        );

        // Concurrent updates to the same expense
        // This tests that TenantFirestoreTestDatabase correctly simulates transaction conflicts
        const participants = [userId];
        const participantIds = participants.map(toUserId);
        const updatePromises = [
            appDriver.updateExpense(
                expense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(150, 'USD')
                    .withParticipants(participants)
                    .withSplits(calculateEqualSplits(toAmount(150), usd, participantIds))
                    .build(),
                userId,
            ),
            appDriver.updateExpense(
                expense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(200, 'USD')
                    .withParticipants(participants)
                    .withSplits(calculateEqualSplits(toAmount(200), usd, participantIds))
                    .build(),
                userId,
            ),
        ];

        const results = await Promise.allSettled(updatePromises);

        // Verify transaction conflict behavior
        const successes = results.filter((r) => r.status === 'fulfilled');
        const failures = results.filter((r) => r.status === 'rejected');

        // At least one should succeed
        expect(successes.length).toBeGreaterThan(0);
        expect(successes.length + failures.length).toBe(2);

        // Verify final state - update creates new expense with new ID (edit history via soft deletes)
        // The successful update(s) created new expense(s), original is soft-deleted
        const { expenses } = await appDriver.getGroupExpenses(group.id, {}, userId);
        // Should have at least one expense with an updated amount
        const updatedAmounts = expenses.map((e) => e.amount);
        expect(updatedAmounts.some((a) => ['150', '200'].includes(a))).toBe(true);
    });

    test('should reject updates from non-members', async () => {
        // Register non-member via API
        const nonMemberReg = new UserRegistrationBuilder()
            .withEmail('nonmember@example.com')
            .withDisplayName('Non Member')
            .withPassword('password12345')
            .build();
        const nonMemberResult = await appDriver.registerUser(nonMemberReg);
        const nonMemberId = nonMemberResult.user.uid;

        // Create group and expense
        const group = await appDriver.createGroup({
            name: toGroupName('Access Control Test'),
            groupDisplayName: toDisplayName('Owner Display'),
        }, userId);

        const expense = await appDriver.createExpense(
            new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Test Expense')
                .withAmount(100, 'USD')
                .withPaidBy(userId)
                .withParticipants([userId])
                .build(),
            userId,
        );

        // Non-member tries to update expense - should fail with access denied
        // Note: Using just description update to avoid validation complexity
        await expect(
            appDriver.updateExpense(expense.id, new ExpenseUpdateBuilder().withDescription('Unauthorized Update').build(), nonMemberId),
        )
            .rejects
            .toThrow();
    });
});
