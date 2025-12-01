import { amountToSmallestUnit, calculateEqualSplits, FirebaseUser, MemberRoles, MemberStatuses, toAmount, toCurrencyISOCode, USD } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder, ExpenseUpdateBuilder, GroupUpdateBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

type UserRef = FirebaseUser;

describe('Group lifecycle behaviour (stub firestore)', () => {
    let appDriver: AppDriver;

    beforeEach(() => {
        appDriver = new AppDriver();
    });

    afterEach(() => {
        appDriver.dispose();
    });

    const registerUser = async (displayName: string): Promise<UserRef> => {
        const registration = new UserRegistrationBuilder()
            .withDisplayName(displayName)
            .build();
        const result = await appDriver.registerUser(registration);
        return { uid: result.user.uid, displayName: result.user.displayName };
    };

    const createGroupWithMembers = async (ownerId: string, memberIds: string[], name: string = 'Joined Group') => {
        const group = await appDriver.createGroup(
            new CreateGroupRequestBuilder()
                .withName(name)
                .build(),
            ownerId,
        );

        if (memberIds.length > 0) {
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, ownerId);
            let counter = 1;
            for (const memberId of memberIds) {
                await appDriver.joinGroupByLink(shareToken, `Test Member ${counter++}`, memberId);
            }
        }

        return group;
    };

    it('deletes groups with full cascade via service', async () => {
        const owner = await registerUser('Owner');
        const member = await registerUser('Member');

        const group = await appDriver.createGroup(
            new CreateGroupRequestBuilder()
                .withName('Cascade Group')
                .withDescription('Group slated for deletion')
                .build(),
            owner.uid,
        );

        const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, owner.uid);
        await appDriver.joinGroupByLink(shareToken, 'Test Member', member.uid);

        const groupDetails = await appDriver.getGroupFullDetails(group.id, {}, owner.uid);
        expect(groupDetails.members.members).toHaveLength(2);

        const expense = await appDriver.createExpense(
            new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(owner.uid)
                .withParticipants([owner.uid, member.uid])
                .withAmount(125, 'USD')
                .withSplitType('equal')
                .build(),
            owner.uid,
        );

        const settlement = await appDriver.createSettlement(
            new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(member.uid)
                .withPayeeId(owner.uid)
                .withAmount(50, 'USD')
                .build(),
            owner.uid,
        );

        await appDriver.deleteGroup(group.id, owner.uid);

        await expect(appDriver.getGroupFullDetails(group.id, {}, owner.uid)).rejects.toThrow();
        await expect(appDriver.getGroupFullDetails(group.id, {}, member.uid)).rejects.toThrow();

        await expect(appDriver.getExpenseFullDetails(expense.id, owner.uid)).rejects.toThrow();
        await expect(appDriver.getSettlement(group.id, settlement.id, owner.uid)).rejects.toThrow();

        const groupsAfterDelete = await appDriver.listGroups({}, owner.uid);
        expect(groupsAfterDelete.groups.some(({ id }) => id === group.id)).toBe(false);

        // Repeat delete should succeed (idempotent)
        await appDriver.deleteGroup(group.id, owner.uid);
    });

    it('prevents non-owners from deleting groups', async () => {
        const owner = await registerUser('Owner');
        const member = await registerUser('Member');

        const group = await appDriver.createGroup(
            new CreateGroupRequestBuilder()
                .withName('Protected Group')
                .build(),
            owner.uid,
        );
        const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, owner.uid);
        await appDriver.joinGroupByLink(shareToken, 'Test Member', member.uid);

        await expect(appDriver.deleteGroup(group.id, member.uid)).rejects.toThrow();

        const groupDetails = await appDriver.getGroupFullDetails(group.id, {}, owner.uid);
        expect(groupDetails.group.id).toBe(group.id);
    });

    it('enforces security for full details access and writes', async () => {
        const owner = await registerUser('Owner');
        const member = await registerUser('Member');
        const outsider = await registerUser('Outsider');

        const group = await appDriver.createGroup(
            new CreateGroupRequestBuilder()
                .withName('Security Group')
                .build(),
            owner.uid,
        );

        const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, owner.uid);
        await appDriver.joinGroupByLink(shareToken, 'Test Member', member.uid);

        await expect(appDriver.getGroupFullDetails(group.id, {}, outsider.uid)).rejects.toThrow();

        const memberResult = await appDriver.getGroupFullDetails(group.id, {}, member.uid);
        expect(memberResult.group.id).toBe(group.id);

        await expect(appDriver.updateGroup(group.id, new GroupUpdateBuilder()
            .withName('Intrusion Attempt')
            .build(), member.uid))
            .rejects
            .toThrow();

        await expect(appDriver.deleteGroup(group.id, member.uid)).rejects.toThrow();
    });

    it('exposes top-level member state via reader utilities', async () => {
        const owner = await registerUser('Owner');
        const member = await registerUser('Joiner');

        const group = await appDriver.createGroup(
            new CreateGroupRequestBuilder()
                .withName('Member Ops')
                .build(),
            owner.uid,
        );

        const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, owner.uid);
        await appDriver.joinGroupByLink(shareToken, 'Test Member', member.uid);

        const members = (await appDriver.getGroupFullDetails(group.id, {}, owner.uid)).members.members;
        expect(members).toHaveLength(2);

        const createdMember = members.find((m) => m.uid === member.uid)!;
        expect(createdMember.memberRole).toBe(MemberRoles.MEMBER);
        expect(createdMember.memberStatus).toBe(MemberStatuses.ACTIVE);

        await appDriver.removeGroupMember(group.id, member.uid, owner.uid);
        const afterRemoval = (await appDriver.getGroupFullDetails(group.id, {}, owner.uid)).members.members;
        expect(afterRemoval.some((m) => m.uid === member.uid)).toBe(false);
    });

    it('allows members to leave groups and loses access afterwards', async () => {
        const owner = await registerUser('Owner');
        const member = await registerUser('Leaver');

        const group = await createGroupWithMembers(owner.uid, [member.uid], 'Leave Group');

        await appDriver.leaveGroup(group.id, member.uid);

        const remainingMembers = (await appDriver.getGroupFullDetails(group.id, {}, owner.uid)).members.members;
        expect(remainingMembers.some(({ uid }) => uid === member.uid)).toBe(false);

        await expect(appDriver.getGroupFullDetails(group.id, {}, member.uid)).rejects.toThrow();
    });

    it('updates timestamps when members leave', async () => {
        const owner = await registerUser('Owner');
        const member = await registerUser('Member');

        const group = await createGroupWithMembers(owner.uid, [member.uid], 'Timestamp Group');

        const before = await appDriver.getGroupFullDetails(group.id, {}, owner.uid);

        await new Promise((resolve) => setTimeout(resolve, 10));

        await appDriver.leaveGroup(group.id, member.uid);
        const after = await appDriver.getGroupFullDetails(group.id, {}, owner.uid);

        expect(new Date(after.group.updatedAt).getTime()).toBeGreaterThan(new Date(before.group.updatedAt).getTime());
    });

    it('handles sequential leave operations leaving only the owner', async () => {
        const owner = await registerUser('Owner');
        const memberOne = await registerUser('Member One');
        const memberTwo = await registerUser('Member Two');

        const group = await createGroupWithMembers(owner.uid, [memberOne.uid, memberTwo.uid], 'Sequential Leaves');

        await appDriver.leaveGroup(group.id, memberOne.uid);
        await appDriver.leaveGroup(group.id, memberTwo.uid);

        const remainingMembers = (await appDriver.getGroupFullDetails(group.id, {}, owner.uid)).members.members;
        expect(remainingMembers.map((m) => m.uid)).toEqual([owner.uid]);
    });

    it('handles mixed leave and removal flows', async () => {
        const owner = await registerUser('Owner');
        const memberOne = await registerUser('Member One');
        const memberTwo = await registerUser('Member Two');

        const group = await createGroupWithMembers(owner.uid, [memberOne.uid, memberTwo.uid], 'Mixed Flow');

        await appDriver.removeGroupMember(group.id, memberOne.uid, owner.uid);
        await appDriver.leaveGroup(group.id, memberTwo.uid);

        const members = (await appDriver.getGroupFullDetails(group.id, {}, owner.uid)).members.members;
        expect(members.map((m) => m.uid)).toEqual([owner.uid]);
    });

    describe('Group full details projections (stub firestore)', () => {
        it('returns consolidated data with pagination hints', async () => {
            const owner = await registerUser('Owner');
            const memberA = await registerUser('Member A');
            const memberB = await registerUser('Member B');

            const group = await createGroupWithMembers(owner.uid, [memberA.uid, memberB.uid], 'Full Details');

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(owner.uid)
                    .withParticipants([owner.uid, memberA.uid, memberB.uid])
                    .withAmount(180, 'USD')
                    .withSplitType('equal')
                    .build(),
                owner.uid,
            );

            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(memberA.uid)
                    .withPayeeId(owner.uid)
                    .withAmount(40, 'USD')
                    .build(),
                memberA.uid,
            );

            const fullDetails = await appDriver.getGroupFullDetails(group.id, {}, owner.uid);

            expect(fullDetails.group.id).toBe(group.id);
            expect(fullDetails.members.members).toHaveLength(3);
            expect(fullDetails.expenses.expenses.length).toBeGreaterThanOrEqual(1);
            expect(fullDetails.settlements.settlements.length).toBeGreaterThanOrEqual(1);
            expect(fullDetails.balances).toHaveProperty('balancesByCurrency');

            const limited = await appDriver.getGroupFullDetails(group.id, {
                expenseLimit: 1,
                settlementLimit: 1,
            }, owner.uid);

            expect(limited.expenses).toHaveProperty('hasMore');
            expect(limited.settlements).toHaveProperty('hasMore');
        });

        it('presents consistent projections to group members', async () => {
            const owner = await registerUser('Owner');
            const member = await registerUser('Member');

            const group = await createGroupWithMembers(owner.uid, [member.uid], 'Consistency Group');

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(owner.uid)
                    .withParticipants([owner.uid, member.uid])
                    .withAmount(100, 'USD')
                    .withSplitType('equal')
                    .build(),
                owner.uid,
            );

            const ownerView = await appDriver.getGroupFullDetails(group.id, {}, owner.uid);
            const memberView = await appDriver.getGroupFullDetails(group.id, {}, member.uid);

            // Both views should have the same group data (non-balance fields)
            expect(ownerView.group.id).toBe(memberView.group.id);
            expect(ownerView.group.name).toBe(memberView.group.name);
            expect(ownerView.expenses).toEqual(memberView.expenses);
            expect(ownerView.settlements).toEqual(memberView.settlements);

            // Balances are user-relative: owner is owed $50, member owes $50
            expect(ownerView.group.balance).toBeDefined();
            expect(ownerView.group.balance?.balancesByCurrency[USD]).toEqual({
                currency: USD,
                netBalance: '50.00',
                totalOwed: '50.00',
                totalOwing: '0.00',
            });

            expect(memberView.group.balance).toBeDefined();
            expect(memberView.group.balance?.balancesByCurrency[USD]).toEqual({
                currency: USD,
                netBalance: '-50.00',
                totalOwed: '0.00',
                totalOwing: '50.00',
            });
        });
    });

    describe('Group listing behaviour (stub firestore)', () => {
        let owner: UserRef;

        beforeEach(async () => {
            owner = await registerUser('Listing Owner');
        });

        const createSequentialGroups = async (count: number) => {
            const groups = [];
            for (let i = 0; i < count; i++) {
                const group = await appDriver.createGroup(
                    new CreateGroupRequestBuilder()
                        .withName(`Listing Group ${i}`)
                        .build(),
                    owner.uid,
                );
                groups.push(group);
                await new Promise((resolve) => setTimeout(resolve, 10));
            }
            return groups;
        };

        it('lists groups with counts and metadata', async () => {
            await createSequentialGroups(5);

            const response = await appDriver.listGroups({}, owner.uid);

            expect(Array.isArray(response.groups)).toBe(true);
            expect(response.groups.length).toBeGreaterThanOrEqual(5);
            expect(response.count).toBe(response.groups.length);
            expect(response).toHaveProperty('hasMore');
        });

        it('includes balance summaries in listings', async () => {
            const [targetGroup] = await createSequentialGroups(3);

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(targetGroup.id)
                    .withDescription('Listing expense')
                    .withAmount(100, 'USD')
                    .withPaidBy(owner.uid)
                    .withParticipants([owner.uid])
                    .withSplitType('equal')
                    .build(),
                owner.uid,
            );

            const updated = await appDriver.listGroups({}, owner.uid);
            const groupEntry = updated.groups.find((group) => group.id === targetGroup.id);

            expect(groupEntry).toBeDefined();
            if (groupEntry) {
                expect(groupEntry.balance).toBeDefined();
                expect(groupEntry.balance?.balancesByCurrency).toBeDefined();
                expect(groupEntry).toHaveProperty('lastActivity');
            }
        });

        it('supports pagination', async () => {
            await createSequentialGroups(5);

            const page1 = await appDriver.listGroups({ limit: 2 }, owner.uid);
            expect(page1.groups).toHaveLength(2);
            expect(page1.hasMore).toBe(true);
            expect(page1.nextCursor).toBeDefined();

            const page2 = await appDriver.listGroups({
                limit: 2,
                cursor: page1.nextCursor,
            }, owner.uid);
            expect(page2.groups.length).toBeGreaterThanOrEqual(1);

            const intersection = page1.groups.map((g) => g.id).filter((id) => page2.groups.some((g) => g.id === id));
            expect(intersection).toHaveLength(0);
        });

        it('supports explicit page size of eight entries', async () => {
            const created = await createSequentialGroups(12);

            const page1 = await appDriver.listGroups({ limit: 8 }, owner.uid);
            expect(page1.groups).toHaveLength(8);
            expect(page1.hasMore).toBe(true);
            expect(page1.nextCursor).toBeDefined();
            expect(page1.pagination.limit).toBe(8);

            const page2 = await appDriver.listGroups({
                limit: 8,
                cursor: page1.nextCursor,
            }, owner.uid);
            expect(page2.groups.length).toBeGreaterThanOrEqual(4);
            expect(page2.pagination.limit).toBe(8);

            const collectedIds = [...page1.groups, ...page2.groups].map((g) => g.id);
            created.forEach((group) => {
                expect(collectedIds).toContain(group.id);
            });
        });

        it('orders groups ascending and descending by last activity', async () => {
            await createSequentialGroups(5);
            await new Promise((resolve) => setTimeout(resolve, 100));
            const newestGroup = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Latest Listing Group')
                    .build(),
                owner.uid,
            );

            const responseDesc = await appDriver.listGroups({ order: 'desc' }, owner.uid);
            const responseAsc = await appDriver.listGroups({ order: 'asc' }, owner.uid);

            const topSix = responseDesc.groups.slice(0, 6).map((g) => g.id);
            expect(topSix).toContain(newestGroup.id);
            expect(responseDesc.groups[0].id).not.toBe(responseAsc.groups[0].id);
        });

        it('excludes groups where the user is not a member', async () => {
            const other = await registerUser('Other User');

            const otherGroup = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Other Users Group')
                    .build(),
                other.uid,
            );

            await createSequentialGroups(2);

            const response = await appDriver.listGroups({}, owner.uid);
            const ids = response.groups.map((group) => group.id);
            expect(ids).not.toContain(otherGroup.id);
        });

        it('requires authentication', async () => {
            await expect(
                appDriver.listGroups({ limit: 1 }, ''),
            ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
        });

        it('supports includeMetadata flag', async () => {
            await createSequentialGroups(2);

            const withoutMeta = await appDriver.listGroups({ includeMetadata: false }, owner.uid);
            expect(withoutMeta.metadata).toBeUndefined();

            const withMeta = await appDriver.listGroups({ includeMetadata: true }, owner.uid);
            if (withMeta.metadata) {
                expect(withMeta.metadata).toHaveProperty('lastChangeTimestamp');
                expect(withMeta.metadata).toHaveProperty('changeCount');
                expect(withMeta.metadata).toHaveProperty('serverTime');
            }
        });

        it('reflects expenses and settlements in listings', async () => {
            const [targetGroup] = await createSequentialGroups(1);

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(targetGroup.id)
                    .withDescription('Listing Balances')
                    .withAmount(100, 'USD')
                    .withPaidBy(owner.uid)
                    .withParticipants([owner.uid])
                    .withSplitType('equal')
                    .build(),
                owner.uid,
            );

            const response = await appDriver.listGroups({}, owner.uid);
            const groupEntry = response.groups.find((g) => g.id === targetGroup.id);

            expect(groupEntry).toBeDefined();
            if (groupEntry) {
                expect(groupEntry.balance?.balancesByCurrency).toBeDefined();
                expect(groupEntry.lastActivity).toBeDefined();
            }
        });
    });

    describe('Group lifecycle edge cases (stub firestore)', () => {
        it('retrieves group with no expenses', async () => {
            const owner = await registerUser('Owner');

            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('No Expense Group')
                    .build(),
                owner.uid,
            );

            const details = await appDriver.getGroupFullDetails(group.id, {}, owner.uid);
            expect(details.group.id).toBe(group.id);

            const expenses = await appDriver.getGroupExpenses(group.id, {}, owner.uid);
            expect(expenses.expenses).toHaveLength(0);

            const balances = await appDriver.getGroupBalances(group.id, owner.uid);
            for (const currencyStr of Object.keys(balances.balancesByCurrency)) {
                const currency = toCurrencyISOCode(currencyStr);
                const userBalances = balances.balancesByCurrency[currency];
                for (const userBalance of Object.values(userBalances)) {
                    expect(Number(userBalance.netBalance)).toBe(0);
                }
            }
        });

        it('handles multiple expenses with identical participants', async () => {
            const owner = await registerUser('Owner');

            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Multi Expense Group')
                    .build(),
                owner.uid,
            );

            const amounts = ['50', '30', '20'];
            for (const amount of amounts) {
                await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withAmount(Number(amount), 'USD')
                        .withDescription(`Expense ${amount}`)
                        .withPaidBy(owner.uid)
                        .withParticipants([owner.uid])
                        .withSplitType('equal')
                        .build(),
                    owner.uid,
                );
            }

            const expenses = await appDriver.getGroupExpenses(group.id, {}, owner.uid);
            expect(expenses.expenses).toHaveLength(3);

            const groupSummary = await appDriver.getGroup(group.id, owner.uid);
            const usdCurrency = USD;
            if (groupSummary.balance?.balancesByCurrency?.[usdCurrency]) {
                expect(Number(groupSummary.balance.balancesByCurrency[usdCurrency].netBalance)).toBe(0);
            }
        });

        it('deletes expenses successfully', async () => {
            const owner = await registerUser('Owner');
            const member = await registerUser('Member');

            const group = await createGroupWithMembers(owner.uid, [member.uid], 'Deletion Group');

            const createdExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('Deletable Expense')
                    .withAmount(100, 'USD')
                    .withPaidBy(owner.uid)
                    .withParticipants([owner.uid, member.uid])
                    .withSplitType('equal')
                    .build(),
                owner.uid,
            );

            const fullBefore = await appDriver.getExpenseFullDetails(createdExpense.id, owner.uid);
            expect(fullBefore.expense.description).toBe('Deletable Expense');

            await appDriver.deleteExpense(createdExpense.id, owner.uid);

            await expect(appDriver.getExpenseFullDetails(createdExpense.id, owner.uid)).rejects.toThrow();
        });

        it('handles complex split scenarios', async () => {
            const owner = await registerUser('Owner');

            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Split Group')
                    .build(),
                owner.uid,
            );

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(90, 'USD')
                    .withPaidBy(owner.uid)
                    .withParticipants([owner.uid])
                    .withSplitType('equal')
                    .build(),
                owner.uid,
            );

            const details = await appDriver.getGroupFullDetails(group.id, {}, owner.uid);
            expect(details.expenses.expenses).toHaveLength(1);

            const usdCurrency = USD;
            if (details.group.balance?.balancesByCurrency?.[usdCurrency]) {
                expect(Number(details.group.balance.balancesByCurrency[usdCurrency].netBalance)).toBe(0);
            }
        });

        it('updates expenses successfully', async () => {
            const owner = await registerUser('Owner');
            const member = await registerUser('Member');

            const group = await createGroupWithMembers(owner.uid, [member.uid], 'Update Group');

            const initialExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('Updatable Expense')
                    .withAmount(50, 'USD')
                    .withPaidBy(owner.uid)
                    .withParticipants([owner.uid, member.uid])
                    .withSplitType('equal')
                    .build(),
                owner.uid,
            );

            const participants = [owner.uid, member.uid];
            const newExpense = await appDriver.updateExpense(
                initialExpense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(80, 'USD')
                    .withDescription('Updated Expense')
                    .withParticipants(participants)
                    .withSplits(calculateEqualSplits(toAmount(80), USD, participants))
                    .build(),
                owner.uid,
            );

            // Update creates a new expense with a new ID (edit history via soft deletes)
            const updatedExpense = await appDriver.getExpenseFullDetails(newExpense.id, owner.uid);
            expect(updatedExpense.expense.amount).toBe('80');
            expect(updatedExpense.expense.description).toBe('Updated Expense');

            const totalUnits = updatedExpense.expense.splits.reduce(
                (sum, split) => sum + amountToSmallestUnit(split.amount, updatedExpense.expense.currency),
                0,
            );
            const expectedUnits = amountToSmallestUnit(updatedExpense.expense.amount, updatedExpense.expense.currency);
            expect(totalUnits).toBe(expectedUnits);
        });
    });
});
