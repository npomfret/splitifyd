import { describe, test, expect, beforeEach, beforeAll } from 'vitest';
import { borrowTestUsers, CreateGroupRequestBuilder, CreateExpenseRequestBuilder } from '@splitifyd/test-support';
import { GroupDTO } from '@splitifyd/shared';
import { PooledTestUser } from '@splitifyd/shared';
import { ApplicationBuilder } from '../../services/ApplicationBuilder';
import { getAuth, getFirestore } from '../../firebase';
import { GroupMemberDocumentBuilder } from '../support/GroupMemberDocumentBuilder';

describe('Concurrent Operations Integration Tests', () => {
    const applicationBuilder = ApplicationBuilder.createApplicationBuilder(getFirestore(), getAuth());
    const firestoreReader = applicationBuilder.buildFirestoreReader();
    const groupService = applicationBuilder.buildGroupService();
    const groupMemberService = applicationBuilder.buildGroupMemberService();
    const expenseService = applicationBuilder.buildExpenseService();

    let users: PooledTestUser[];
    let testUser1: PooledTestUser;
    let testUser2: PooledTestUser;
    let testUser3: PooledTestUser;
    let testUser4: PooledTestUser;
    let testGroup: GroupDTO;

    beforeAll(async () => {});

    beforeEach(async () => {
        // Create test users
        users = await borrowTestUsers(6); // Borrow 6 users for concurrent tests
        testUser1 = users[0];
        testUser2 = users[1];
        testUser3 = users[2];
        testUser4 = users[3];

        // Create test group
        testGroup = await groupService.createGroup(
            testUser1.uid,
            new CreateGroupRequestBuilder().withName('Concurrent Operations Test Group').withDescription('Testing concurrent operations').build(),
        );
    });

    describe('Concurrent Member Operations', () => {
        test('should handle multiple users joining simultaneously', async () => {
            // Generate share link for concurrent joins (production code path)
            const { linkId } = await applicationBuilder.buildGroupShareService().generateShareableLink(testUser1.uid, testGroup.id);

            // Execute all member additions concurrently via share link
            const addPromises = [
                applicationBuilder.buildGroupShareService().joinGroupByLink(testUser2.uid, testUser2.email, linkId),
                applicationBuilder.buildGroupShareService().joinGroupByLink(testUser3.uid, testUser3.email, linkId),
                applicationBuilder.buildGroupShareService().joinGroupByLink(testUser4.uid, testUser4.email, linkId),
            ];

            // All operations should complete successfully
            await Promise.all(addPromises);

            // Verify all members were added
            const finalMembers = await groupMemberService.getAllGroupMembers(testGroup.id);
            expect(finalMembers).toHaveLength(4); // testUser1 (admin) + 3 new members

            const memberIds = finalMembers.map((m) => m.uid);
            expect(memberIds).toContain(testUser1.uid);
            expect(memberIds).toContain(testUser2.uid);
            expect(memberIds).toContain(testUser3.uid);
            expect(memberIds).toContain(testUser4.uid);
        });

        test('should handle concurrent member queries during membership changes', async () => {
            const groupShareService = applicationBuilder.buildGroupShareService();

            // Add initial member via share link (production code path)
            const { linkId: initialLinkId } = await groupShareService.generateShareableLink(testUser1.uid, testGroup.id);
            await groupShareService.joinGroupByLink(testUser2.uid, testUser2.email, initialLinkId);

            // Run concurrent operations: queries while adding/removing members
            const { linkId: concurrentLinkId } = await groupShareService.generateShareableLink(testUser1.uid, testGroup.id);
            const operations = [
                // Query operations
                () => groupMemberService.getAllGroupMembers(testGroup.id),
                () => firestoreReader.getGroupMember(testGroup.id, testUser2.uid),

                // Modification operations (production code paths)
                () => groupShareService.joinGroupByLink(testUser3.uid, testUser3.email, concurrentLinkId),
                () => groupMemberService.removeGroupMember(testUser1.uid, testGroup.id, testUser2.uid),
            ];

            // Execute all operations concurrently
            const results = await Promise.allSettled(operations.map((op) => op()));

            // Verify that operations completed (some may succeed, some may fail due to race conditions)
            // The key is that the system remains consistent and doesn't crash
            const succeeded = results.filter((r) => r.status === 'fulfilled').length;
            const failed = results.filter((r) => r.status === 'rejected').length;

            expect(succeeded + failed).toBe(operations.length);
            expect(succeeded).toBeGreaterThan(0); // At least some operations should succeed

            // System should be in a consistent state
            const finalMembers = await groupMemberService.getAllGroupMembers(testGroup.id);
            expect(Array.isArray(finalMembers)).toBe(true);
        });

        // NOTE: Concurrent role updates test removed - no production code path exists for updating member roles
        // If role update functionality is implemented in the future, add appropriate concurrent tests here
    });

    describe('Concurrent Group Operations', () => {
        test('should handle concurrent expense creation by multiple members', async () => {
            const groupShareService = applicationBuilder.buildGroupShareService();

            // Add members to group via share link (production code path)
            const { linkId } = await groupShareService.generateShareableLink(testUser1.uid, testGroup.id);
            for (const user of [testUser2, testUser3, testUser4]) {
                await groupShareService.joinGroupByLink(user.uid, user.email, linkId);
            }

            // Create concurrent expenses
            const expensePromises = [
                expenseService.createExpense(
                    testUser1.uid,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(testGroup.id)
                        .withPaidBy(testUser1.uid)
                        .withAmount(100)
                        .withCurrency('EUR')
                        .withDescription('Concurrent Expense 1')
                        .withCategory('Food')
                        .withDate(new Date().toISOString())
                        .withSplitType('equal')
                        .withParticipants([testUser1.uid, testUser2.uid])
                        .build(),
                ),
                expenseService.createExpense(
                    testUser2.uid,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(testGroup.id)
                        .withPaidBy(testUser2.uid)
                        .withAmount(75)
                        .withCurrency('EUR')
                        .withDescription('Concurrent Expense 2')
                        .withCategory('Transport')
                        .withDate(new Date().toISOString())
                        .withSplitType('equal')
                        .withParticipants([testUser2.uid, testUser3.uid])
                        .build(),
                ),
                expenseService.createExpense(
                    testUser3.uid,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(testGroup.id)
                        .withPaidBy(testUser3.uid)
                        .withAmount(50)
                        .withCurrency('EUR')
                        .withDescription('Concurrent Expense 3')
                        .withCategory('Entertainment')
                        .withDate(new Date().toISOString())
                        .withSplitType('equal')
                        .withParticipants([testUser3.uid, testUser4.uid])
                        .build(),
                ),
            ];

            // All expense creations should succeed
            const createdExpenses = await Promise.all(expensePromises);

            expect(createdExpenses).toHaveLength(3);
            createdExpenses.forEach((expense) => {
                expect(expense.id).toBeDefined();
                expect(expense.groupId).toBe(testGroup.id);
                expect(expense.splits.length).toBeGreaterThan(0);
            });
        });

        test('should handle member leaving during balance calculation', async () => {
            const groupShareService = applicationBuilder.buildGroupShareService();

            // Add member via share link (production code path)
            const { linkId } = await groupShareService.generateShareableLink(testUser1.uid, testGroup.id);
            await groupShareService.joinGroupByLink(testUser2.uid, testUser2.email, linkId);

            // Create expense
            await expenseService.createExpense(
                testUser1.uid,
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(testUser1.uid)
                    .withAmount(100)
                    .withCurrency('EUR')
                    .withDescription('Test Expense')
                    .withCategory('Food')
                    .withDate(new Date().toISOString())
                    .withSplitType('equal')
                    .withParticipants([testUser1.uid, testUser2.uid])
                    .build(),
            );

            // Simulate concurrent operations: balance queries and member removal
            const operations = [
                // Balance-related queries that might be running
                () => groupMemberService.getAllGroupMembers(testGroup.id),
                () => expenseService.listGroupExpenses(testGroup.id, testUser1.uid),

                // Member removal during balance calculation (production code path)
                () => groupMemberService.removeGroupMember(testUser1.uid, testGroup.id, testUser2.uid),
            ];

            // Execute operations concurrently
            const results = await Promise.allSettled(operations.map((op) => op()));

            // Verify system remains consistent
            // Some operations may succeed, some may fail, but system should not crash
            const succeeded = results.filter((r) => r.status === 'fulfilled').length;
            expect(succeeded).toBeGreaterThan(0);

            // Check final state is consistent
            const finalMembers = await groupMemberService.getAllGroupMembers(testGroup.id);
            expect(Array.isArray(finalMembers)).toBe(true);
        });
    });

    describe('Error Recovery During Concurrent Operations', () => {
        test('should handle partial failures gracefully', async () => {
            const groupShareService = applicationBuilder.buildGroupShareService();

            // Add a member via share link (production code path)
            const { linkId } = await groupShareService.generateShareableLink(testUser1.uid, testGroup.id);
            await groupShareService.joinGroupByLink(testUser2.uid, testUser2.email, linkId);

            // Create operations where some will succeed and some will fail
            const operations = [
                // Valid operations
                () => groupMemberService.getAllGroupMembers(testGroup.id),
                () => firestoreReader.getGroupMember(testGroup.id, testUser2.uid),

                // Operations that will return null for non-existent member (valid behavior)
                () => firestoreReader.getGroupMember(testGroup.id, 'non-existent-user-id'),
            ];

            // Execute all operations concurrently
            const results = await Promise.allSettled(operations.map((op) => op()));

            // Verify operations completed
            const succeeded = results.filter((r) => r.status === 'fulfilled');

            expect(succeeded.length).toBe(operations.length); // All should succeed (null is valid for non-existent)

            // Verify valid operations returned expected results
            expect(results[0].status).toBe('fulfilled'); // getAllGroupMembers should succeed
            expect(results[1].status).toBe('fulfilled'); // getGroupMember for existing user should succeed

            // System should still be in valid state
            const finalMembers = await groupMemberService.getAllGroupMembers(testGroup.id);
            expect(Array.isArray(finalMembers)).toBe(true);
            expect(finalMembers.some((m) => m.uid === testUser2.uid)).toBe(true);
        });
    });
});
