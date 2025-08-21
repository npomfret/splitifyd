import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ApiDriver, User } from '../../support/ApiDriver';
import {
    pollForChange,
    getGroupChanges,
    getExpenseChanges,
    getBalanceChanges,
    clearGroupChangeDocuments,
    waitForTriggerProcessing,
    countRecentChanges,
    GroupChangeDocument,
    ExpenseChangeDocument,
    SettlementChangeDocument,
    BalanceChangeDocument,
} from '../../support/changeCollectionHelpers';
import { FirestoreCollections } from '../../../shared/shared-types';
import {generateNewUserDetails} from "@splitifyd/e2e-tests/src/utils/test-helpers";

describe('Change Detection Integration Tests', () => {
    const apiDriver = new ApiDriver();
    let user1: User;
    let user2: User;
    let groupId: string;

    beforeAll(async () => {
        // Create test users
        const [u1, u2] = await Promise.all([
            apiDriver.createUser(generateNewUserDetails()),
            apiDriver.createUser(generateNewUserDetails())
        ])
        user1 = u1;
        user2 = u2;
    });

    afterAll(async () => {
        // await clearAllTestData();
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

            // Wait for trigger processing
            await waitForTriggerProcessing('group');

            // Poll for the change document
            const change = await pollForChange<GroupChangeDocument>(
                FirestoreCollections.GROUP_CHANGES,
                (doc) => doc.id === groupId && doc.action === 'created',
                { timeout: 2000, groupId }
            );

            expect(change).toBeTruthy();
            expect(change?.action).toBe('created');
            expect(change?.type).toBe('group');
            expect(change?.users).toContain(user1.uid);
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
            await waitForTriggerProcessing('group');
            await clearGroupChangeDocuments(groupId);

            // Update the group
            await apiDriver.updateGroup(
                groupId,
                {
                    name: 'Updated Name',
                },
                user1.token
            );

            // Wait for trigger processing
            await waitForTriggerProcessing('group');

            // Poll for the update change document
            const change = await pollForChange<GroupChangeDocument>(
                FirestoreCollections.GROUP_CHANGES,
                (doc) => doc.id === groupId && doc.action === 'updated',
                { timeout: 2000, groupId }
            );

            expect(change).toBeTruthy();
            expect(change?.action).toBe('updated');
            expect(change?.type).toBe('group');
        });

        it('should immediately process multiple rapid group updates', async () => {
            // Create a group
            const group = await apiDriver.createGroup(
                {
                    name: 'Immediate Processing Test Group',
                    description: 'Testing immediate processing',
                },
                user1.token
            );
            groupId = group.id;

            // Wait for initial change
            await waitForTriggerProcessing('group');
            await clearGroupChangeDocuments(groupId);

            // Make multiple sequential updates (more realistic than concurrent)
            await apiDriver.updateGroup(groupId, { name: 'Update 1' }, user1.token);
            await apiDriver.updateGroup(groupId, { name: 'Update 2' }, user1.token);
            await apiDriver.updateGroup(groupId, { name: 'Update 3' }, user1.token);

            // Wait briefly for all changes to be processed
            await waitForTriggerProcessing('group');

            // Should have multiple change documents (one for each update)
            const changes = await getGroupChanges(groupId);
            const recentChanges = changes.filter(
                (c) => c.timestamp.toMillis() > Date.now() - 3000
            );

            expect(recentChanges.length).toBe(3); // Each sequential update creates change document
            expect(recentChanges.every(c => c.action === 'updated')).toBe(true);
        });

        it('should track affected users when members are added', async () => {
            // Create a group with multiple members
            const group = await apiDriver.createGroupWithMembers(
                'Multi-member Group',
                [user1, user2],
                user1.token
            );
            groupId = group.id;

            // Poll for change document that includes both users
            // createGroupWithMembers: 1) creates group (user1), 2) user2 joins via share link
            // We need the final change document after user2 joins
            const foundChange = await pollForChange<GroupChangeDocument>(
                FirestoreCollections.GROUP_CHANGES,
                (doc) => doc.id === groupId && 
                         doc.users.includes(user1.uid) && 
                         doc.users.includes(user2.uid),
                { timeout: 5000, groupId }
            );
            
            expect(foundChange).toBeTruthy();
            expect(foundChange!.users).toContain(user1.uid);
            expect(foundChange!.users).toContain(user2.uid);
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
            await waitForTriggerProcessing('group');
            await clearGroupChangeDocuments(groupId);

            // Update description (medium priority field)
            await apiDriver.updateGroup(
                groupId,
                { description: 'New Description' },
                user1.token
            );

            await waitForTriggerProcessing('group');

            const change = await pollForChange<GroupChangeDocument>(
                FirestoreCollections.GROUP_CHANGES,
                (doc) => doc.id === groupId && doc.action === 'updated',
                { timeout: 2000, groupId }
            );

            expect(change).toBeTruthy();
            expect(change?.type).toBe('group');
            expect(change?.action).toBe('updated');
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
            await waitForTriggerProcessing('group');
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

            // Wait for trigger processing
            await waitForTriggerProcessing('expense');
            
            // Add extra wait for trigger to fire
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Check expense change document
            const expenseChange = await pollForChange<ExpenseChangeDocument>(
                FirestoreCollections.TRANSACTION_CHANGES,
                (doc) => doc.id === expense.id && doc.action === 'created',
                { timeout: 2000, groupId }
            );

            expect(expenseChange).toBeTruthy();
            expect(expenseChange?.groupId).toBe(groupId);
            expect(expenseChange?.action).toBe('created');
            expect(expenseChange?.type).toBe('expense');
            expect(expenseChange?.users).toContain(user1.uid);
            expect(expenseChange?.users).toContain(user2.uid);

            // Check balance change document (expenses trigger balance recalculation)
            const balanceChange = await pollForChange<BalanceChangeDocument>(
                FirestoreCollections.BALANCE_CHANGES,
                (doc) => doc.groupId === groupId && doc.type === 'balance',
                { timeout: 2000, groupId }
            );

            expect(balanceChange).toBeTruthy();
            expect(balanceChange?.action).toBe('recalculated');
            expect(balanceChange?.type).toBe('balance');
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
            await waitForTriggerProcessing('expense');
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

            await waitForTriggerProcessing('expense');

            const change = await pollForChange<ExpenseChangeDocument>(
                FirestoreCollections.TRANSACTION_CHANGES,
                (doc) => doc.id === expense.id && doc.action === 'updated',
                { timeout: 2000, groupId }
            );

            expect(change).toBeTruthy();
            expect(change?.action).toBe('updated');
            expect(change?.type).toBe('expense');
        });

        it('should immediately process rapid expense updates', async () => {
            // Create an expense
            const expense = await apiDriver.createExpense(
                {
                    groupId,
                    description: 'Immediate Processing Test',
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
            await waitForTriggerProcessing('expense');
            await clearGroupChangeDocuments(groupId);

            // Make multiple sequential updates (more realistic than concurrent)
            await apiDriver.updateExpense(
                expense.id,
                {
                    description: 'Update 1',
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
            );
            await apiDriver.updateExpense(
                expense.id,
                {
                    description: 'Update 2',
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
            );
            await apiDriver.updateExpense(
                expense.id,
                {
                    description: 'Update 3',
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
            );

            // Wait briefly for all changes to be processed
            await waitForTriggerProcessing('expense');

            // Count recent changes
            const changeCount = await countRecentChanges(FirestoreCollections.TRANSACTION_CHANGES, groupId, 3000);
            
            // Should have multiple change documents (one for each sequential update)
            expect(changeCount).toBe(3);
        });

        it('should track expense deletion (soft delete) immediately', async () => {
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
            await waitForTriggerProcessing('expense');
            await clearGroupChangeDocuments(groupId);

            // Delete the expense (soft delete - adds deletedAt field)
            await apiDriver.deleteExpense(expense.id, user1.token);

            // Wait for trigger processing  
            await waitForTriggerProcessing('expense');

            // Look for the soft delete change (shows as updated)
            const change = await pollForChange<ExpenseChangeDocument>(
                FirestoreCollections.TRANSACTION_CHANGES,
                (doc) => doc.id === expense.id && doc.action === 'updated',
                { timeout: 1000, groupId }
            );

            expect(change).toBeTruthy();
            expect(change?.action).toBe('updated');
            expect(change?.type).toBe('expense');
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
            await waitForTriggerProcessing('group');
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
            await waitForTriggerProcessing('settlement');

            // Check settlement change document (stored in transaction-changes)
            const settlementChange = await pollForChange<SettlementChangeDocument>(
                FirestoreCollections.TRANSACTION_CHANGES,
                (doc) => doc.id === settlement.id && doc.action === 'created' && doc.type === 'settlement',
                { timeout: 2000, groupId }
            );

            expect(settlementChange).toBeTruthy();
            expect(settlementChange?.groupId).toBe(groupId);
            expect(settlementChange?.type).toBe('settlement');
            expect(settlementChange?.users).toContain(user1.uid);
            expect(settlementChange?.users).toContain(user2.uid);

            // Check balance change document
            const balanceChange = await pollForChange<BalanceChangeDocument>(
                FirestoreCollections.BALANCE_CHANGES,
                (doc) => doc.groupId === groupId && doc.type === 'balance',
                { timeout: 2000, groupId }
            );

            expect(balanceChange).toBeTruthy();
            expect(balanceChange?.action).toBe('recalculated');
            expect(balanceChange?.type).toBe('balance');
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

            await waitForTriggerProcessing('settlement');

            const change = await pollForChange<SettlementChangeDocument>(
                FirestoreCollections.TRANSACTION_CHANGES,
                (doc) => doc.id === settlement.id && doc.type === 'settlement',
                { timeout: 2000, groupId }
            );

            expect(change).toBeTruthy();
            expect(change?.users).toContain(user1.uid);
            expect(change?.users).toContain(user2.uid);
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
            await waitForTriggerProcessing('settlement');

            // Verify we have changes for all entity types
            const groupChanges = await getGroupChanges(groupId);
            const expenseChanges = await getExpenseChanges(groupId);
            const balanceChanges = await getBalanceChanges(groupId);

            expect(groupChanges.length).toBeGreaterThan(0);
            expect(expenseChanges.length).toBeGreaterThan(0);
            expect(balanceChanges.length).toBeGreaterThan(0);

            // Verify we have multiple balance changes (one for expense, one for settlement)
            expect(balanceChanges.length).toBeGreaterThanOrEqual(2);
        });
    });
});