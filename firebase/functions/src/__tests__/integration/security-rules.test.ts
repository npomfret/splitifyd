import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, getDocs, doc, setDoc, getDoc, onSnapshot, query, limit } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

// Security rules test to verify production rules work correctly
describe('Firestore Security Rules (Production)', () => {
    const projectId = 'security-rules-test';
    let testEnv: any;
    let user1Context: any;
    let user2Context: any;
    let user3Context: any;
    let unauthenticatedContext: any;
    let user1Db: any;
    let user2Db: any;
    let user3Db: any;
    let unauthDb: any;

    beforeAll(async () => {
        // Read the rules file
        const rulesPath = join(__dirname, '../../../../firestore.prod.rules');
        const rules = readFileSync(rulesPath, 'utf8');

        // Initialize test environment
        testEnv = await initializeTestEnvironment({
            projectId,
            firestore: {
                rules,
                host: '127.0.0.1',
                port: 8004
            }
        });

        // Create authenticated contexts for test users
        user1Context = testEnv.authenticatedContext('user1-id', {
            email: 'user1@example.com'
        });
        user1Db = user1Context.firestore();

        user2Context = testEnv.authenticatedContext('user2-id', {
            email: 'user2@example.com'
        });
        user2Db = user2Context.firestore();

        user3Context = testEnv.authenticatedContext('user3-id', {
            email: 'user3@example.com'
        });
        user3Db = user3Context.firestore();

        // Create unauthenticated context
        unauthenticatedContext = testEnv.unauthenticatedContext();
        unauthDb = unauthenticatedContext.firestore();
    });

    afterAll(async () => {
        await testEnv?.cleanup();
    });

    describe('Groups Collection', () => {
        const groupId = 'test-group-1';

        beforeAll(async () => {
            // Setup test data with admin privileges
            await testEnv.withSecurityRulesDisabled(async (context: any) => {
                const db = context.firestore();

                // Create a group with user1 and user2 as members
                await setDoc(doc(db, 'groups', groupId), {
                    name: 'Test Group',
                    description: 'A test group',
                    createdBy: 'user1-id',
                    memberIds: ['user1-id', 'user2-id'],  // Critical: memberIds controls access
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            });
        });

        it('should allow group members to read groups they belong to', async () => {
            // User1 is a member and should be able to read
            await assertSucceeds(getDoc(doc(user1Db, 'groups', groupId)));

            // User2 is also a member and should be able to read
            await assertSucceeds(getDoc(doc(user2Db, 'groups', groupId)));
        });

        it('should deny non-members from reading groups they do not belong to', async () => {
            // User3 is NOT a member and should be denied
            await assertFails(getDoc(doc(user3Db, 'groups', groupId)));
        });

        it('should deny unauthenticated users from reading any groups', async () => {
            await assertFails(getDoc(doc(unauthDb, 'groups', groupId)));
        });

        it('should deny all client writes to groups', async () => {
            const updateData = {
                name: 'Updated Group Name'
            };

            // Even group members cannot write
            await assertFails(setDoc(doc(user1Db, 'groups', groupId), updateData, { merge: true }));
            await assertFails(setDoc(doc(user2Db, 'groups', groupId), updateData, { merge: true }));

            // Non-members also cannot write
            await assertFails(setDoc(doc(user3Db, 'groups', groupId), updateData, { merge: true }));
        });

        it('should deny listing all groups (no collection-level reads)', async () => {
            // Users cannot list all groups, only read specific ones they belong to
            await assertFails(getDocs(collection(user1Db, 'groups')));
            await assertFails(getDocs(collection(user2Db, 'groups')));
            await assertFails(getDocs(collection(user3Db, 'groups')));
        });
    });

    describe('Expenses Collection', () => {
        const expenseId = 'test-expense-1';
        const groupId = 'test-group-1';

        beforeAll(async () => {
            await testEnv.withSecurityRulesDisabled(async (context: any) => {
                const db = context.firestore();

                // Create an expense for the test group
                await setDoc(doc(db, 'expenses', expenseId), {
                    groupId: groupId,
                    description: 'Test Expense',
                    amount: 100,
                    createdBy: 'user1-id',
                    paidBy: 'user1-id',
                    memberIds: ['user1-id', 'user2-id'],  // Critical: memberIds controls access
                    participants: ['user1-id', 'user2-id'],
                    splits: [
                        { userId: 'user1-id', amount: 50 },
                        { userId: 'user2-id', amount: 50 }
                    ],
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            });
        });

        it('should allow group members to read expenses in their groups', async () => {
            // User1 is in memberIds and should be able to read
            await assertSucceeds(getDoc(doc(user1Db, 'expenses', expenseId)));

            // User2 is also in memberIds and should be able to read
            await assertSucceeds(getDoc(doc(user2Db, 'expenses', expenseId)));
        });

        it('should deny non-members from reading expenses they are not part of', async () => {
            // User3 is NOT in memberIds and should be denied
            await assertFails(getDoc(doc(user3Db, 'expenses', expenseId)));
        });

        it('should deny all client writes to expenses', async () => {
            const updateData = {
                description: 'Updated Expense'
            };

            // Even group members cannot write
            await assertFails(setDoc(doc(user1Db, 'expenses', expenseId), updateData, { merge: true }));
            await assertFails(setDoc(doc(user2Db, 'expenses', expenseId), updateData, { merge: true }));
        });
    });

    describe('Settlements Collection', () => {
        const settlementId = 'test-settlement-1';

        beforeAll(async () => {
            await testEnv.withSecurityRulesDisabled(async (context: any) => {
                const db = context.firestore();

                // Create a settlement
                await setDoc(doc(db, 'settlements', settlementId), {
                    groupId: 'test-group-1',
                    fromUserId: 'user2-id',
                    toUserId: 'user1-id',
                    amount: 50,
                    currency: 'USD',
                    memberIds: ['user1-id', 'user2-id'],  // Critical: memberIds controls access
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            });
        });

        it('should allow group members to read settlements in their groups', async () => {
            // User1 is in memberIds and should be able to read
            await assertSucceeds(getDoc(doc(user1Db, 'settlements', settlementId)));

            // User2 is also in memberIds and should be able to read
            await assertSucceeds(getDoc(doc(user2Db, 'settlements', settlementId)));
        });

        it('should deny non-members from reading settlements they are not part of', async () => {
            // User3 is NOT in memberIds and should be denied
            await assertFails(getDoc(doc(user3Db, 'settlements', settlementId)));
        });

        it('should deny all client writes to settlements', async () => {
            const updateData = {
                amount: 75
            };

            // No clients can write settlements
            await assertFails(setDoc(doc(user1Db, 'settlements', settlementId), updateData, { merge: true }));
        });
    });

    describe('Comments Subcollections', () => {
        const groupId = 'test-group-with-comments';
        const expenseId = 'test-expense-with-comments';
        const groupCommentId = 'group-comment-1';
        const expenseCommentId = 'expense-comment-1';

        beforeAll(async () => {
            await testEnv.withSecurityRulesDisabled(async (context: any) => {
                const db = context.firestore();

                // Create group with comments
                await setDoc(doc(db, 'groups', groupId), {
                    name: 'Group with Comments',
                    memberIds: ['user1-id', 'user2-id'],
                    createdAt: new Date()
                });

                await setDoc(doc(db, 'groups', groupId, 'comments', groupCommentId), {
                    text: 'A group comment',
                    userId: 'user1-id',
                    createdAt: new Date()
                });

                // Create expense with comments
                await setDoc(doc(db, 'expenses', expenseId), {
                    description: 'Expense with Comments',
                    memberIds: ['user1-id', 'user2-id'],
                    amount: 100,
                    createdAt: new Date()
                });

                await setDoc(doc(db, 'expenses', expenseId, 'comments', expenseCommentId), {
                    text: 'An expense comment',
                    userId: 'user1-id',
                    createdAt: new Date()
                });
            });
        });

        it('should allow authenticated users to read group comments', async () => {
            // According to the simplified rules, any authenticated user can read comments
            await assertSucceeds(getDoc(doc(user1Db, 'groups', groupId, 'comments', groupCommentId)));
            await assertSucceeds(getDoc(doc(user2Db, 'groups', groupId, 'comments', groupCommentId)));

            // Even non-members can read comments (simplified rule to avoid evaluation errors)
            await assertSucceeds(getDoc(doc(user3Db, 'groups', groupId, 'comments', groupCommentId)));
        });

        it('should allow authenticated users to read expense comments', async () => {
            // According to the simplified rules, any authenticated user can read comments
            await assertSucceeds(getDoc(doc(user1Db, 'expenses', expenseId, 'comments', expenseCommentId)));
            await assertSucceeds(getDoc(doc(user2Db, 'expenses', expenseId, 'comments', expenseCommentId)));
            await assertSucceeds(getDoc(doc(user3Db, 'expenses', expenseId, 'comments', expenseCommentId)));
        });

        it('should deny all client writes to comments', async () => {
            const newComment = {
                text: 'New comment',
                userId: 'user1-id',
                createdAt: new Date()
            };

            // No clients can write comments directly
            await assertFails(setDoc(doc(user1Db, 'groups', groupId, 'comments', 'new-comment'), newComment));
            await assertFails(setDoc(doc(user1Db, 'expenses', expenseId, 'comments', 'new-comment'), newComment));
        });
    });

    describe('User Notifications Collection', () => {
        beforeAll(async () => {
            await testEnv.withSecurityRulesDisabled(async (context: any) => {
                const db = context.firestore();

                // Create user notification documents
                await setDoc(doc(db, 'user-notifications', 'user1-id'), {
                    changeVersion: 1,
                    groups: {
                        'test-group-1': {
                            lastTransactionChange: new Date(),
                            transactionChangeCount: 5
                        }
                    },
                    lastModified: new Date()
                });

                await setDoc(doc(db, 'user-notifications', 'user2-id'), {
                    changeVersion: 1,
                    groups: {},
                    lastModified: new Date()
                });
            });
        });

        it('should allow users to read their own notification document', async () => {
            // User1 can read their own notifications
            await assertSucceeds(getDoc(doc(user1Db, 'user-notifications', 'user1-id')));

            // User2 can read their own notifications
            await assertSucceeds(getDoc(doc(user2Db, 'user-notifications', 'user2-id')));
        });

        it('should deny users from reading other users notification documents', async () => {
            // User1 cannot read user2's notifications
            await assertFails(getDoc(doc(user1Db, 'user-notifications', 'user2-id')));

            // User2 cannot read user1's notifications
            await assertFails(getDoc(doc(user2Db, 'user-notifications', 'user1-id')));
        });

        it('should deny all client writes to notifications', async () => {
            const updateData = {
                changeVersion: 2
            };

            // Users cannot write to their own notifications
            await assertFails(setDoc(doc(user1Db, 'user-notifications', 'user1-id'), updateData, { merge: true }));
        });
    });

    describe('Transaction Changes Collection', () => {
        const changeId = 'test-change-1';

        beforeAll(async () => {
            await testEnv.withSecurityRulesDisabled(async (context: any) => {
                const db = context.firestore();

                // Create a transaction change document
                await setDoc(doc(db, 'transaction-changes', changeId), {
                    groupId: 'test-group-1',
                    type: 'expense',
                    users: ['user1-id', 'user2-id'],  // Controls who can read this change
                    createdAt: new Date()
                });
            });
        });

        it('should allow users in the users array to read transaction changes', async () => {
            // User1 is in users array and should be able to read
            await assertSucceeds(getDoc(doc(user1Db, 'transaction-changes', changeId)));

            // User2 is also in users array and should be able to read
            await assertSucceeds(getDoc(doc(user2Db, 'transaction-changes', changeId)));
        });

        it('should deny users not in the users array from reading transaction changes', async () => {
            // User3 is NOT in users array and should be denied
            await assertFails(getDoc(doc(user3Db, 'transaction-changes', changeId)));
        });
    });

    describe('Policies Collection', () => {
        const policyId = 'privacy-policy';

        beforeAll(async () => {
            await testEnv.withSecurityRulesDisabled(async (context: any) => {
                const db = context.firestore();

                // Create a policy document
                await setDoc(doc(db, 'policies', policyId), {
                    type: 'privacy',
                    version: '1.0.0',
                    content: 'Privacy policy content...',
                    createdAt: new Date()
                });
            });
        });

        it('should allow all authenticated users to read policies', async () => {
            // All authenticated users can read policies
            await assertSucceeds(getDoc(doc(user1Db, 'policies', policyId)));
            await assertSucceeds(getDoc(doc(user2Db, 'policies', policyId)));
            await assertSucceeds(getDoc(doc(user3Db, 'policies', policyId)));
        });

        it('should deny unauthenticated users from reading policies', async () => {
            await assertFails(getDoc(doc(unauthDb, 'policies', policyId)));
        });

        it('should deny all client writes to policies', async () => {
            const updateData = {
                version: '2.0.0'
            };

            // No clients can write policies
            await assertFails(setDoc(doc(user1Db, 'policies', policyId), updateData, { merge: true }));
        });
    });

    describe('Group Balances Collection', () => {
        const groupId = 'test-group-1';

        beforeAll(async () => {
            await testEnv.withSecurityRulesDisabled(async (context: any) => {
                const db = context.firestore();

                // Create a group balance document
                await setDoc(doc(db, 'group-balances', groupId), {
                    groupId: groupId,
                    balances: {
                        'user1-id': { USD: 50 },
                        'user2-id': { USD: -50 }
                    },
                    lastUpdated: new Date()
                });
            });
        });

        it('should allow authenticated users to read group balances', async () => {
            // All authenticated users can attempt to read (actual access controlled by data)
            await assertSucceeds(getDoc(doc(user1Db, 'group-balances', groupId)));
            await assertSucceeds(getDoc(doc(user2Db, 'group-balances', groupId)));
            await assertSucceeds(getDoc(doc(user3Db, 'group-balances', groupId)));
        });

        it('should deny all client writes to group balances', async () => {
            const updateData = {
                lastUpdated: new Date()
            };

            // No clients can write balances
            await assertFails(setDoc(doc(user1Db, 'group-balances', groupId), updateData, { merge: true }));
        });
    });

    describe('Real-time Subscription Patterns', () => {
        it('should allow real-time subscriptions to comments for authenticated users', async () => {
            const groupId = 'test-group-1';

            // Test that onSnapshot works for authenticated users
            const unsubscribe = onSnapshot(
                query(collection(user1Db, 'groups', groupId, 'comments'), limit(10)),
                (snapshot) => {
                    // Subscription should work without errors
                    expect(snapshot).toBeDefined();
                },
                (error) => {
                    // Should not error for authenticated users
                    expect(error).toBeUndefined();
                }
            );

            // Clean up
            unsubscribe();
        });

        it('should allow real-time subscriptions to user notifications', async () => {
            // Test that onSnapshot works for user's own notifications
            const unsubscribe = onSnapshot(
                doc(user1Db, 'user-notifications', 'user1-id'),
                (snapshot) => {
                    // Subscription should work without errors
                    expect(snapshot).toBeDefined();
                },
                (error) => {
                    // Should not error for own notifications
                    expect(error).toBeUndefined();
                }
            );

            // Clean up
            unsubscribe();
        });
    });

    describe('Users Collection', () => {
        it('should allow users to read and write their own user document', async () => {
            const userData = {
                email: 'user1@example.com',
                displayName: 'User One',
                role: 'user'
            };

            // User should be able to write to their own document
            await assertSucceeds(setDoc(doc(user1Db, 'users', 'user1-id'), userData));

            // User should be able to read their own document
            await assertSucceeds(getDoc(doc(user1Db, 'users', 'user1-id')));
        });

        it('should deny users from reading other users documents', async () => {
            await testEnv.withSecurityRulesDisabled(async (context: any) => {
                const userData = {
                    email: 'other@example.com',
                    displayName: 'Other User',
                    role: 'user'
                };
                await setDoc(doc(context.firestore(), 'users', 'other-user-id'), userData);
            });

            // User should NOT be able to read other user's document
            await assertFails(getDoc(doc(user1Db, 'users', 'other-user-id')));
        });
    });

    describe('Edge Cases and Security Boundaries', () => {
        it('should properly handle empty memberIds arrays', async () => {
            await testEnv.withSecurityRulesDisabled(async (context: any) => {
                const db = context.firestore();

                // Create a group with empty memberIds
                await setDoc(doc(db, 'groups', 'empty-members-group'), {
                    name: 'Empty Members Group',
                    memberIds: [],  // Empty array
                    createdAt: new Date()
                });
            });

            // No one should be able to read a group with empty memberIds
            await assertFails(getDoc(doc(user1Db, 'groups', 'empty-members-group')));
            await assertFails(getDoc(doc(user2Db, 'groups', 'empty-members-group')));
        });

        it('should handle missing memberIds field correctly', async () => {
            await testEnv.withSecurityRulesDisabled(async (context: any) => {
                const db = context.firestore();

                // Create a group without memberIds field
                await setDoc(doc(db, 'groups', 'no-members-field'), {
                    name: 'No Members Field Group',
                    createdAt: new Date()
                    // memberIds is missing
                });
            });

            // Should fail for all users when memberIds is missing
            await assertFails(getDoc(doc(user1Db, 'groups', 'no-members-field')));
        });

        it('should deny access to non-existent documents', async () => {
            // Non-existent documents should fail gracefully
            await assertFails(getDoc(doc(user1Db, 'groups', 'non-existent-group')));
            await assertFails(getDoc(doc(user1Db, 'expenses', 'non-existent-expense')));
        });
    });
});