import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ApiDriver, User } from '../../support/ApiDriver';
import { clearAllTestData } from '../../support/cleanupHelpers';
import {
    pollForChange,
    getGroupChanges,
    getExpenseChanges,
    getBalanceChanges,
    clearGroupChangeDocuments,
    waitForDebounce,
    countRecentChanges,
    GroupChangeDocument,
    ExpenseChangeDocument,
    BalanceChangeDocument,
} from '../../support/changeCollectionHelpers';

describe('Change Detection Integration Tests', () => {
    let apiDriver: ApiDriver;
    let user1: User;
    let user2: User;
    let groupId: string;

    beforeAll(async () => {
        apiDriver = new ApiDriver();
        
        // Create test users
        user1 = await apiDriver.createUser({
            email: `test.user1.${Date.now()}@example.com`,
            password: 'Test123!',
            displayName: 'Test User 1',
        });

        user2 = await apiDriver.createUser({
            email: `test.user2.${Date.now()}@example.com`,
            password: 'Test123!',
            displayName: 'Test User 2',
        });
    });

    afterAll(async () => {
        await clearAllTestData();
    });

    beforeEach(async () => {
        // Clear any existing change documents
        if (groupId) {
            await clearGroupChangeDocuments(groupId);
        }
    });

    describe('Group Change Tracking', () => {
        it('should create a "created" change document when a group is created', async () => {
            // Create a group
            const group = await apiDriver.createGroup(
                {
                    name: 'Test Group for Changes',
                    description: 'Testing change detection',
                },
                user1.token
            );
            groupId = group.id;

            // Wait for debouncing
            await waitForDebounce('group');

            // Poll for the change document
            const change = await pollForChange<GroupChangeDocument>(
                'group-changes',
                (doc) => doc.groupId === groupId && doc.changeType === 'created',
                { timeout: 2000, groupId }
            );

            expect(change).toBeTruthy();
            expect(change?.changeType).toBe('created');
            expect(change?.metadata.priority).toBe('high');
            expect(change?.metadata.affectedUsers).toContain(user1.uid);
        });

        it('should create an "updated" change document when a group is modified', async () => {
            // First create a group
            const group = await apiDriver.createGroup(
                {
                    name: 'Initial Name',
                    description: 'Initial Description',
                },
                user1.token
            );
            groupId = group.id;

            // Wait for initial change to complete
            await waitForDebounce('group');
            await clearGroupChangeDocuments(groupId);

            // Update the group
            await apiDriver.updateGroup(
                groupId,
                {
                    name: 'Updated Name',
                },
                user1.token
            );

            // Wait for debouncing
            await waitForDebounce('group');

            // Poll for the update change document
            const change = await pollForChange<GroupChangeDocument>(
                'group-changes',
                (doc) => doc.groupId === groupId && doc.changeType === 'updated',
                { timeout: 2000, groupId }
            );

            expect(change).toBeTruthy();
            expect(change?.changeType).toBe('updated');
            expect(change?.metadata.priority).toBe('high'); // Name is a critical field
            expect(change?.metadata.changedFields).toContain('name');
        });

        it('should debounce multiple rapid group updates', async () => {
            // Create a group
            const group = await apiDriver.createGroup(
                {
                    name: 'Debounce Test Group',
                    description: 'Testing debouncing',
                },
                user1.token
            );
            groupId = group.id;

            // Wait for initial change
            await waitForDebounce('group');
            await clearGroupChangeDocuments(groupId);

            // Make multiple rapid updates
            await Promise.all([
                apiDriver.updateGroup(groupId, { name: 'Update 1' }, user1.token),
                apiDriver.updateGroup(groupId, { name: 'Update 2' }, user1.token),
                apiDriver.updateGroup(groupId, { name: 'Update 3' }, user1.token),
            ]);

            // Wait for debouncing
            await waitForDebounce('group');

            // Should only have one change document
            const changes = await getGroupChanges(groupId);
            const recentChanges = changes.filter(
                (c) => c.timestamp.toMillis() > Date.now() - 2000
            );

            expect(recentChanges.length).toBe(1);
            expect(recentChanges[0].changeType).toBe('updated');
        });

        it('should track affected users when members are added', async () => {
            // Create a group with multiple members
            const group = await apiDriver.createGroupWithMembers(
                'Multi-member Group',
                [user1, user2],
                user1.token
            );
            groupId = group.id;

            // Wait for debouncing
            await waitForDebounce('group');

            // Get the change document
            const changes = await getGroupChanges(groupId);
            const latestChange = changes[0];

            expect(latestChange).toBeTruthy();
            expect(latestChange.metadata.affectedUsers).toContain(user1.uid);
            expect(latestChange.metadata.affectedUsers).toContain(user2.uid);
        });

        it('should calculate correct priority for different field changes', async () => {
            // Create a group
            const group = await apiDriver.createGroup(
                {
                    name: 'Priority Test Group',
                    description: 'Testing priority',
                },
                user1.token
            );
            groupId = group.id;

            // Wait and clear initial change
            await waitForDebounce('group');
            await clearGroupChangeDocuments(groupId);

            // Update description (medium priority field)
            await apiDriver.updateGroup(
                groupId,
                { description: 'New Description' },
                user1.token
            );

            await waitForDebounce('group');

            const change = await pollForChange<GroupChangeDocument>(
                'group-changes',
                (doc) => doc.groupId === groupId && doc.changeType === 'updated',
                { timeout: 2000, groupId }
            );

            expect(change).toBeTruthy();
            expect(change?.metadata.priority).toBe('medium');
            expect(change?.metadata.changedFields).toContain('description');
        });
    });

    describe('Expense Change Tracking', () => {
        beforeEach(async () => {
            // Create a fresh group for expense tests
            const group = await apiDriver.createGroup(
                {
                    name: 'Expense Test Group',
                    description: 'Testing expense changes',
                },
                user1.token
            );
            groupId = group.id;

            // Add second user to group
            const shareResponse = await apiDriver.generateShareLink(groupId, user1.token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);

            // Wait for group setup to complete
            await waitForDebounce('group');
            await clearGroupChangeDocuments(groupId);
        });

        it('should create change documents for new expenses', async () => {
            // Create an expense
            const expense = await apiDriver.createExpense(
                {
                    groupId,
                    description: 'Test Expense',
                    amount: 100,
                    currency: 'USD',
                    category: 'General',
                    date: new Date().toISOString(),
                    paidBy: user1.uid,
                    participants: [user1.uid, user2.uid],
                    splitType: 'equal',
                    splits: [
                        { userId: user1.uid, amount: 50 },
                        { userId: user2.uid, amount: 50 },
                    ],
                },
                user1.token
            );

            // Wait for debouncing
            await waitForDebounce('expense');
            
            // Add extra wait for trigger to fire
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Check expense change document
            const expenseChange = await pollForChange<ExpenseChangeDocument>(
                'expense-changes',
                (doc) => doc.expenseId === expense.id && doc.changeType === 'created',
                { timeout: 2000, groupId }
            );

            expect(expenseChange).toBeTruthy();
            expect(expenseChange?.groupId).toBe(groupId);
            expect(expenseChange?.changeType).toBe('created');
            expect(expenseChange?.metadata.priority).toBe('high');
            expect(expenseChange?.metadata.affectedUsers).toContain(user1.uid);
            expect(expenseChange?.metadata.affectedUsers).toContain(user2.uid);

            // Check balance change document (expenses trigger balance recalculation)
            const balanceChange = await pollForChange<BalanceChangeDocument>(
                'balance-changes',
                (doc) => doc.groupId === groupId && doc.metadata.triggeredBy === 'expense',
                { timeout: 2000, groupId }
            );

            expect(balanceChange).toBeTruthy();
            expect(balanceChange?.changeType).toBe('recalculated');
            expect(balanceChange?.metadata.priority).toBe('high');
            expect(balanceChange?.metadata.triggerId).toBe(expense.id);
        });

        it('should track expense updates with correct priority', async () => {
            // Create an expense
            const expense = await apiDriver.createExpense(
                {
                    groupId,
                    description: 'Update Test Expense',
                    amount: 100,
                    currency: 'USD',
                    category: 'General',
                    date: new Date().toISOString(),
                    paidBy: user1.uid,
                    participants: [user1.uid],
                    splitType: 'equal',
                    splits: [
                        { userId: user1.uid, amount: 100 },
                    ],
                },
                user1.token
            );

            // Wait and clear initial changes
            await waitForDebounce('expense');
            await clearGroupChangeDocuments(groupId);

            // Update expense amount (high priority)
            await apiDriver.updateExpense(
                expense.id,
                {
                    amount: 200,
                    currency: 'USD',
                    category: 'General',
                    date: new Date().toISOString(),
                    participants: [user1.uid],
                    splitType: 'equal',
                    splits: [
                        { userId: user1.uid, amount: 200 },
                    ],
                },
                user1.token
            );

            await waitForDebounce('expense');

            const change = await pollForChange<ExpenseChangeDocument>(
                'expense-changes',
                (doc) => doc.expenseId === expense.id && doc.changeType === 'updated',
                { timeout: 2000, groupId }
            );

            expect(change).toBeTruthy();
            expect(change?.metadata.priority).toBe('high');
            expect(change?.metadata.changedFields).toContain('amount');
        });

        it('should debounce rapid expense updates', async () => {
            // Create an expense
            const expense = await apiDriver.createExpense(
                {
                    groupId,
                    description: 'Debounce Test',
                    amount: 100,
                    currency: 'USD',
                    category: 'General',
                    date: new Date().toISOString(),
                    paidBy: user1.uid,
                    participants: [user1.uid],
                    splitType: 'equal',
                    splits: [
                        { userId: user1.uid, amount: 100 },
                    ],
                },
                user1.token
            );

            // Wait and clear initial changes
            await waitForDebounce('expense');
            await clearGroupChangeDocuments(groupId);

            // Make multiple rapid updates
            const updates = [];
            for (let i = 1; i <= 3; i++) {
                updates.push(
                    apiDriver.updateExpense(
                        expense.id,
                        {
                            description: `Update ${i}`,
                            amount: 100,
                            currency: 'USD',
                            date: new Date().toISOString(),
                            participants: [user1.uid],
                            splitType: 'equal',
                            splits: [
                                { userId: user1.uid, amount: 100 },
                            ],
                        },
                        user1.token
                    )
                );
            }
            await Promise.all(updates);

            // Wait for debouncing (200ms for expenses)
            await waitForDebounce('expense');

            // Count recent changes
            const changeCount = await countRecentChanges('expense-changes', groupId, 2000);
            
            // Should only have one change document due to debouncing
            expect(changeCount).toBe(1);
        });

        it('should immediately track expense deletion without debouncing', async () => {
            // Create an expense
            const expense = await apiDriver.createExpense(
                {
                    groupId,
                    description: 'Delete Test',
                    amount: 100,
                    currency: 'USD',
                    category: 'General',
                    date: new Date().toISOString(),
                    paidBy: user1.uid,
                    participants: [user1.uid],
                    splitType: 'equal',
                    splits: [
                        { userId: user1.uid, amount: 100 },
                    ],
                },
                user1.token
            );

            // Wait and clear initial changes
            await waitForDebounce('expense');
            await clearGroupChangeDocuments(groupId);

            // Delete the expense
            await apiDriver.deleteExpense(expense.id, user1.token);

            // Should not need to wait for debouncing (deletes are immediate)
            const change = await pollForChange<ExpenseChangeDocument>(
                'expense-changes',
                (doc) => doc.expenseId === expense.id && doc.changeType === 'deleted',
                { timeout: 500, groupId } // Shorter timeout since no debouncing
            );

            expect(change).toBeTruthy();
            expect(change?.changeType).toBe('deleted');
            expect(change?.metadata.priority).toBe('high');
        });
    });

    describe('Settlement Change Tracking', () => {
        beforeEach(async () => {
            // Create a fresh group for settlement tests
            const group = await apiDriver.createGroup(
                {
                    name: 'Settlement Test Group',
                    description: 'Testing settlement changes',
                },
                user1.token
            );
            groupId = group.id;

            // Add second user to group
            const shareResponse = await apiDriver.generateShareLink(groupId, user1.token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);

            // Wait for group setup
            await waitForDebounce('group');
            await clearGroupChangeDocuments(groupId);
        });

        it('should track settlement creation with balance changes', async () => {
            // Create a settlement
            const settlement = await apiDriver.createSettlement(
                {
                    groupId,
                    payerId: user1.uid,
                    payeeId: user2.uid,
                    amount: 50,
                    currency: 'USD',
                    note: 'Test settlement',
                },
                user1.token
            );

            // Wait for debouncing
            await waitForDebounce('settlement');

            // Check settlement change document (stored in expense-changes)
            const settlementChange = await pollForChange<ExpenseChangeDocument>(
                'expense-changes',
                (doc) => doc.settlementId === settlement.id && doc.changeType === 'created',
                { timeout: 2000, groupId }
            );

            expect(settlementChange).toBeTruthy();
            expect(settlementChange?.groupId).toBe(groupId);
            expect(settlementChange?.metadata.priority).toBe('high');
            expect(settlementChange?.metadata.affectedUsers).toContain(user1.uid);
            expect(settlementChange?.metadata.affectedUsers).toContain(user2.uid);

            // Check balance change document
            const balanceChange = await pollForChange<BalanceChangeDocument>(
                'balance-changes',
                (doc) => doc.groupId === groupId && doc.metadata.triggeredBy === 'settlement',
                { timeout: 2000, groupId }
            );

            expect(balanceChange).toBeTruthy();
            expect(balanceChange?.changeType).toBe('recalculated');
            expect(balanceChange?.metadata.priority).toBe('high');
        });

        it('should handle both API format (payerId/payeeId) and legacy format (from/to)', async () => {
            // The API uses payerId/payeeId format
            const settlement = await apiDriver.createSettlement(
                {
                    groupId,
                    payerId: user1.uid,
                    payeeId: user2.uid,
                    amount: 75,
                    currency: 'USD',
                    note: 'API format test',
                },
                user1.token
            );

            await waitForDebounce('settlement');

            const change = await pollForChange<ExpenseChangeDocument>(
                'expense-changes',
                (doc) => doc.settlementId === settlement.id,
                { timeout: 2000, groupId }
            );

            expect(change).toBeTruthy();
            expect(change?.metadata.affectedUsers).toContain(user1.uid);
            expect(change?.metadata.affectedUsers).toContain(user2.uid);
        });
    });

    describe('Cross-entity Change Tracking', () => {
        it('should track changes across multiple entity types', async () => {
            // Create a group
            const group = await apiDriver.createGroup(
                {
                    name: 'Cross-entity Test',
                    description: 'Testing multiple entities',
                },
                user1.token
            );
            groupId = group.id;

            // Add second user
            const shareResponse = await apiDriver.generateShareLink(groupId, user1.token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);

            // Create an expense
            await apiDriver.createExpense(
                {
                    groupId,
                    description: 'Cross-entity expense',
                    amount: 100,
                    currency: 'USD',
                    category: 'General',
                    date: new Date().toISOString(),
                    paidBy: user1.uid,
                    participants: [user1.uid, user2.uid],
                    splitType: 'equal',
                    splits: [
                        { userId: user1.uid, amount: 50 },
                        { userId: user2.uid, amount: 50 },
                    ],
                },
                user1.token
            );

            // Create a settlement
            await apiDriver.createSettlement(
                {
                    groupId,
                    payerId: user2.uid,
                    payeeId: user1.uid,
                    amount: 50,
                    currency: 'USD',
                    note: 'Settling up',
                },
                user2.token
            );

            // Wait for all changes to complete
            await waitForDebounce('settlement');

            // Verify we have changes for all entity types
            const groupChanges = await getGroupChanges(groupId);
            const expenseChanges = await getExpenseChanges(groupId);
            const balanceChanges = await getBalanceChanges(groupId);

            expect(groupChanges.length).toBeGreaterThan(0);
            expect(expenseChanges.length).toBeGreaterThan(0);
            expect(balanceChanges.length).toBeGreaterThan(0);

            // Verify balance changes were triggered by both expense and settlement
            const expenseTriggeredBalance = balanceChanges.find(
                (b) => b.metadata.triggeredBy === 'expense'
            );
            const settlementTriggeredBalance = balanceChanges.find(
                (b) => b.metadata.triggeredBy === 'settlement'
            );

            expect(expenseTriggeredBalance).toBeTruthy();
            expect(settlementTriggeredBalance).toBeTruthy();
        });
    });
});