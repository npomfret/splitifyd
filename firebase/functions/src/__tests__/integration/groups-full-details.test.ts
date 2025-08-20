import { ApiDriver, User } from '../support/ApiDriver';

describe('Groups Full Details API', () => {
    let apiDriver: ApiDriver;
    let alice: User;
    let bob: User;
    let charlie: User;
    let groupId: string;

    beforeAll(async () => {
        apiDriver = new ApiDriver();
        
        // Create test users with strong passwords
        alice = await apiDriver.createUser({
            email: 'alice.fulldetails@example.com',
            password: 'Password123!',
            displayName: 'Alice Full Details'
        });
        
        bob = await apiDriver.createUser({
            email: 'bob.fulldetails@example.com',
            password: 'Password123!',
            displayName: 'Bob Full Details'
        });
        
        charlie = await apiDriver.createUser({
            email: 'charlie.fulldetails@example.com',
            password: 'Password123!',
            displayName: 'Charlie Full Details'
        });
    });

    beforeEach(async () => {
        // Create a fresh group for each test
        const group = await apiDriver.createGroupWithMembers(
            'Full Details Test Group',
            [alice, bob, charlie],
            alice.token
        );
        groupId = group.id;
    });

    describe('GET /groups/:id/full-details', () => {
        it('should return consolidated group data with all components', async () => {
            // Add some test data to make the response more interesting
            const expense = await apiDriver.createExpense({
                groupId,
                description: 'Test dinner',
                amount: 60,
                paidBy: alice.uid,
                splitType: 'equal',
                participants: [alice.uid, bob.uid, charlie.uid],
                date: new Date().toISOString(),
                category: 'food',
                currency: 'USD'
            }, alice.token);

            await apiDriver.createSettlement({
                groupId,
                payerId: bob.uid,
                payeeId: alice.uid,
                amount: 20,
                note: 'Partial payment',
                currency: 'USD',
                date: new Date().toISOString()
            }, bob.token);

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
            expect(fullDetails.group.name).toBe('Full Details Test Group');
            expect(fullDetails.group.members).toHaveProperty(alice.uid);
            expect(fullDetails.group.members).toHaveProperty(bob.uid);
            expect(fullDetails.group.members).toHaveProperty(charlie.uid);

            // Verify members data
            expect(fullDetails.members.members).toHaveLength(3);
            const memberUids = fullDetails.members.members.map((m: any) => m.uid);
            expect(memberUids).toContain(alice.uid);
            expect(memberUids).toContain(bob.uid);
            expect(memberUids).toContain(charlie.uid);

            // Verify expenses data
            expect(fullDetails.expenses.expenses).toHaveLength(1);
            expect(fullDetails.expenses.expenses[0].id).toBe(expense.id);
            expect(fullDetails.expenses.expenses[0].description).toBe('Test dinner');
            expect(fullDetails.expenses.hasMore).toBe(false);

            // Verify balances data (calculated from expenses and settlements)
            expect(fullDetails.balances).toHaveProperty('userBalances');
            expect(fullDetails.balances).toHaveProperty('balancesByCurrency');
            expect(fullDetails.balances.groupId).toBe(groupId);

            // Verify settlements data
            expect(fullDetails.settlements.settlements).toHaveLength(1);
            expect(fullDetails.settlements.settlements[0].payer.uid).toBe(bob.uid);
            expect(fullDetails.settlements.settlements[0].payee.uid).toBe(alice.uid);
            expect(fullDetails.settlements.settlements[0].amount).toBe(20);
            expect(fullDetails.settlements.hasMore).toBe(false);
        });

        it('should return empty collections for a new group', async () => {
            const fullDetails = await apiDriver.getGroupFullDetails(groupId, alice.token);

            // Should still have the basic structure
            expect(fullDetails.group.id).toBe(groupId);
            expect(fullDetails.members.members).toHaveLength(3); // Alice, Bob, Charlie

            // But empty collections for data
            expect(fullDetails.expenses.expenses).toHaveLength(0);
            expect(fullDetails.expenses.hasMore).toBe(false);
            expect(fullDetails.settlements.settlements).toHaveLength(0);
            expect(fullDetails.settlements.hasMore).toBe(false);

            // Balances should exist but be empty (no transactions)
            expect(fullDetails.balances).toHaveProperty('userBalances');
            expect(Object.keys(fullDetails.balances.userBalances)).toHaveLength(0);
        });

        it('should respect user access permissions', async () => {
            // Create a different user not in the group
            const outsider = await apiDriver.createUser({
                email: 'outsider.fulldetails@example.com',
                password: 'Password123!',
                displayName: 'Outsider User'
            });

            // Should throw an error when unauthorized user tries to access
            await expect(
                apiDriver.getGroupFullDetails(groupId, outsider.token)
            ).rejects.toThrow(/Group.*not found|not found|Group/i);
        });

        it('should handle pagination information correctly', async () => {
            // Create many expenses to test pagination
            const expensePromises = [];
            for (let i = 0; i < 25; i++) {
                expensePromises.push(
                    apiDriver.createExpense({
                        groupId,
                        description: `Test expense ${i}`,
                        amount: 10,
                        paidBy: alice.uid,
                        splitType: 'equal',
                        participants: [alice.uid, bob.uid],
                        date: new Date(Date.now() - i * 1000).toISOString(), // Different times
                        category: 'food',
                        currency: 'USD'
                    }, alice.token)
                );
            }
            await Promise.all(expensePromises);

            const fullDetails = await apiDriver.getGroupFullDetails(groupId, alice.token);

            // Should return 20 expenses (limit) with hasMore = true
            expect(fullDetails.expenses.expenses).toHaveLength(20);
            expect(fullDetails.expenses.hasMore).toBe(true);
            expect(fullDetails.expenses.nextCursor).toBeDefined();
        });

        it('should support pagination parameters for expenses and settlements', async () => {
            // Create multiple expenses and settlements
            const expensePromises = [];
            for (let i = 0; i < 15; i++) {
                expensePromises.push(
                    apiDriver.createExpense({
                        groupId,
                        description: `Expense ${i}`,
                        amount: 30,
                        paidBy: alice.uid,
                        splitType: 'equal',
                        participants: [alice.uid, bob.uid],
                        date: new Date(Date.now() - i * 1000).toISOString(),
                        category: 'food',
                        currency: 'USD'
                    }, alice.token)
                );
            }
            await Promise.all(expensePromises);

            const settlementPromises = [];
            for (let i = 0; i < 15; i++) {
                settlementPromises.push(
                    apiDriver.createSettlement({
                        groupId,
                        payerId: bob.uid,
                        payeeId: alice.uid,
                        amount: 5,
                        note: `Settlement ${i}`,
                        currency: 'USD',
                        date: new Date(Date.now() - i * 2000).toISOString()
                    }, bob.token)
                );
            }
            await Promise.all(settlementPromises);

            // Test with custom pagination limits
            const fullDetails = await apiDriver.getGroupFullDetails(groupId, alice.token, {
                expenseLimit: 5,
                settlementLimit: 3
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
                expenseCursor: fullDetails.expenses.nextCursor!
            });

            // Should return next 5 expenses
            expect(nextPage.expenses.expenses).toHaveLength(5);
            expect(nextPage.expenses.expenses[0].id).not.toBe(fullDetails.expenses.expenses[0].id);
        });

        it('should return consistent data across individual and consolidated endpoints', async () => {
            // Add test data
            await apiDriver.createExpense({
                groupId,
                description: 'Consistency test',
                amount: 100,
                paidBy: alice.uid,
                splitType: 'equal',
                participants: [alice.uid, bob.uid],
                date: new Date().toISOString(),
                category: 'food',
                currency: 'USD'
            }, alice.token);

            // Get data from both consolidated and individual endpoints
            const [fullDetails, group, members, expenses, balances] = await Promise.all([
                apiDriver.getGroupFullDetails(groupId, alice.token),
                apiDriver.getGroup(groupId, alice.token),
                apiDriver.getGroupMembers(groupId, alice.token),
                apiDriver.getGroupExpenses(groupId, alice.token),
                apiDriver.getGroupBalances(groupId, alice.token)
            ]);

            // Verify consistency
            expect(fullDetails.group.id).toBe(group.id);
            expect(fullDetails.group.name).toBe(group.name);
            expect(fullDetails.members.members).toEqual(members.members);
            expect(fullDetails.expenses.expenses).toEqual(expenses.expenses);
            expect(fullDetails.balances.groupId).toBe(balances.groupId);
        });

        it('should handle invalid group ID', async () => {
            await expect(
                apiDriver.getGroupFullDetails('invalid-group-id', alice.token)
            ).rejects.toThrow(/Group.*not found|not found|Group/i);
        });

        it('should require authentication', async () => {
            await expect(
                apiDriver.getGroupFullDetails(groupId, '')
            ).rejects.toThrow(/unauthorized|token|auth/i);
        });
    });
});