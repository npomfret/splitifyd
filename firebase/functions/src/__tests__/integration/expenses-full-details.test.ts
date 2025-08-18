import { ApiDriver, User } from '../support/ApiDriver';

describe('Expenses Full Details API', () => {
    let apiDriver: ApiDriver;
    let alice: User;
    let bob: User;
    let charlie: User;
    let groupId: string;
    let expenseId: string;

    beforeAll(async () => {
        apiDriver = new ApiDriver();
        
        // Create test users with strong passwords
        alice = await apiDriver.createUser({
            email: 'alice.expensefulldetails@example.com',
            password: 'Password123!',
            displayName: 'Alice Expense Full Details'
        });
        
        bob = await apiDriver.createUser({
            email: 'bob.expensefulldetails@example.com',
            password: 'Password123!',
            displayName: 'Bob Expense Full Details'
        });
        
        charlie = await apiDriver.createUser({
            email: 'charlie.expensefulldetails@example.com',
            password: 'Password123!',
            displayName: 'Charlie Expense Full Details'
        });
    });

    beforeEach(async () => {
        // Create a fresh group and expense for each test
        const group = await apiDriver.createGroupWithMembers(
            'Expense Full Details Test Group',
            [alice, bob, charlie],
            alice.token
        );
        groupId = group.id;

        // Create a test expense
        const expense = await apiDriver.createExpense({
            groupId,
            description: 'Test dinner for full details',
            amount: 75.50,
            paidBy: alice.uid,
            currency: 'USD',
            category: 'Food',
            participants: [alice.uid, bob.uid, charlie.uid],
            splitType: 'equal',
            date: new Date().toISOString()
        }, alice.token);
        expenseId = expense.id;
    });

    describe('GET /expenses/:id/full-details', () => {
        it('should return consolidated expense data with group and members', async () => {
            const fullDetails = await apiDriver.getExpenseFullDetails(expenseId, alice.token);

            // Verify expense data
            expect(fullDetails.expense).toBeDefined();
            expect(fullDetails.expense.id).toBe(expenseId);
            expect(fullDetails.expense.description).toBe('Test dinner for full details');
            expect(fullDetails.expense.amount).toBe(75.50);
            expect(fullDetails.expense.paidBy).toBe(alice.uid);
            expect(fullDetails.expense.currency).toBe('USD');
            expect(fullDetails.expense.category).toBe('Food');
            expect(fullDetails.expense.participants).toEqual([alice.uid, bob.uid, charlie.uid]);
            expect(fullDetails.expense.splitType).toBe('equal');
            expect(fullDetails.expense.splits).toBeDefined();
            expect(fullDetails.expense.splits).toHaveLength(3);

            // Verify group data
            expect(fullDetails.group).toBeDefined();
            expect(fullDetails.group.id).toBe(groupId);
            expect(fullDetails.group.name).toBe('Expense Full Details Test Group');
            expect(fullDetails.group.createdBy).toBe(alice.uid);
            expect(fullDetails.group.memberIds).toEqual(expect.arrayContaining([alice.uid, bob.uid, charlie.uid]));

            // Verify members data
            expect(fullDetails.members).toBeDefined();
            expect(fullDetails.members.members).toBeDefined();
            expect(fullDetails.members.members).toHaveLength(3);
            
            const memberUids = fullDetails.members.members.map(m => m.uid);
            expect(memberUids).toEqual(expect.arrayContaining([alice.uid, bob.uid, charlie.uid]));
            
            // Verify member details
            const aliceMember = fullDetails.members.members.find(m => m.uid === alice.uid);
            expect(aliceMember).toBeDefined();
            expect(aliceMember!.displayName).toBe('Alice Expense Full Details');
        });

        it('should work for group members (not just owner)', async () => {
            const fullDetails = await apiDriver.getExpenseFullDetails(expenseId, bob.token);

            // Bob should be able to access the consolidated data
            expect(fullDetails.expense.id).toBe(expenseId);
            expect(fullDetails.group.id).toBe(groupId);
            expect(fullDetails.members.members).toHaveLength(3);
        });

        it('should fail for users not in the group', async () => {
            const outsider = await apiDriver.createUser({
                email: 'outsider.expensefulldetails@example.com',
                password: 'Password123!',
                displayName: 'Outsider'
            });

            await expect(
                apiDriver.getExpenseFullDetails(expenseId, outsider.token)
            ).rejects.toThrow();
        });

        it('should work with complex expense data', async () => {
            // Create expense with custom splits
            const complexExpense = await apiDriver.createExpense({
                groupId,
                description: 'Complex split expense',
                amount: 100,
                paidBy: bob.uid,
                currency: 'EUR',
                category: 'Entertainment',
                participants: [alice.uid, bob.uid, charlie.uid],
                splitType: 'exact',
                splits: [
                    { userId: alice.uid, amount: 30 },
                    { userId: bob.uid, amount: 40 },
                    { userId: charlie.uid, amount: 30 }
                ],
                date: new Date().toISOString()
            }, alice.token);

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
                apiDriver.getExpenseFullDetails(expenseId, alice.token),
                apiDriver.getExpenseFullDetails(expenseId, bob.token),
                apiDriver.getExpenseFullDetails(expenseId, charlie.token)
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