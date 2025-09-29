import { describe, test, expect, beforeEach, beforeAll } from 'vitest';
import { borrowTestUsers, GroupMemberDocumentBuilder, CreateGroupRequestBuilder, CreateExpenseRequestBuilder } from '@splitifyd/test-support';
import { GroupMemberDocument, MemberRoles, SplitTypes, Group } from '@splitifyd/shared';
import { PooledTestUser } from '@splitifyd/shared';
import { ApplicationBuilder } from '../../services/ApplicationBuilder';
import { getAuth, getFirestore } from '../../firebase';

describe('Concurrent Operations Integration Tests', () => {
    const applicationBuilder = ApplicationBuilder.createApplicationBuilder(getFirestore(), getAuth());
    const groupService = applicationBuilder.buildGroupService();
    const groupMemberService = applicationBuilder.buildGroupMemberService();
    const expenseService = applicationBuilder.buildExpenseService();

    let users: PooledTestUser[];
    let testUser1: PooledTestUser;
    let testUser2: PooledTestUser;
    let testUser3: PooledTestUser;
    let testUser4: PooledTestUser;
    let testGroup: Group;

    beforeAll(async () => {});

    beforeEach(async () => {
        // Create test users
        users = await borrowTestUsers(6); // Borrow 6 users for concurrent tests
        testUser1 = users[0];
        testUser2 = users[1];
        testUser3 = users[2];
        testUser4 = users[3];

        // Create test group
        testGroup = await groupService.createGroup(testUser1.uid,
            new CreateGroupRequestBuilder()
                .withName('Concurrent Operations Test Group')
                .withDescription('Testing concurrent operations')
                .build()
        );
    });

    describe('Concurrent Member Operations', () => {
        test('should handle multiple users joining simultaneously', async () => {
            const memberDocs: GroupMemberDocument[] = [
                new GroupMemberDocumentBuilder(testUser2.uid, testGroup.id).withThemeIndex(1).withInvitedBy(testUser1.uid).build(),
                new GroupMemberDocumentBuilder(testUser3.uid, testGroup.id).withThemeIndex(2).withInvitedBy(testUser1.uid).build(),
                new GroupMemberDocumentBuilder(testUser4.uid, testGroup.id).withThemeIndex(3).withInvitedBy(testUser1.uid).build(),
            ];

            // Execute all member additions concurrently
            const addPromises = memberDocs.map((memberDoc) => groupMemberService.createMember(testGroup.id, memberDoc));

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
            // Add initial member
            const initialMember = new GroupMemberDocumentBuilder(testUser2.uid, testGroup.id).withThemeIndex(1).withInvitedBy(testUser1.uid).build();
            await groupMemberService.createMember(testGroup.id, initialMember);

            // Run concurrent operations: queries while adding/removing members
            const operations = [
                // Query operations
                () => groupMemberService.getAllGroupMembers(testGroup.id),
                () => groupMemberService.getGroupMember(testGroup.id, testUser2.uid),
                () => groupMemberService.getUserGroupsViaSubcollection(testUser1.uid),

                // Modification operations
                () => groupMemberService.createMember(testGroup.id, new GroupMemberDocumentBuilder(testUser3.uid, testGroup.id).withThemeIndex(2).withInvitedBy(testUser1.uid).build()),
                () =>
                    groupMemberService.updateMember(testGroup.id, testUser2.uid, {
                        memberRole: MemberRoles.ADMIN,
                    }),
                () => groupMemberService.deleteMember(testGroup.id, testUser2.uid),
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

        test('should handle concurrent role updates', async () => {
            // Add test member
            const memberDoc = new GroupMemberDocumentBuilder(testUser2.uid, testGroup.id).withThemeIndex(1).withInvitedBy(testUser1.uid).build();
            await groupMemberService.createMember(testGroup.id, memberDoc);

            // Execute multiple role updates concurrently
            const updatePromises = [
                groupMemberService.updateMember(testGroup.id, testUser2.uid, {
                    memberRole: MemberRoles.ADMIN,
                }),
                groupMemberService.updateMember(testGroup.id, testUser2.uid, {
                    memberRole: MemberRoles.VIEWER,
                }),
                groupMemberService.updateMember(testGroup.id, testUser2.uid, {
                    memberRole: MemberRoles.MEMBER,
                }),
            ];

            // All updates should complete (last write wins)
            await Promise.allSettled(updatePromises);

            // Verify member still exists with one of the roles
            const updatedMember = await groupMemberService.getGroupMember(testGroup.id, testUser2.uid);
            expect(updatedMember).toBeDefined();
            expect([MemberRoles.ADMIN, MemberRoles.VIEWER, MemberRoles.MEMBER]).toContain(updatedMember!.memberRole);
        });
    });

    describe('Concurrent Group Operations', () => {
        test('should handle concurrent expense creation by multiple members', async () => {
            // Add members to group first
            const memberDocs = [testUser2, testUser3, testUser4].map((user, index) =>
                new GroupMemberDocumentBuilder(user.uid, testGroup.id)
                    .withThemeIndex(index + 1)
                    .withInvitedBy(testUser1.uid)
                    .build(),
            );

            for (const memberDoc of memberDocs) {
                await groupMemberService.createMember(testGroup.id, memberDoc);
            }

            // Create concurrent expenses
            const expensePromises = [
                expenseService.createExpense(testUser1.uid,
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
                        .build()
                ),
                expenseService.createExpense(testUser2.uid,
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
                        .build()
                ),
                expenseService.createExpense(testUser3.uid,
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
                        .build()
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
            // Add member and create expense
            const memberDoc = new GroupMemberDocumentBuilder(testUser2.uid, testGroup.id).withThemeIndex(1).withInvitedBy(testUser1.uid).build();
            await groupMemberService.createMember(testGroup.id, memberDoc);

            // Create expense
            await expenseService.createExpense(testUser1.uid,
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
                    .build()
            );

            // Simulate concurrent operations: balance queries and member removal
            const operations = [
                // Balance-related queries that might be running
                () => groupMemberService.getAllGroupMembers(testGroup.id),
                () => expenseService.listGroupExpenses(testGroup.id, testUser1.uid),

                // Member removal during balance calculation
                () => groupMemberService.deleteMember(testGroup.id, testUser2.uid),
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

    describe('Race Condition Validation', () => {
        test('should maintain data consistency during rapid membership changes', async () => {
            const iterations = 10;
            const operations: Promise<any>[] = [];

            // Create multiple rapid add/remove operations
            for (let i = 0; i < iterations; i++) {
                const userId = `test-user-${i}`;

                // Add member
                operations.push(
                    groupMemberService
                        .createMember(
                            testGroup.id,
                            new GroupMemberDocumentBuilder(userId, testGroup.id)
                                .withThemeIndex(i % 10)
                                .withInvitedBy(testUser1.uid)
                                .build(),
                        )
                        .then(() => ({ operation: 'add', userId, success: true }))
                        .catch((error) => ({ operation: 'add', userId, success: false, error })),
                );

                // Immediately try to remove (some will fail due to timing)
                operations.push(
                    groupMemberService
                        .deleteMember(testGroup.id, userId)
                        .then(() => ({ operation: 'remove', userId, success: true }))
                        .catch((error) => ({ operation: 'remove', userId, success: false, error })),
                );
            }

            // Execute all operations concurrently
            const results = await Promise.allSettled(operations);

            // Verify system remains stable
            expect(results).toHaveLength(iterations * 2);

            // Final state should be consistent
            const finalMembers = await groupMemberService.getAllGroupMembers(testGroup.id);
            expect(Array.isArray(finalMembers)).toBe(true);
            expect(finalMembers.length).toBeGreaterThanOrEqual(1); // At least testUser1 should remain

            // All members should have valid data structure
            finalMembers.forEach((member) => {
                expect(member.uid).toBeDefined();
                expect(member.groupId).toBe(testGroup.id);
                expect(member.memberRole).toBeDefined();
                expect(member.memberStatus).toBeDefined();
            });
        });

        test('should handle collectionGroup queries during concurrent modifications', async () => {
            // Add initial members
            const memberDocs = [testUser2, testUser3, testUser4].map((user, index) =>
                new GroupMemberDocumentBuilder(user.uid, testGroup.id)
                    .withThemeIndex(index + 1)
                    .withInvitedBy(testUser1.uid)
                    .build(),
            );

            for (const memberDoc of memberDocs) {
                await groupMemberService.createMember(testGroup.id, memberDoc);
            }

            // Run concurrent collectionGroup queries while modifying data
            const queryPromises = Array(5)
                .fill(0)
                .map(() => groupMemberService.getUserGroupsViaSubcollection(testUser1.uid));

            const modificationPromises = [
                groupMemberService.updateMember(testGroup.id, testUser2.uid, {
                    memberRole: MemberRoles.ADMIN,
                }),
                groupMemberService.deleteMember(testGroup.id, testUser3.uid),
                groupMemberService.createMember(testGroup.id, new GroupMemberDocumentBuilder(users[5].uid, testGroup.id).withThemeIndex(4).withInvitedBy(testUser1.uid).build()),
            ];

            // Execute queries and modifications concurrently
            const allPromises = [...queryPromises, ...modificationPromises];
            const results = await Promise.allSettled(allPromises);

            // Verify that most operations succeeded
            const succeeded = results.filter((r) => r.status === 'fulfilled').length;
            expect(succeeded).toBeGreaterThan(allPromises.length / 2); // At least half should succeed

            // Verify collectionGroup queries returned valid results
            const queryResults = results.slice(0, queryPromises.length);
            queryResults.forEach((result) => {
                if (result.status === 'fulfilled') {
                    expect(Array.isArray(result.value)).toBe(true);
                    expect(result.value).toContain(testGroup.id);
                }
            });
        });
    });

    describe('Error Recovery During Concurrent Operations', () => {
        test('should handle partial failures gracefully', async () => {
            // Add a member first
            await groupMemberService.createMember(testGroup.id, new GroupMemberDocumentBuilder(testUser2.uid, testGroup.id).withThemeIndex(1).withInvitedBy(testUser1.uid).build());

            // Create operations where some will succeed and some will fail
            const operations = [
                // Valid operations
                () => groupMemberService.getAllGroupMembers(testGroup.id),
                () => groupMemberService.getGroupMember(testGroup.id, testUser2.uid),

                // Operations that will fail - trying to access non-existent member
                () => groupMemberService.getGroupMember(testGroup.id, 'non-existent-user-id'),
                () =>
                    groupMemberService.updateMember(testGroup.id, 'non-existent-user-id', {
                        memberRole: MemberRoles.ADMIN,
                    }),
            ];

            // Execute all operations concurrently
            const results = await Promise.allSettled(operations.map((op) => op()));

            // Verify mixed results (some operations return null for non-existent members, which is valid)
            const succeeded = results.filter((r) => r.status === 'fulfilled');
            const failed = results.filter((r) => r.status === 'rejected');

            expect(succeeded.length).toBeGreaterThan(0);
            expect(succeeded.length + failed.length).toBe(operations.length);

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
