import {beforeAll, describe, expect, it} from '@jest/globals';
import {ApiDriver, User} from '../../support/ApiDriver';
import {BalanceChangeDocument, clearGroupChangeDocuments, pollForChange, SettlementChangeDocument} from '../../support/changeCollectionHelpers';
import {FirestoreCollections} from '../../../shared/shared-types';
import {generateNewUserDetails} from "@splitifyd/e2e-tests/src/utils/test-helpers";
import {CreateGroupRequestBuilder, ExpenseBuilder, SettlementBuilder} from "../../support/builders";
import {v4 as uuidv4} from 'uuid';

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

    /**
     * @deprecated use apiDriver.createGroupWithMembers
     */
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

            // step 1 - find the expected events
            await apiDriver.waitForGroupCreationEvent(group.id, user1);

            // step 2 - make sure there are no extra / unplanned events
            expect(await apiDriver.countGroupChanges(group.id)).toBe(1);
        });

        it('should create a "update" change document when a share link is created', async () => {
            // Create a group using builder with minimal fields
            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                user1.token
            );
            await apiDriver.generateShareLink(group.id, user1.token);

            // step 1 - find the expected events
            await apiDriver.waitForGroupCreationEvent(group.id, user1);
            await apiDriver.waitForGroupUpdatedEvent(group.id, user1);

            // step 2 - make sure there are no extra / unplanned events
            expect(await apiDriver.countGroupChanges(group.id)).toBe(2);
        });

        it('should create an "updated" change document when a group is modified', async () => {
            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                user1.token
            );

            await apiDriver.updateGroup(group.id, { name: 'Updated Name' }, user1.token);

            // step 1 - find the expected events
            await apiDriver.waitForGroupCreationEvent(group.id, user1);
            await apiDriver.waitForGroupUpdatedEvent(group.id, user1);

            // step 2 - make sure there are no extra / unplanned events
            expect(await apiDriver.countGroupChanges(group.id)).toBe(2);
        });

        it('should immediately process multiple rapid group updates', async () => {
            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                user1.token
            );

            await apiDriver.updateGroup(group.id, {name: 'Update 1'}, user1.token);
            await apiDriver.updateGroup(group.id, {name: 'Update 2'}, user1.token);
            await apiDriver.updateGroup(group.id, {name: 'Update 3'}, user1.token);

            // step 1 - find the expected events
            await apiDriver.waitForGroupCreationEvent(group.id, user1);
            await apiDriver.waitForGroupUpdatedEvent(group.id, user1, 3);

            // step 2 - make sure there are no extra / unplanned events
            expect(await apiDriver.countGroupChanges(group.id)).toBe(4);
        });

        it('should track affected users when members are added', async () => {
            const group = await apiDriver.createGroupWithMembers(
                'Multi-member Group',
                [user1, user2],
                user1.token
            );

            // step 1 - find the expected events
            await apiDriver.waitForGroupCreationEvent(group.id, user1);
            await apiDriver.waitForGroupUpdatedEvent(group.id, user1, 2);// share link generation + user joining

            // step 2 - make sure there are no extra / unplanned events
            expect(await apiDriver.countGroupChanges(group.id)).toBe(3);

            // step 3 - check the affected users
            const lastUpdate = await apiDriver.mostRecentGroupChangeEvent(group);

            expect(lastUpdate).toBeTruthy();
            expect(lastUpdate!.users).toContain(user1.uid);
            expect(lastUpdate!.users).toContain(user2.uid);
            expect(Object.keys(lastUpdate!.users).length).toBe(2);
        });

    });

    describe('Expense Change Tracking', () => {
        it('should create change documents for new expenses', async () => {
            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                user1.token
            );

            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid])
                    .build(),
                user1.token
            );

            // step 1 - find the expected events
            await apiDriver.waitForExpenseCreationEvent(group.id, expense.id, [user1]);
            await apiDriver.waitForBalanceRecalculationEvent(group.id, [user1]);

            // step 2 - make sure there are no extra / unplanned events
            expect(await apiDriver.countExpenseChanges(group.id)).toBe(1);
            expect(await apiDriver.countBalanceChanges(group.id)).toBe(1);

            // step 3 - check the details of the most recent change
            const lastExpenseChange = await apiDriver.mostRecentExpenseChangeEvent(group.id);
            expect(lastExpenseChange).toBeTruthy();
            expect(lastExpenseChange?.groupId).toBe(group.id);
            expect(lastExpenseChange?.action).toBe('created');
            expect(lastExpenseChange?.type).toBe('expense');
            expect(lastExpenseChange?.users).toContain(user1.uid);
        });

        it('should track multi-user expenses with correct participants', async () => {
            const group = await apiDriver.createGroupWithMembers(
                'Multi-user Expense Group',
                [user1, user2],
                user1.token
            );

            // Wait for group creation events to settle
            await apiDriver.waitForGroupCreationEvent(group.id, user1);

            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid, user2.uid])
                    .build(),
                user1.token
            );

            // step 1 - find the expected events
            await apiDriver.waitForExpenseCreationEvent(group.id, expense.id, [user1, user2]);
            await apiDriver.waitForBalanceRecalculationEvent(group.id, [user1, user2]);

            // step 2 - make sure there are no extra / unplanned events
            expect(await apiDriver.countExpenseChanges(group.id)).toBe(1);
            expect(await apiDriver.countBalanceChanges(group.id)).toBe(1);

            // step 3 - check the details include both users
            const lastExpenseChange = await apiDriver.mostRecentExpenseChangeEvent(group.id);
            expect(lastExpenseChange).toBeTruthy();
            expect(lastExpenseChange?.users).toContain(user1.uid);
            expect(lastExpenseChange?.users).toContain(user2.uid);
        });

        it('should track expense updates', async () => {
            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                user1.token
            );

            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid])
                    .build(),
                user1.token
            );

            // Update expense amount
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

            // step 1 - find the expected events
            await apiDriver.waitForExpenseCreationEvent(group.id, expense.id, [user1]);
            await apiDriver.waitForExpenseUpdatedEvent(group.id, expense.id, [user1]);
            await apiDriver.waitForBalanceRecalculationEvent(group.id, [user1], 2); // one for create, one for update

            // step 2 - make sure there are no extra / unplanned events
            expect(await apiDriver.countExpenseChanges(group.id)).toBe(2); // created + updated
            expect(await apiDriver.countBalanceChanges(group.id)).toBe(2);

            // step 3 - check the most recent change is the update
            const lastChange = await apiDriver.mostRecentExpenseChangeEvent(group.id);
            expect(lastChange).toBeTruthy();
            expect(lastChange?.action).toBe('updated');
            expect(lastChange?.type).toBe('expense');
        });

        it('should immediately process rapid expense updates', async () => {
            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                user1.token
            );

            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid])
                    .build(),
                user1.token
            );

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

            // step 1 - find the expected events
            await apiDriver.waitForExpenseCreationEvent(group.id, expense.id, [user1]);
            await apiDriver.waitForExpenseUpdatedEvent(group.id, expense.id, [user1], 3);
            await apiDriver.waitForBalanceRecalculationEvent(group.id, [user1], 4); // 1 create + 3 updates

            // step 2 - make sure there are no extra / unplanned events
            expect(await apiDriver.countExpenseChanges(group.id)).toBe(4); // 1 created + 3 updated
            expect(await apiDriver.countBalanceChanges(group.id)).toBe(4);
        });

        it('should track expense deletion (soft delete) immediately', async () => {
            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                user1.token
            );

            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid])
                    .build(),
                user1.token
            );

            await apiDriver.deleteExpense(expense.id, user1.token);

            // step 1 - find the expected events
            await apiDriver.waitForExpenseCreationEvent(group.id, expense.id, [user1]);
            await apiDriver.waitForExpenseUpdatedEvent(group.id, expense.id, [user1]); // soft delete is an update
            await apiDriver.waitForBalanceRecalculationEvent(group.id, [user1], 2); // create + delete

            // step 2 - make sure there are no extra / unplanned events
            expect(await apiDriver.countExpenseChanges(group.id)).toBe(2); // created + updated (soft delete)
            expect(await apiDriver.countBalanceChanges(group.id)).toBe(2);

            // step 3 - verify the last change is the soft delete
            const lastChange = await apiDriver.mostRecentExpenseChangeEvent(group.id);
            expect(lastChange).toBeTruthy();
            expect(lastChange?.action).toBe('updated'); // soft delete shows as update
            expect(lastChange?.type).toBe('expense');
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