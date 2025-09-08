import { beforeEach, describe, expect, it } from 'vitest';
import {ApiDriver, borrowTestUsers, ExpenseBuilder, SettlementBuilder, TestGroupManager} from '@splitifyd/test-support';
import {UserToken} from "@splitifyd/shared";

describe('Groups Full Details API', () => {
    const apiDriver = new ApiDriver();

    let groupId: string;

    let alice: UserToken;
    let bob: UserToken;
    let charlie: UserToken;
    let outsider: UserToken;

    beforeEach(async () => {
        ([alice, bob, charlie, outsider] = await borrowTestUsers(4));

        // Use shared group for performance
        const group = await TestGroupManager.getOrCreateGroup([alice, bob, charlie], { memberCount: 3 });
        groupId = group.id;
    });

    describe('GET /groups/:id/full-details', () => {
        it('should return consolidated group data with all components', async () => {
            // Add some test data to make the response more interesting
            const uniqueId = Math.random().toString(36).slice(2, 10);
            const expense = await apiDriver.createExpense(new ExpenseBuilder().withGroupId(groupId).withDescription(`Full details test ${uniqueId}`).withPaidBy(alice.uid).withParticipants([alice.uid, bob.uid, charlie.uid]).withSplitType('equal').build(), alice.token);

            await apiDriver.createSettlement(new SettlementBuilder().withGroupId(groupId).withPayer(bob.uid).withPayee(alice.uid).withAmount(20).withNote(`Settlement test ${uniqueId}`).build(), bob.token);

            // Test the consolidated endpoint
            const fullDetails = await apiDriver.getGroupFullDetails(groupId, alice.token);

            // Verify the response structure
            expect(fullDetails).toHaveProperty('group');
            expect(fullDetails).toHaveProperty('members');
            expect(fullDetails).toHaveProperty('expenses');
            expect(fullDetails).toHaveProperty('balances');
            expect(fullDetails).toHaveProperty('settlements');

            // Verify group data
            expect(fullDetails.group.id).toBe(groupId);
            expect(fullDetails.group.name).toBeDefined();
            expect(typeof fullDetails.group.name).toBe('string');
            expect(fullDetails.group.createdBy).toBeDefined();

            // Verify members data
            expect(fullDetails.members.members).toHaveLength(3);
            const memberUids = fullDetails.members.members.map((m: any) => m.uid);
            expect(memberUids).toContain(alice.uid);
            expect(memberUids).toContain(bob.uid);
            expect(memberUids).toContain(charlie.uid);

            // Verify expenses data - check that our expense is included
            expect(fullDetails.expenses.expenses.length).toBeGreaterThanOrEqual(1);
            const ourExpense = fullDetails.expenses.expenses.find((e: any) => e.id === expense.id);
            expect(ourExpense).toBeDefined();

            // Verify balances data (calculated from expenses and settlements)
            expect(fullDetails.balances).toHaveProperty('userBalances');
            expect(fullDetails.balances).toHaveProperty('balancesByCurrency');
            expect(fullDetails.balances.groupId).toBe(groupId);

            // Verify settlements data - check that our settlement is included
            expect(fullDetails.settlements.settlements.length).toBeGreaterThanOrEqual(1);
            const ourSettlement = fullDetails.settlements.settlements.find((s: any) => 
                s.payer.uid === bob.uid && s.payee.uid === alice.uid && s.amount === 20
            );
            expect(ourSettlement).toBeDefined();
        });

        it('should return collections with structure (not testing emptiness due to shared groups)', async () => {
            const fullDetails = await apiDriver.getGroupFullDetails(groupId, alice.token);

            // Should still have the basic structure
            expect(fullDetails.group.id).toBe(groupId);
            expect(fullDetails.members.members).toHaveLength(3); // Alice, Bob, Charlie

            // Verify structure exists (not checking emptiness since groups are shared)
            expect(fullDetails.expenses).toHaveProperty('expenses');
            expect(fullDetails.expenses).toHaveProperty('hasMore');
            expect(fullDetails.settlements).toHaveProperty('settlements');
            expect(fullDetails.settlements).toHaveProperty('hasMore');

            // Balances should exist
            expect(fullDetails.balances).toHaveProperty('userBalances');
        });

        it('should respect user access permissions', async () => {
            // Use the 4th user from the pool as an outsider

            // Should throw an error when unauthorized user tries to access
            await expect(apiDriver.getGroupFullDetails(groupId, outsider.token)).rejects.toThrow(/Group.*not found|not found|Group/i);
        });

        it('should handle pagination information correctly', async () => {
            // Get current count to implement delta counting
            const beforeDetails = await apiDriver.getGroupFullDetails(groupId, alice.token);
            const expenseCountBefore = beforeDetails.expenses.expenses.length;

            // Create many expenses to test pagination
            const uniqueId = Math.random().toString(36).slice(2, 10);
            const expensePromises = Array.from({ length: 25 }, (_, i) =>
                apiDriver.createExpense(
                    new ExpenseBuilder()
                        .withGroupId(groupId)
                        .withDescription(`Pagination test ${uniqueId}-${i}`)
                        .withPaidBy(alice.uid)
                        .withParticipants([alice.uid, bob.uid])
                        .withDate(new Date(Date.now() - i * 1000).toISOString()) // Different times for pagination
                        .withSplitType('equal')
                        .build(),
                    alice.token,
                ),
            );
            await Promise.all(expensePromises);

            const fullDetails = await apiDriver.getGroupFullDetails(groupId, alice.token);

            // Should return pagination limit (20) or more expenses
            expect(fullDetails.expenses.expenses.length).toBeGreaterThanOrEqual(20);
            // Delta check: we added 25, so difference should be significant
            expect(fullDetails.expenses.expenses.length - expenseCountBefore).toBeGreaterThanOrEqual(15);
            expect(fullDetails.expenses.hasMore).toBe(true);
            expect(fullDetails.expenses.nextCursor).toBeDefined();
        });

        it('should support pagination parameters for expenses and settlements', async () => {
            // Create multiple expenses and settlements
            const uniqueId = Math.random().toString(36).slice(2, 10);
            const expensePromises = Array.from({ length: 15 }, (_, i) =>
                apiDriver.createExpense(
                    new ExpenseBuilder()
                        .withGroupId(groupId)
                        .withDescription(`Pagination params test expense ${uniqueId}-${i}`)
                        .withPaidBy(alice.uid)
                        .withParticipants([alice.uid, bob.uid])
                        .withDate(new Date(Date.now() - i * 1000).toISOString())
                        .withSplitType('equal')
                        .build(),
                    alice.token,
                ),
            );
            await Promise.all(expensePromises);

            const settlementPromises = Array.from({ length: 15 }, (_, i) =>
                apiDriver.createSettlement(
                    new SettlementBuilder()
                        .withGroupId(groupId)
                        .withPayer(bob.uid)
                        .withPayee(alice.uid)
                        .withAmount(5)
                        .withNote(`Pagination params test settlement ${uniqueId}-${i}`)
                        .withDate(new Date(Date.now() - i * 2000).toISOString())
                        .build(),
                    bob.token,
                ),
            );
            await Promise.all(settlementPromises);

            // Test with custom pagination limits
            const fullDetails = await apiDriver.getGroupFullDetails(groupId, alice.token, {
                expenseLimit: 5,
                settlementLimit: 3,
            });

            // Should respect the custom limits
            expect(fullDetails.expenses.expenses).toHaveLength(5);
            expect(fullDetails.expenses.hasMore).toBe(true);
            expect(fullDetails.expenses.nextCursor).toBeDefined();

            expect(fullDetails.settlements.settlements).toHaveLength(3);
            expect(fullDetails.settlements.hasMore).toBe(true);
            expect(fullDetails.settlements.nextCursor).toBeDefined();

            // Test pagination with cursor
            const nextPage = await apiDriver.getGroupFullDetails(groupId, alice.token, {
                expenseLimit: 5,
                expenseCursor: fullDetails.expenses.nextCursor!,
            });

            // Should return next 5 expenses
            expect(nextPage.expenses.expenses).toHaveLength(5);
            expect(nextPage.expenses.expenses[0].id).not.toBe(fullDetails.expenses.expenses[0].id);
        });

        it('should return consistent data across individual and consolidated endpoints', async () => {
            // Add test data
            const uniqueId = Math.random().toString(36).slice(2, 10);
            await apiDriver.createExpense(new ExpenseBuilder().withGroupId(groupId).withDescription(`Consistency test ${uniqueId}`).withPaidBy(alice.uid).withParticipants([alice.uid, bob.uid]).withSplitType('equal').build(), alice.token);

            // Get data from both consolidated and individual endpoints
            const [fullDetails, expenses, balances] = await Promise.all([
                apiDriver.getGroupFullDetails(groupId, alice.token),
                apiDriver.getGroupExpenses(groupId, alice.token),
                apiDriver.getGroupBalances(groupId, alice.token),
            ]);

            // Verify consistency
            expect(fullDetails.expenses.expenses).toEqual(expenses.expenses);
            expect(fullDetails.balances.groupId).toBe(balances.groupId);
            
            // Verify members data is properly populated in consolidated endpoint
            expect(fullDetails.members.members).toHaveLength(3);
            expect(fullDetails.members.members.map(m => m.uid)).toEqual(
                expect.arrayContaining([alice.uid, bob.uid])
            );
        });

        it('should handle invalid group ID', async () => {
            await expect(apiDriver.getGroupFullDetails('invalid-group-id', alice.token)).rejects.toThrow(/Group.*not found|not found|Group/i);
        });

        it('should require authentication', async () => {
            await expect(apiDriver.getGroupFullDetails(groupId, '')).rejects.toThrow(/unauthorized|token|auth/i);
        });
    });
});
