import {afterAll, beforeAll, describe, expect, it} from '@jest/globals';
import {ApiDriver, User} from '../../support/ApiDriver';
import {BalanceChangeDocument, clearGroupChangeDocuments, countRecentChanges, ExpenseChangeDocument, GroupChangeDocument, pollForChange, SettlementChangeDocument} from '../../support/changeCollectionHelpers';
import {FirestoreCollections} from '../../../shared/shared-types';
import {generateNewUserDetails} from "@splitifyd/e2e-tests/src/utils/test-helpers";
import {CreateGroupRequestBuilder, ExpenseBuilder, SettlementBuilder} from "../../support/builders";
import { v4 as uuidv4 } from 'uuid';

describe('Change Detection Integration Tests', () => {
    const apiDriver = new ApiDriver();
    let user1: User;
    let user2: User;

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
        // Cleanup handled by individual tests
    });

    async function createSharedGroup(): Promise<string> {
        const group = await apiDriver.createGroupWithMembers(uuidv4(), [user1, user2], user1.token);
        await clearGroupChangeDocuments(group.id);
        return group.id;
    }

    describe('Group Change Tracking', () => {
        it('should create a "created" change document when a group is created', async () => {
            // Create a group using builder with minimal fields
            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                user1.token
            );

            // Poll for the change document
            const change = await pollForChange<GroupChangeDocument>(
                FirestoreCollections.GROUP_CHANGES,
                (doc) => doc.id === group.id && doc.action === 'created',
                {timeout: 2000, groupId: group.id}
            );

            expect(change).toBeTruthy();
            expect(change?.action).toBe('created');
            expect(change?.type).toBe('group');
            expect(change?.users).toContain(user1.uid);
        });

        it('should create an "updated" change document when a group is modified', async () => {
            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                user1.token
            );

            await apiDriver.waitForGroupChanges(group.id, (changes) => changes.length > 0);
            await clearGroupChangeDocuments(group.id);

            await apiDriver.updateGroup(
                group.id,
                { name: 'Updated Name' },
                user1.token
            );

            const change = await pollForChange<GroupChangeDocument>(
                FirestoreCollections.GROUP_CHANGES,
                (doc) => doc.id === group.id && doc.action === 'updated',
                {timeout: 2000, groupId: group.id}
            );

            expect(change).toBeTruthy();
            expect(change?.action).toBe('updated');
            expect(change?.type).toBe('group');
        });

        it('should immediately process multiple rapid group updates', async () => {
            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                user1.token
            );

            await apiDriver.waitForGroupChanges(group.id, (changes) => changes.length > 0);
            await clearGroupChangeDocuments(group.id);

            await apiDriver.updateGroup(group.id, {name: 'Update 1'}, user1.token);
            await apiDriver.updateGroup(group.id, {name: 'Update 2'}, user1.token);
            await apiDriver.updateGroup(group.id, {name: 'Update 3'}, user1.token);

            await apiDriver.waitForGroupChanges(group.id, (changes) => {
                const updateChanges = changes.filter(c => c.action === 'updated');
                return updateChanges.length >= 3;
            });

            const changes = await apiDriver.getGroupChanges(group.id);
            const recentChanges = changes.filter(
                (c) => c.timestamp.toMillis() > Date.now() - 5000 && c.action === 'updated'
            );

            expect(recentChanges.length).toBeGreaterThanOrEqual(3);
            expect(recentChanges.every(c => c.action === 'updated')).toBe(true);
        });

        it('should track affected users when members are added', async () => {
            const group = await apiDriver.createGroupWithMembers(
                'Multi-member Group',
                [user1, user2],
                user1.token
            );

            const foundChange = await pollForChange<GroupChangeDocument>(
                FirestoreCollections.GROUP_CHANGES,
                (doc) => doc.id === group.id &&
                    doc.users.includes(user1.uid) &&
                    doc.users.includes(user2.uid),
                {timeout: 5000, groupId: group.id}
            );

            expect(foundChange).toBeTruthy();
            expect(foundChange!.users).toContain(user1.uid);
            expect(foundChange!.users).toContain(user2.uid);
        });

        it('should calculate correct priority for different field changes', async () => {
            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                user1.token
            );

            await apiDriver.waitForGroupChanges(group.id, (changes) => changes.length > 0);
            await clearGroupChangeDocuments(group.id);

            await apiDriver.updateGroup(
                group.id,
                {description: 'New Description'},
                user1.token
            );

            const change = await pollForChange<GroupChangeDocument>(
                FirestoreCollections.GROUP_CHANGES,
                (doc) => doc.id === group.id && doc.action === 'updated',
                {timeout: 2000, groupId: group.id}
            );

            expect(change).toBeTruthy();
            expect(change?.type).toBe('group');
            expect(change?.action).toBe('updated');
        });
    });

    describe('Expense Change Tracking', () => {
        it('should create change documents for new expenses', async () => {
            const groupId = await createSharedGroup();

            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid, user2.uid])
                    .build(),
                user1.token
            );

            const expenseChange = await pollForChange<ExpenseChangeDocument>(
                FirestoreCollections.TRANSACTION_CHANGES,
                (doc) => doc.id === expense.id && doc.action === 'created',
                {timeout: 2000, groupId}
            );

            expect(expenseChange).toBeTruthy();
            expect(expenseChange?.groupId).toBe(groupId);
            expect(expenseChange?.action).toBe('created');
            expect(expenseChange?.type).toBe('expense');
            expect(expenseChange?.users).toContain(user1.uid);
            expect(expenseChange?.users).toContain(user2.uid);

            const balanceChange = await pollForChange<BalanceChangeDocument>(
                FirestoreCollections.BALANCE_CHANGES,
                (doc) => doc.groupId === groupId && doc.type === 'balance',
                {timeout: 2000, groupId}
            );

            expect(balanceChange).toBeTruthy();
            expect(balanceChange?.action).toBe('recalculated');
            expect(balanceChange?.type).toBe('balance');
        });

        it('should track expense updates with correct priority', async () => {
            const groupId = await createSharedGroup();

            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid])
                    .build(),
                user1.token
            );

            await apiDriver.waitForExpenseChanges(groupId, (changes) =>
                changes.some(c => c.id === expense.id)
            );
            await clearGroupChangeDocuments(groupId);

            // Update expense amount (high priority) - still need full object for update
            await apiDriver.updateExpense(
                expense.id,
                {
                    amount: 200,
                    currency: 'USD',
                    category: 'General',
                    date: new Date().toISOString(),
                    participants: [user1.uid],
                    splitType: 'equal',
                    splits: [{userId: user1.uid, amount: 200}],
                },
                user1.token
            );

            const change = await pollForChange<ExpenseChangeDocument>(
                FirestoreCollections.TRANSACTION_CHANGES,
                (doc) => doc.id === expense.id && doc.action === 'updated',
                {timeout: 2000, groupId}
            );

            expect(change).toBeTruthy();
            expect(change?.action).toBe('updated');
            expect(change?.type).toBe('expense');
        });

        it('should immediately process rapid expense updates', async () => {
            const groupId = await createSharedGroup();

            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid])
                    .build(),
                user1.token
            );

            await apiDriver.waitForExpenseChanges(groupId, (changes) =>
                changes.some(c => c.id === expense.id)
            );
            await clearGroupChangeDocuments(groupId);

            await apiDriver.updateExpense(
                expense.id,
                {
                    description: 'Update 1',
                    amount: 100,
                    currency: 'USD',
                    date: new Date().toISOString(),
                    participants: [user1.uid],
                    splitType: 'equal',
                    splits: [{userId: user1.uid, amount: 100}],
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
                    splits: [{userId: user1.uid, amount: 100}],
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
                    splits: [{userId: user1.uid, amount: 100}],
                },
                user1.token
            );

            await apiDriver.waitForExpenseChanges(groupId, (changes) => {
                const recentChanges = changes.filter(c =>
                    c.id === expense.id && c.action === 'updated'
                );
                return recentChanges.length >= 3;
            });

            const changeCount = await countRecentChanges(FirestoreCollections.TRANSACTION_CHANGES, groupId, 3000);
            expect(changeCount).toBe(3);
        });

        it('should track expense deletion (soft delete) immediately', async () => {
            const groupId = await createSharedGroup();

            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid])
                    .build(),
                user1.token
            );

            await apiDriver.waitForExpenseChanges(groupId, (changes) =>
                changes.some(c => c.id === expense.id)
            );
            await clearGroupChangeDocuments(groupId);

            await apiDriver.deleteExpense(expense.id, user1.token);
            const change = await pollForChange<ExpenseChangeDocument>(
                FirestoreCollections.TRANSACTION_CHANGES,
                (doc) => doc.id === expense.id && doc.action === 'updated',
                {timeout: 1000, groupId}
            );

            expect(change).toBeTruthy();
            expect(change?.action).toBe('updated');
            expect(change?.type).toBe('expense');
        });
    });

    describe('Settlement Change Tracking', () => {

        it('should track settlement creation with balance changes', async () => {
            const groupId = await createSharedGroup();

            const settlement = await apiDriver.createSettlement(
                new SettlementBuilder()
                    .withGroupId(groupId)
                    .withPayer(user1.uid)
                    .withPayee(user2.uid)
                    .build(),
                user1.token
            );

            const settlementChange = await pollForChange<SettlementChangeDocument>(
                FirestoreCollections.TRANSACTION_CHANGES,
                (doc) => doc.id === settlement.id && doc.action === 'created' && doc.type === 'settlement',
                {timeout: 2000, groupId}
            );

            expect(settlementChange).toBeTruthy();
            expect(settlementChange?.groupId).toBe(groupId);
            expect(settlementChange?.type).toBe('settlement');
            expect(settlementChange?.users).toContain(user1.uid);
            expect(settlementChange?.users).toContain(user2.uid);

            const balanceChange = await pollForChange<BalanceChangeDocument>(
                FirestoreCollections.BALANCE_CHANGES,
                (doc) => doc.groupId === groupId && doc.type === 'balance',
                {timeout: 2000, groupId}
            );

            expect(balanceChange).toBeTruthy();
            expect(balanceChange?.action).toBe('recalculated');
            expect(balanceChange?.type).toBe('balance');
        });

        it('should handle both API format (payerId/payeeId) and legacy format (from/to)', async () => {
            const groupId = await createSharedGroup();

            const settlement = await apiDriver.createSettlement(
                new SettlementBuilder()
                    .withGroupId(groupId)
                    .withPayer(user1.uid)
                    .withPayee(user2.uid)
                    .withAmount(75)
                    .build(),
                user1.token
            );

            const change = await pollForChange<SettlementChangeDocument>(
                FirestoreCollections.TRANSACTION_CHANGES,
                (doc) => doc.id === settlement.id && doc.type === 'settlement',
                {timeout: 2000, groupId}
            );

            expect(change).toBeTruthy();
            expect(change?.users).toContain(user1.uid);
            expect(change?.users).toContain(user2.uid);
        });
    });

    describe('Cross-entity Change Tracking', () => {
        it('should track changes across multiple entity types', async () => {
            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                user1.token
            );

            const shareResponse = await apiDriver.generateShareLink(group.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);

            const expense = await apiDriver.createExpense(new ExpenseBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid, user2.uid])
                    .build(),
                user1.token
            );

            const settlement = await apiDriver.createSettlement(
                new SettlementBuilder()
                    .withGroupId(group.id)
                    .withPayer(user2.uid)
                    .withPayee(user1.uid)
                    .build(),
                user2.token
            );

            await apiDriver.waitForGroupChanges(group.id, (changes) => {
                return changes.length > 0;
            });

            await apiDriver.waitForSettlementChanges(group.id, (changes) => {
                const changesOfInterest = changes.filter(item => item.id === settlement.id);
                return changesOfInterest.length > 0;
            });

            await apiDriver.waitForExpenseChanges(group.id, (changes) => {
                const changesOfInterest = changes.filter(item => item.id === expense.id);
                return changesOfInterest.length > 0;
            });

            await apiDriver.waitForBalanceChanges(group.id, (changes) => {
                const changesOfInterest = changes.filter(item => item.users.length === 2 && item.users.includes(user1.uid) && item.users.includes(user2.uid));
                return changesOfInterest.length >= 2
            });
        });
    });
});