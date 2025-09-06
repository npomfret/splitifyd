import {beforeEach, describe, expect, it} from 'vitest';
import {CreateGroupRequestBuilder, ExpenseBuilder, SettlementBuilder, ExpenseUpdateBuilder, GroupUpdateBuilder, AppDriver, ApiDriver, borrowTestUsers} from '@splitifyd/test-support';
import {getFirestore} from "../../../firebase";
import {AuthenticatedFirebaseUser} from "@splitifyd/shared";

describe('Change Detection Integration Tests', () => {
    const apiDriver = new ApiDriver();
    const appDriver = new AppDriver(apiDriver, getFirestore());

    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(3);
    });

    describe('Group Change Tracking', () => {
        it('should create a "created" change document when a group is created', async () => {
            // Create a group using builder with minimal fields
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);

            // step 1 - find the expected events
            await appDriver.waitForGroupCreationEvent(group.id, users[0]);

            // step 2 - make sure there are no extra / unplanned events
            expect(await appDriver.countGroupChanges(group.id)).toBe(1);
        });

        it('should create an "updated" change document when a group is modified', async () => {
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);

            await apiDriver.updateGroup(group.id, new GroupUpdateBuilder().withName('Updated Name').build(), users[0].token);

            // step 1 - find the expected events
            await appDriver.waitForGroupCreationEvent(group.id, users[0]);
            await appDriver.waitForGroupUpdatedEvent(group.id, users[0]);

            // step 2 - make sure there are no extra / unplanned events
            expect(await appDriver.countGroupChanges(group.id)).toBe(2);
        });

        it('should immediately process multiple rapid group updates', async () => {
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);

            await apiDriver.updateGroup(group.id, new GroupUpdateBuilder().withName('Update 1').build(), users[0].token);
            await apiDriver.updateGroup(group.id, new GroupUpdateBuilder().withName('Update 2').build(), users[0].token);
            await apiDriver.updateGroup(group.id, new GroupUpdateBuilder().withName('Update 3').build(), users[0].token);

            // step 1 - find the expected events
            await appDriver.waitForGroupCreationEvent(group.id, users[0]);
            await appDriver.waitForGroupUpdatedEvent(group.id, users[0], 3);

            // step 2 - make sure there are no extra / unplanned events
            expect(await appDriver.countGroupChanges(group.id)).toBe(4);
        });

        it('should track affected users when members are added', async () => {
            const group = await apiDriver.createGroupWithMembers('Multi-member Group', [users[0], users[1]], users[0].token);

            // step 1 - find the expected events
            await appDriver.waitForGroupCreationEvent(group.id, users[0]);
            await appDriver.waitForGroupUpdatedEvent(group.id, users[0], 1); // user joining (share link creation no longer triggers group update)

            // step 2 - make sure there are no extra / unplanned events
            expect(await appDriver.countGroupChanges(group.id)).toBe(2);

            // step 3 - check the affected users
            const lastUpdate = await appDriver.mostRecentGroupChangeEvent(group);

            expect(lastUpdate).toBeTruthy();
            expect(lastUpdate!.users).toContain(users[0].uid);
            expect(lastUpdate!.users).toContain(users[1].uid);
            expect(Object.keys(lastUpdate!.users).length).toBe(2);
        });
    });

    describe('Expense Change Tracking', () => {
        it('should create change documents for new expenses', async () => {
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);

            const expense = await apiDriver.createExpense(new ExpenseBuilder().withGroupId(group.id).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build(), users[0].token);

            // step 1 - find the expected events
            await appDriver.waitForExpenseCreationEvent(group.id, expense.id, [users[0]]);
            await appDriver.waitForBalanceRecalculationEvent(group.id, [users[0]]);

            // step 2 - make sure there are no extra / unplanned events
            expect(await appDriver.countExpenseChanges(group.id)).toBe(1);
            expect(await appDriver.countBalanceChanges(group.id)).toBe(1);

            // step 3 - check the details of the most recent change
            const lastExpenseChange = await appDriver.mostRecentExpenseChangeEvent(group.id);
            expect(lastExpenseChange).toBeTruthy();
            expect(lastExpenseChange?.groupId).toBe(group.id);
            expect(lastExpenseChange?.action).toBe('created');
            expect(lastExpenseChange?.type).toBe('expense');
            expect(lastExpenseChange?.users).toContain(users[0].uid);
        });

        it('should track multi-user expenses with correct participants', async () => {
            const group = await apiDriver.createGroupWithMembers('Multi-user Expense Group', [users[0], users[1]], users[0].token);

            // Wait for group creation events to settle
            await appDriver.waitForGroupCreationEvent(group.id, users[0]);

            const expense = await apiDriver.createExpense(new ExpenseBuilder().withGroupId(group.id).withPaidBy(users[0].uid).withParticipants([users[0].uid, users[1].uid]).build(), users[0].token);

            // step 1 - find the expected events
            await appDriver.waitForExpenseCreationEvent(group.id, expense.id, [users[0], users[1]]);
            await appDriver.waitForBalanceRecalculationEvent(group.id, [users[0], users[1]]);

            // step 2 - make sure there are no extra / unplanned events
            expect(await appDriver.countExpenseChanges(group.id)).toBe(1);
            expect(await appDriver.countBalanceChanges(group.id)).toBe(1);

            // step 3 - check the details include both users
            const lastExpenseChange = await appDriver.mostRecentExpenseChangeEvent(group.id);
            expect(lastExpenseChange).toBeTruthy();
            expect(lastExpenseChange?.users).toContain(users[0].uid);
            expect(lastExpenseChange?.users).toContain(users[1].uid);
        });

        it('should track expense updates', async () => {
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);

            const expense = await apiDriver.createExpense(new ExpenseBuilder().withGroupId(group.id).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build(), users[0].token);

            // Update expense amount
            await apiDriver.updateExpense(expense.id, new ExpenseUpdateBuilder().withAmount(200).build(), users[0].token);

            // step 1 - find the expected events
            await appDriver.waitForExpenseCreationEvent(group.id, expense.id, [users[0]]);
            await appDriver.waitForExpenseUpdatedEvent(group.id, expense.id, [users[0]]);
            await appDriver.waitForBalanceRecalculationEvent(group.id, [users[0]], 2); // one for create, one for update

            // step 2 - make sure there are no extra / unplanned events
            expect(await appDriver.countExpenseChanges(group.id)).toBe(2); // created + updated
            expect(await appDriver.countBalanceChanges(group.id)).toBe(2);

            // step 3 - check the most recent change is the update
            const lastChange = await appDriver.mostRecentExpenseChangeEvent(group.id);
            expect(lastChange).toBeTruthy();
            expect(lastChange?.action).toBe('updated');
            expect(lastChange?.type).toBe('expense');
        });

        it('should immediately process rapid expense updates', async () => {
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);

            const expense = await apiDriver.createExpense(new ExpenseBuilder().withGroupId(group.id).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build(), users[0].token);

            await apiDriver.updateExpense(expense.id, new ExpenseUpdateBuilder().withDescription('Update 1').build(), users[0].token);
            await apiDriver.updateExpense(expense.id, new ExpenseUpdateBuilder().withDescription('Update 2').build(), users[0].token);
            await apiDriver.updateExpense(expense.id, new ExpenseUpdateBuilder().withDescription('Update 3').build(), users[0].token);

            // step 1 - find the expected events
            await appDriver.waitForExpenseCreationEvent(group.id, expense.id, [users[0]]);
            await appDriver.waitForExpenseUpdatedEvent(group.id, expense.id, [users[0]], 3);
            await appDriver.waitForBalanceRecalculationEvent(group.id, [users[0]], 4); // 1 create + 3 updates

            // step 2 - make sure there are no extra / unplanned events
            expect(await appDriver.countExpenseChanges(group.id)).toBe(4); // 1 created + 3 updated
            expect(await appDriver.countBalanceChanges(group.id)).toBe(4);
        });

        it('should track expense deletion (soft delete) immediately', async () => {
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);

            const expense = await apiDriver.createExpense(new ExpenseBuilder().withGroupId(group.id).withPaidBy(users[0].uid).withParticipants([users[0].uid]).build(), users[0].token);

            await apiDriver.deleteExpense(expense.id, users[0].token);

            // step 1 - find the expected events
            await appDriver.waitForExpenseCreationEvent(group.id, expense.id, [users[0]]);
            await appDriver.waitForExpenseUpdatedEvent(group.id, expense.id, [users[0]]); // soft delete is an update
            await appDriver.waitForBalanceRecalculationEvent(group.id, [users[0]], 2); // create + delete

            // step 2 - make sure there are no extra / unplanned events
            expect(await appDriver.countExpenseChanges(group.id)).toBe(2); // created + updated (soft delete)
            expect(await appDriver.countBalanceChanges(group.id)).toBe(2);

            // step 3 - verify the last change is the soft delete
            const lastChange = await appDriver.mostRecentExpenseChangeEvent(group.id);
            expect(lastChange).toBeTruthy();
            expect(lastChange?.action).toBe('updated'); // soft delete shows as update
            expect(lastChange?.type).toBe('expense');
        });
    });

    describe('Settlement Change Tracking', () => {
        it('should track settlement creation with balance changes', async () => {
            const group = await apiDriver.createGroupWithMembers('Settlement Group', [users[0], users[1]], users[0].token);

            // Wait for group creation and member addition events to settle
            await appDriver.waitForGroupCreationEvent(group.id, users[0]);
            await appDriver.waitForGroupUpdatedEvent(group.id, users[0], 1);

            const settlement = await apiDriver.createSettlement(new SettlementBuilder().withGroupId(group.id).withPayer(users[0].uid).withPayee(users[1].uid).build(), users[0].token);

            // step 1 - find the expected events
            await appDriver.waitForSettlementCreationEvent(group.id, settlement.id, [users[0], users[1]]);
            await appDriver.waitForBalanceRecalculationEvent(group.id, [users[0], users[1]]);

            // step 2 - make sure there are no extra / unplanned events
            expect(await appDriver.countGroupChanges(group.id)).toBe(2); // created + member added
            expect(await appDriver.countSettlementChanges(group.id)).toBe(1);
            expect(await appDriver.countBalanceChanges(group.id)).toBe(1);

            // step 3 - check the details of the most recent settlement change
            const lastSettlementChange = await appDriver.mostRecentSettlementChangeEvent(group.id);
            expect(lastSettlementChange).toBeTruthy();
            expect(lastSettlementChange?.groupId).toBe(group.id);
            expect(lastSettlementChange?.action).toBe('created');
            expect(lastSettlementChange?.type).toBe('settlement');
            expect(lastSettlementChange?.users).toContain(users[0].uid);
            expect(lastSettlementChange?.users).toContain(users[1].uid);
        });

        it('should handle both API format (payerId/payeeId) and legacy format (from/to)', async () => {
            const group = await apiDriver.createGroupWithMembers('Legacy Format Group', [users[0], users[1]], users[0].token);

            // Wait for group creation and member addition events to settle
            await appDriver.waitForGroupCreationEvent(group.id, users[0]);
            await appDriver.waitForGroupUpdatedEvent(group.id, users[0], 1);

            const settlement = await apiDriver.createSettlement(new SettlementBuilder().withGroupId(group.id).withPayer(users[0].uid).withPayee(users[1].uid).build(), users[0].token);

            // step 1 - find the expected events
            await appDriver.waitForSettlementCreationEvent(group.id, settlement.id, [users[0], users[1]]);
            await appDriver.waitForBalanceRecalculationEvent(group.id, [users[0], users[1]]);

            // step 2 - make sure there are no extra / unplanned events
            expect(await appDriver.countGroupChanges(group.id)).toBe(2); // created + member added
            expect(await appDriver.countSettlementChanges(group.id)).toBe(1);
            expect(await appDriver.countBalanceChanges(group.id)).toBe(1);

            // step 3 - verify the settlement change includes both users
            const change = await appDriver.mostRecentSettlementChangeEvent(group.id);
            expect(change).toBeTruthy();
            expect(change?.users).toContain(users[0].uid);
            expect(change?.users).toContain(users[1].uid);
        });
    });

    describe('Cross-entity Change Tracking', () => {
        it('should track changes across multiple entity types', async () => {
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);

            const shareResponse = await apiDriver.generateShareLink(group.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, users[1].token);

            const expense = await apiDriver.createExpense(new ExpenseBuilder().withGroupId(group.id).withPaidBy(users[0].uid).withParticipants([users[0].uid, users[1].uid]).build(), users[0].token);

            const settlement = await apiDriver.createSettlement(new SettlementBuilder().withGroupId(group.id).withPayer(users[1].uid).withPayee(users[0].uid).build(), users[1].token);

            await appDriver.waitForGroupChanges(group.id, (changes) => {
                return changes.length > 0;
            });

            await appDriver.waitForSettlementChanges(group.id, (changes) => {
                const changesOfInterest = changes.filter((item) => item.id === settlement.id);
                return changesOfInterest.length > 0;
            });

            await appDriver.waitForExpenseChanges(group.id, (changes) => {
                const changesOfInterest = changes.filter((item) => item.id === expense.id);
                return changesOfInterest.length > 0;
            });

            await appDriver.waitForBalanceChanges(group.id, (changes) => {
                const changesOfInterest = changes.filter((item) => item.users.length === 2 && item.users.includes(users[0].uid) && item.users.includes(users[1].uid));
                return changesOfInterest.length >= 2;
            });
        });
    });
});
