import { toExpenseId, toUserId, toVersionHash, USD } from '@billsplit-wl/shared';
import {
    ActivityFeedItemBuilder,
    ClientUserBuilder,
    CommentBuilder,
    ExpenseDTOBuilder,
    ExpenseSplitBuilder,
    ExpenseUpdateBuilder,
    getFirestorePort,
    GroupBalanceDocumentBuilder,
    GroupDTOBuilder,
    GroupMemberDocumentBuilder,
    GroupUpdateBuilder,
    PolicyDocumentBuilder,
    SettlementDTOBuilder,
    SettlementUpdateBuilder,
} from '@billsplit-wl/test-support';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, query, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

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

    const userId1 = toUserId('user1-id');
    const userId2 = toUserId('user2-id');

    beforeAll(async () => {
        // Read the rules file
        const rulesPath = join(__dirname, '../../../../firestore.rules');
        const rules = readFileSync(rulesPath, 'utf8');

        // Initialize test environment
        testEnv = await initializeTestEnvironment({
            projectId,
            firestore: {
                rules,
                host: '127.0.0.1',
                port: getFirestorePort(),
            },
        });

        // Create authenticated contexts for test users
        user1Context = testEnv.authenticatedContext(userId1, {
            email: 'user1@example.com',
        });
        user1Db = user1Context.firestore();

        user2Context = testEnv.authenticatedContext(userId2, {
            email: 'user2@example.com',
        });
        user2Db = user2Context.firestore();

        user3Context = testEnv.authenticatedContext('user3-id', {
            email: 'user3@example.com',
        });
        user3Db = user3Context.firestore();

        // Create unauthenticated context
        unauthenticatedContext = testEnv.unauthenticatedContext();
        unauthDb = unauthenticatedContext.firestore();
    });

    afterAll(async () => {
        await testEnv?.cleanup();
    });

    afterEach(async () => {
    });

    describe('Groups Collection', () => {
        const groupId = 'test-group-1';

        beforeAll(async () => {
            // Setup test data with admin privileges
            await testEnv
                .withSecurityRulesDisabled(async (context: any) => {
                    const db = context.firestore();

                    // Create a group with user1 and user2 as members
                    const group = new GroupDTOBuilder()
                        .withName('Test Group')
                        .withDescription('A test group')
                        .build();

                    await setDoc(doc(db, 'groups', groupId), group);

                    // Create group-memberships documents for security rules
                    const now = new Date();
                    const user1Membership = new GroupMemberDocumentBuilder()
                        .withUserId(userId1)
                        .withGroupId(groupId)
                        .withRole('member')
                        .withStatus('active')
                        .withJoinedAt(now)
                        .withInvitedBy('system')
                        .build();

                    const user2Membership = new GroupMemberDocumentBuilder()
                        .withUserId(userId2)
                        .withGroupId(groupId)
                        .withRole('member')
                        .withStatus('active')
                        .withJoinedAt(now)
                        .withInvitedBy('system')
                        .build();

                    await setDoc(doc(db, 'group-memberships', 'user1-id_' + groupId), user1Membership);
                    await setDoc(doc(db, 'group-memberships', 'user2-id_' + groupId), user2Membership);
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
            const updateData = GroupUpdateBuilder
                .empty()
                .withName('Updated Group Name')
                .build();

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
            await testEnv
                .withSecurityRulesDisabled(async (context: any) => {
                    const db = context.firestore();

                    // Create an expense for the test group
                    const expense = new ExpenseDTOBuilder()
                        .withGroupId(groupId)
                        .withCreatedBy(userId1)
                        .withPaidBy(userId1)
                        // Note: ExpenseDTOBuilder doesn't have memberIds - access is controlled differently

                        .withParticipants([userId1, userId2])
                        .withSplits(
                            new ExpenseSplitBuilder()
                                .withSplit(userId1, '50')
                                .withSplit(userId2, '50')
                                .build(),
                        )
                        .build();

                    await setDoc(doc(db, 'expenses', expenseId), expense);
                });
        });

        it('should allow any authenticated user to read expenses', async () => {
            // Any authenticated user can read expenses (not restricted to participants)
            await assertSucceeds(getDoc(doc(user1Db, 'expenses', expenseId)));
            await assertSucceeds(getDoc(doc(user2Db, 'expenses', expenseId)));
            await assertSucceeds(getDoc(doc(user3Db, 'expenses', expenseId)));
        });

        it('should deny all client writes to expenses', async () => {
            const updateData = ExpenseUpdateBuilder
                .minimal()
                .withDescription('Updated Expense')
                .build();

            // Even group members cannot write
            await assertFails(setDoc(doc(user1Db, 'expenses', expenseId), updateData, { merge: true }));
            await assertFails(setDoc(doc(user2Db, 'expenses', expenseId), updateData, { merge: true }));
        });
    });

    describe('Settlements Collection', () => {
        const settlementId = 'test-settlement-1';

        beforeAll(async () => {
            await testEnv
                .withSecurityRulesDisabled(async (context: any) => {
                    const db = context.firestore();

                    // Create a settlement
                    const settlement = new SettlementDTOBuilder()
                        .withGroupId('test-group-1')
                        .withPayerId(userId2) // Changed from fromUserId to payerId
                        .withPayeeId(userId1) // Changed from toUserId to payeeId
                        .withAmount(50, 'USD')
                        // Note: ExpenseDTOBuilder doesn't have memberIds - access is controlled differently
                        .build();

                    await setDoc(doc(db, 'settlements', settlementId), settlement);
                });
        });

        it('should allow group members to read settlements in their groups', async () => {
            // User1 is the payee and should be able to read
            await assertSucceeds(getDoc(doc(user1Db, 'settlements', settlementId)));

            // User2 is the payer and should be able to read
            await assertSucceeds(getDoc(doc(user2Db, 'settlements', settlementId)));
        });

        it('should deny non-members from reading settlements they are not part of', async () => {
            // User3 is neither payer nor payee and should be denied
            await assertFails(getDoc(doc(user3Db, 'settlements', settlementId)));
        });

        it('should deny all client writes to settlements', async () => {
            const updateData = SettlementUpdateBuilder
                .empty()
                .withAmount(75, 'USD')
                .build();

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
            await testEnv
                .withSecurityRulesDisabled(async (context: any) => {
                    const db = context.firestore();

                    // Create group with comments
                    const commentGroup = new GroupDTOBuilder()
                        .withName('Group with Comments')
                        .build();

                    await setDoc(doc(db, 'groups', groupId), commentGroup);

                    // Create comment document manually for now (CommentBuilder creates API response structure)
                    await setDoc(doc(db, 'groups', groupId, 'comments', groupCommentId), new CommentBuilder().withText('A group comment').withAuthorId(userId1).withCreatedAt(new Date()).build());

                    // Create group-memberships for comment group
                    const commentNow = new Date();
                    const commentUser1Membership = new GroupMemberDocumentBuilder()
                        .withUserId(userId1)
                        .withGroupId(groupId)
                        .withRole('member')
                        .withStatus('active')
                        .withJoinedAt(commentNow)
                        .withInvitedBy('system')
                        .build();

                    const commentUser2Membership = new GroupMemberDocumentBuilder()
                        .withUserId(userId2)
                        .withGroupId(groupId)
                        .withRole('member')
                        .withStatus('active')
                        .withJoinedAt(commentNow)
                        .withInvitedBy('system')
                        .build();

                    await setDoc(doc(db, 'group-memberships', 'user1-id_' + groupId), commentUser1Membership);
                    await setDoc(doc(db, 'group-memberships', 'user2-id_' + groupId), commentUser2Membership);

                    // Create expense with comments
                    const commentExpense = new ExpenseDTOBuilder()
                        .withDescription('Expense with Comments')
                        .withParticipants([userId1, userId2])
                        .build();

                    await setDoc(doc(db, 'expenses', expenseId), commentExpense);

                    // Create expense comment document manually for now
                    await setDoc(
                        doc(db, 'expenses', expenseId, 'comments', expenseCommentId),
                        new CommentBuilder().withText('An expense comment').withAuthorId(userId1).withCreatedAt(new Date()).build(),
                    );
                });
        });

        it('should allow authenticated users to read group comments', async () => {
            // Only group members can read group comments (user1 and user2 are members)
            await assertSucceeds(getDoc(doc(user1Db, 'groups', groupId, 'comments', groupCommentId)));
            await assertSucceeds(getDoc(doc(user2Db, 'groups', groupId, 'comments', groupCommentId)));

            // Non-members cannot read comments
            await assertFails(getDoc(doc(user3Db, 'groups', groupId, 'comments', groupCommentId)));
        });

        it('should allow authenticated users to read expense comments', async () => {
            // Any authenticated user can read expense comments
            await assertSucceeds(getDoc(doc(user1Db, 'expenses', expenseId, 'comments', expenseCommentId)));
            await assertSucceeds(getDoc(doc(user2Db, 'expenses', expenseId, 'comments', expenseCommentId)));
            await assertSucceeds(getDoc(doc(user3Db, 'expenses', expenseId, 'comments', expenseCommentId)));
        });

        it('should deny all client writes to comments', async () => {
            const newComment = new CommentBuilder().withText('New comment').withAuthorId(userId1).withCreatedAt(new Date()).build();

            // No clients can write comments directly
            await assertFails(setDoc(doc(user1Db, 'groups', groupId, 'comments', 'new-comment'), newComment));
            await assertFails(setDoc(doc(user1Db, 'expenses', expenseId, 'comments', 'new-comment'), newComment));
        });
    });

    describe('Activity Feed Collection', () => {
        const userId = userId1;
        const feedItemId = 'feed-item-1';

        beforeAll(async () => {
            await testEnv.withSecurityRulesDisabled(async (context: any) => {
                const db = context.firestore();
                const now = new Date();

                await setDoc(
                    doc(db, 'activity-feed', userId, 'items', feedItemId),
                    ActivityFeedItemBuilder
                        .create()
                        .withUserId(userId)
                        .withGroupId('test-group-1')
                        .withGroupName('Test Group')
                        .withEventType('expense-created')
                        .withActorId(userId)
                        .withActorName('User One')
                        .withTimestamp(now)
                        .withCreatedAt(now)
                        .withDetails({
                            expenseId: toExpenseId('expense-1'),
                        })
                        .build(),
                );
            });
        });

        it('should allow the owner to read their activity feed items', async () => {
            await assertSucceeds(getDoc(doc(user1Db, 'activity-feed', userId, 'items', feedItemId)));
            await assertSucceeds(getDocs(query(collection(user1Db, 'activity-feed', userId, 'items'), limit(5))));
        });

        it('should deny access to someone else\'s activity feed items', async () => {
            await assertFails(getDoc(doc(user2Db, 'activity-feed', userId, 'items', feedItemId)));
            await assertFails(getDocs(collection(user2Db, 'activity-feed', userId, 'items')));
        });

        it('should deny unauthenticated users from reading activity feed items', async () => {
            await assertFails(getDoc(doc(unauthDb, 'activity-feed', userId, 'items', feedItemId)));
        });

        it('should deny all client writes to activity feed items', async () => {
            const newItemRef = doc(user1Db, 'activity-feed', userId, 'items', 'feed-item-2');
            const now = new Date();

            await assertFails(
                setDoc(
                    newItemRef,
                    ActivityFeedItemBuilder
                        .create()
                        .withUserId(userId)
                        .withGroupId('test-group-1')
                        .withGroupName('Test Group')
                        .withEventType('expense-created')
                        .withActorId(userId)
                        .withActorName('User One')
                        .withTimestamp(now)
                        .withCreatedAt(now)
                        .withDetails({})
                        .build(),
                ),
            );
        });
    });

    describe('Policies Collection', () => {
        const policyId = 'privacy-policy';

        beforeAll(async () => {
            await testEnv
                .withSecurityRulesDisabled(async (context: any) => {
                    const db = context.firestore();

                    // Create a policy document
                    const policy = new PolicyDocumentBuilder()
                        .withId(policyId)
                        .withPolicyName('privacy')
                        .withVersionText(toVersionHash('v1.0.0'), 'Privacy policy content...')
                        .build();

                    await setDoc(doc(db, 'policies', policyId), policy);
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
                version: '2.0.0',
            };

            // No clients can write policies
            await assertFails(setDoc(doc(user1Db, 'policies', policyId), updateData, { merge: true }));
        });
    });

    describe('Group Balances Collection', () => {
        const groupId = 'test-group-1';

        beforeAll(async () => {
            await testEnv
                .withSecurityRulesDisabled(async (context: any) => {
                    const db = context.firestore();

                    // Create a group balance document
                    const groupBalance = new GroupBalanceDocumentBuilder()
                        .withGroupId(groupId)
                        .withBalance(userId1, USD, '50')
                        .withBalance(userId2, USD, '-50')
                        .build();

                    await setDoc(doc(db, 'balances', groupId), groupBalance);
                });
        });

        it('should allow authenticated users to read group balances', async () => {
            // Only group members can read group balances (user1 and user2 are members from Groups Collection setup)
            await assertSucceeds(getDoc(doc(user1Db, 'balances', groupId)));
            await assertSucceeds(getDoc(doc(user2Db, 'balances', groupId)));

            // User3 is not a group member and should be denied
            await assertFails(getDoc(doc(user3Db, 'balances', groupId)));
        });

        it('should deny all client writes to group balances', async () => {
            const updateData = {
                lastUpdated: new Date(),
            };

            // No clients can write balances
            await assertFails(setDoc(doc(user1Db, 'balances', groupId), updateData, { merge: true }));
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
                },
            );

            // Clean up
            unsubscribe();
        });
    });

    describe('Users Collection', () => {
        it('should allow users to read and write their own user document', async () => {
            const userData = new ClientUserBuilder()
                .withEmail('user1@example.com')
                .withDisplayName('User One')
                .build();

            // Remove role field as users cannot set their own role
            const { role, ...userDataWithoutRole } = userData;

            // User should be able to write to their own document (without role field)
            await assertSucceeds(setDoc(doc(user1Db, 'users', userId1), userDataWithoutRole));

            // User should be able to read their own document
            await assertSucceeds(getDoc(doc(user1Db, 'users', userId1)));
        });

        it('should deny users from reading other users documents', async () => {
            await testEnv
                .withSecurityRulesDisabled(async (context: any) => {
                    const userData = new ClientUserBuilder()
                        .withEmail('other@example.com')
                        .withDisplayName('Other User')
                        .withRole('system_user')
                        .build();
                    await setDoc(doc(context.firestore(), 'users', 'other-user-id'), userData);
                });

            // User should NOT be able to read other user's document
            await assertFails(getDoc(doc(user1Db, 'users', 'other-user-id')));
        });
    });

    describe('Edge Cases and Security Boundaries', () => {
        it('should properly handle empty memberIds arrays', async () => {
            await testEnv
                .withSecurityRulesDisabled(async (context: any) => {
                    const db = context.firestore();

                    // Create a group with empty memberIds
                    const emptyMembersGroup = {
                        ...new GroupDTOBuilder()
                            .withName('Empty Members Group')
                            .build(),
                        memberIds: [] as string[],
                    };

                    await setDoc(
                        doc(db, 'groups', 'empty-members-group'),
                        emptyMembersGroup,
                    );
                });

            // No one should be able to read a group with empty memberIds
            await assertFails(getDoc(doc(user1Db, 'groups', 'empty-members-group')));
            await assertFails(getDoc(doc(user2Db, 'groups', 'empty-members-group')));
        });

        it('should handle missing memberIds field correctly', async () => {
            await testEnv
                .withSecurityRulesDisabled(async (context: any) => {
                    const db = context.firestore();

                    // Create a group without memberIds field
                    const noMembersFieldGroup = new GroupDTOBuilder()
                        .withName('No Members Field Group')
                        .build();

                    await setDoc(doc(db, 'groups', 'no-members-field'), noMembersFieldGroup);
                });

            // Should fail for all users when memberIds is missing
            await assertFails(getDoc(doc(user1Db, 'groups', 'no-members-field')));
        });

        it('should deny access to non-existent documents', async () => {
            // Non-existent groups should fail (user is not a member)
            await assertFails(getDoc(doc(user1Db, 'groups', 'non-existent-group')));
            // Non-existent expenses are readable by authenticated users (returns empty doc)
            await assertSucceeds(getDoc(doc(user1Db, 'expenses', 'non-existent-expense')));
        });
    });
});
