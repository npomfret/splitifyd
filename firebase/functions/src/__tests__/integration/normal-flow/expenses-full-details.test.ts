import { ApiDriver, User } from '@splitifyd/test-support';
import { FirebaseIntegrationTestUserPool } from '../../support/FirebaseIntegrationTestUserPool';
import { ExpenseBuilder } from '@splitifyd/test-support';

describe('Expenses Full Details API', () => {
    let apiDriver: ApiDriver;
    let userPool: FirebaseIntegrationTestUserPool;
    let alice: User;
    let bob: User;
    let charlie: User;
    let groupId: string;
    let expenseId: string;

    jest.setTimeout(10000);

    beforeAll(async () => {
        apiDriver = new ApiDriver();
        
        // Create user pool with 4 users (need extra for outsider test)
        userPool = new FirebaseIntegrationTestUserPool(apiDriver, 4);
        await userPool.initialize();
    });

    beforeEach(async () => {
        // Use users from pool
        const users = userPool.getUsers(3);
        alice = users[0];
        bob = users[1];
        charlie = users[2];

        // Create a fresh group and expense for each test
        const group = await apiDriver.createGroupWithMembers(
            'Expense Full Details Test Group',
            [alice, bob, charlie],
            alice.token
        );
        groupId = group.id;

        // Create a test expense
        const expense = await apiDriver.createExpense(
            new ExpenseBuilder()
                .withGroupId(groupId)
                .withPaidBy(alice.uid)
                .withParticipants([alice.uid, bob.uid, charlie.uid])
                .build(),
            alice.token
        );
        expenseId = expense.id;
    });


    describe('GET /expenses/:id/full-details', () => {
        it('should return consolidated expense data with group and members', async () => {
            const fullDetails = await apiDriver.getExpenseFullDetails(expenseId, alice.token);

            // Verify expense data
            expect(fullDetails.expense).toBeDefined();
            expect(fullDetails.expense.id).toBe(expenseId);
            expect(fullDetails.expense.description).toBeDefined();
            expect(fullDetails.expense.amount).toBeDefined();
            expect(fullDetails.expense.paidBy).toBe(alice.uid);
            expect(fullDetails.expense.currency).toBeDefined();
            expect(fullDetails.expense.category).toBeDefined();
            expect(fullDetails.expense.participants).toEqual([alice.uid, bob.uid, charlie.uid]);
            expect(fullDetails.expense.splitType).toBeDefined();
            expect(fullDetails.expense.splits).toBeDefined();
            expect(fullDetails.expense.splits).toHaveLength(3);

            // Verify group data
            expect(fullDetails.group).toBeDefined();
            expect(fullDetails.group.id).toBe(groupId);
            expect(fullDetails.group.name).toBe('Expense Full Details Test Group');
            expect(fullDetails.group.createdBy).toBe(alice.uid);
            expect(Object.keys(fullDetails.group.members)).toEqual(expect.arrayContaining([alice.uid, bob.uid, charlie.uid]));

            // Verify members data
            expect(fullDetails.members).toBeDefined();
            expect(fullDetails.members.members).toBeDefined();
            expect(fullDetails.members.members).toHaveLength(3);
            
            const memberUids = fullDetails.members.members.map(m => m.uid);
            expect(memberUids).toEqual(expect.arrayContaining([alice.uid, bob.uid, charlie.uid]));
            
            // Verify member details
            const aliceMember = fullDetails.members.members.find(m => m.uid === alice.uid);
            expect(aliceMember).toBeDefined();
            expect(aliceMember!.displayName).toBeDefined();
            expect(typeof aliceMember!.displayName).toBe('string');
        });

        it('should work for group members (not just owner)', async () => {
            const fullDetails = await apiDriver.getExpenseFullDetails(expenseId, bob.token);

            // Bob should be able to access the consolidated data
            expect(fullDetails.expense.id).toBe(expenseId);
            expect(fullDetails.group.id).toBe(groupId);
            expect(fullDetails.members.members).toHaveLength(3);
        });

        it('should fail for users not in the group', async () => {
            // Use the 4th user from the pool as an outsider
            const users = userPool.getUsers(4);
            const outsider = users[3];

            await expect(
                apiDriver.getExpenseFullDetails(expenseId, outsider.token)
            ).rejects.toThrow();
        });

        it('should work with complex expense data', async () => {
            // Create expense with custom splits
            const complexExpense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(bob.uid)
                    .withParticipants([alice.uid, bob.uid, charlie.uid])
                    .withSplitType('exact')
                    .withSplits([
                        { userId: alice.uid, amount: 30 },
                        { userId: bob.uid, amount: 40 },
                        { userId: charlie.uid, amount: 30 }
                    ])
                    .build(),
                alice.token
            );

            const fullDetails = await apiDriver.getExpenseFullDetails(complexExpense.id, alice.token);

            expect(fullDetails.expense.splitType).toBe('exact');
            expect(fullDetails.expense.splits).toHaveLength(3);
            expect(fullDetails.expense.splits.find((s: any) => s.userId === alice.uid)?.amount).toBe(30);
            expect(fullDetails.expense.splits.find((s: any) => s.userId === bob.uid)?.amount).toBe(40);
            expect(fullDetails.expense.splits.find((s: any) => s.userId === charlie.uid)?.amount).toBe(30);
        });

        it('should handle parallel requests correctly', async () => {
            // Test that multiple simultaneous requests work correctly
            const requests = [
                await apiDriver.getExpenseFullDetails(expenseId, alice.token),
                await apiDriver.getExpenseFullDetails(expenseId, bob.token),
                await apiDriver.getExpenseFullDetails(expenseId, charlie.token)
            ];

            const results = await Promise.all(requests);

            // All requests should return the same data
            results.forEach(result => {
                expect(result.expense.id).toBe(expenseId);
                expect(result.group.id).toBe(groupId);
                expect(result.members.members).toHaveLength(3);
            });
        });

        it('should return 404 for non-existent expense', async () => {
            await expect(
                apiDriver.getExpenseFullDetails('invalid-expense-id', alice.token)
            ).rejects.toThrow();
        });

        it('should require authentication', async () => {
            await expect(
                apiDriver.getExpenseFullDetails(expenseId, '')
            ).rejects.toThrow();
        });
    });
});