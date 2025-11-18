import { amountToSmallestUnit, calculateEqualSplits, MemberRoles, MemberStatuses } from '@splitifyd/shared';
import { DisplayName } from '@splitifyd/shared';
import { toGroupName } from '@splitifyd/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder, ExpenseUpdateBuilder } from '@splitifyd/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('Group lifecycle behaviour (stub firestore)', () => {
    let appDriver: AppDriver;

    beforeEach(() => {
        appDriver = new AppDriver();
    });

    afterEach(() => {
        appDriver.dispose();
    });

    const seedUsers = (...users: Array<{ id: string; displayName: DisplayName | string; }>) => {
        for (const user of users) {
            appDriver.seedUser(user.id, { displayName: user.displayName, email: `${user.id}@test.local` });
        }
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
        const owner = { id: 'owner-user', displayName: 'Owner' };
        const member = { id: 'member-user', displayName: 'Member' };
        seedUsers(owner, member);

        const group = await appDriver.createGroup(
            new CreateGroupRequestBuilder()
                .withName('Cascade Group')
                .withDescription('Group slated for deletion')
                .build(),
            owner.id,
        );

        const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, owner.id);
        await appDriver.joinGroupByLink(shareToken, 'Test Member', member.id);

        const groupDetails = await appDriver.getGroupFullDetails(group.id, {}, owner.id);
        expect(groupDetails.members.members).toHaveLength(2);

        const expense = await appDriver.createExpense(
            new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(owner.id)
                .withParticipants([owner.id, member.id])
                .withAmount(125, 'USD')
                .withSplitType('equal')
                .build(),
            owner.id,
        );

        const settlement = await appDriver.createSettlement(
            new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(member.id)
                .withPayeeId(owner.id)
                .withAmount(50, 'USD')
                .build(),
            owner.id,
        );

        const response = await appDriver.deleteGroup(group.id, owner.id);
        expect(response.message).toBe('Group deleted successfully');

        await expect(appDriver.getGroupFullDetails(group.id, {}, owner.id)).rejects.toThrow();
        await expect(appDriver.getGroupFullDetails(group.id, {}, member.id)).rejects.toThrow();

        await expect(appDriver.getExpenseFullDetails(expense.id, owner.id)).rejects.toThrow();
        await expect(appDriver.getSettlement(group.id, settlement.id, owner.id)).rejects.toThrow();

        const groupsAfterDelete = await appDriver.listGroups({}, owner.id);
        expect(groupsAfterDelete.groups.some(({ id }) => id === group.id)).toBe(false);

        const repeatDelete = await appDriver.deleteGroup(group.id, owner.id);
        expect(repeatDelete.message).toBe('Group deleted successfully');
    });

    it('prevents non-owners from deleting groups', async () => {
        const owner = { id: 'delete-owner', displayName: 'Owner' };
        const member = { id: 'delete-member', displayName: 'Member' };
        seedUsers(owner, member);

        const group = await appDriver.createGroup(
            new CreateGroupRequestBuilder()
                .withName('Protected Group')
                .build(),
            owner.id,
        );
        const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, owner.id);
        await appDriver.joinGroupByLink(shareToken, 'Test Member', member.id);

        await expect(appDriver.deleteGroup(group.id, member.id)).rejects.toThrow();

        const groupDetails = await appDriver.getGroupFullDetails(group.id, {}, owner.id);
        expect(groupDetails.group.id).toBe(group.id);
    });

    it('enforces security for full details access and writes', async () => {
        const owner = { id: 'secure-owner', displayName: 'Owner' };
        const member = { id: 'secure-member', displayName: 'Member' };
        const outsider = { id: 'secure-outsider', displayName: 'Outsider' };
        seedUsers(owner, member, outsider);

        const group = await appDriver.createGroup(
            new CreateGroupRequestBuilder()
                .withName('Security Group')
                .build(),
            owner.id,
        );

        const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, owner.id);
        await appDriver.joinGroupByLink(shareToken, 'Test Member', member.id);

        await expect(appDriver.getGroupFullDetails(group.id, {}, outsider.id)).rejects.toThrow();

        const memberResult = await appDriver.getGroupFullDetails(group.id, {}, member.id);
        expect(memberResult.group.id).toBe(group.id);

        await expect(appDriver.updateGroup(group.id, {
            name: toGroupName('Intrusion Attempt'),
        }, member.id))
            .rejects
            .toThrow();

        await expect(appDriver.deleteGroup(group.id, member.id)).rejects.toThrow();
    });

    it('exposes top-level member state via reader utilities', async () => {
        const owner = { id: 'member-owner', displayName: 'Owner' };
        const member = { id: 'member-joiner', displayName: 'Joiner' };
        seedUsers(owner, member);

        const group = await appDriver.createGroup(
            new CreateGroupRequestBuilder()
                .withName('Member Ops')
                .build(),
            owner.id,
        );

        const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, owner.id);
        await appDriver.joinGroupByLink(shareToken, 'Test Member', member.id);

        const members = (await appDriver.getGroupFullDetails(group.id, {}, owner.id)).members.members;
        expect(members).toHaveLength(2);

        const createdMember = members.find((m) => m.uid === member.id)!;
        expect(createdMember.memberRole).toBe(MemberRoles.MEMBER);
        expect(createdMember.memberStatus).toBe(MemberStatuses.ACTIVE);

        await appDriver.removeGroupMember(group.id, member.id, owner.id);
        const afterRemoval = (await appDriver.getGroupFullDetails(group.id, {}, owner.id)).members.members;
        expect(afterRemoval.some((m) => m.uid === member.id)).toBe(false);
    });

    it('allows members to leave groups and loses access afterwards', async () => {
        const owner = { id: 'leave-owner', displayName: 'Owner' };
        const member = { id: 'leave-member', displayName: 'Leaver' };
        seedUsers(owner, member);

        const group = await createGroupWithMembers(owner.id, [member.id], 'Leave Group');

        const response = await appDriver.leaveGroup(group.id, member.id);
        expect(response.message).toContain('Successfully left the group');

        const remainingMembers = (await appDriver.getGroupFullDetails(group.id, {}, owner.id)).members.members;
        expect(remainingMembers.some(({ uid }) => uid === member.id)).toBe(false);

        await expect(appDriver.getGroupFullDetails(group.id, {}, member.id)).rejects.toThrow();
    });

    it('updates timestamps when members leave', async () => {
        const owner = { id: 'timestamp-owner', displayName: 'Owner' };
        const member = { id: 'timestamp-member', displayName: 'Member' };
        seedUsers(owner, member);

        const group = await createGroupWithMembers(owner.id, [member.id], 'Timestamp Group');

        const before = await appDriver.getGroupFullDetails(group.id, {}, owner.id);

        await new Promise((resolve) => setTimeout(resolve, 10));

        await appDriver.leaveGroup(group.id, member.id);
        const after = await appDriver.getGroupFullDetails(group.id, {}, owner.id);

        expect(new Date(after.group.updatedAt).getTime()).toBeGreaterThan(new Date(before.group.updatedAt).getTime());
    });

    it('handles sequential leave operations leaving only the owner', async () => {
        const owner = { id: 'sequence-owner', displayName: 'Owner' };
        const memberOne = { id: 'sequence-member-1', displayName: 'Member One' };
        const memberTwo = { id: 'sequence-member-2', displayName: 'Member Two' };
        seedUsers(owner, memberOne, memberTwo);

        const group = await createGroupWithMembers(owner.id, [memberOne.id, memberTwo.id], 'Sequential Leaves');

        await appDriver.leaveGroup(group.id, memberOne.id);
        await appDriver.leaveGroup(group.id, memberTwo.id);

        const remainingMembers = (await appDriver.getGroupFullDetails(group.id, {}, owner.id)).members.members;
        expect(remainingMembers.map((m) => m.uid)).toEqual([owner.id]);
    });

    it('handles mixed leave and removal flows', async () => {
        const owner = { id: 'mixed-owner', displayName: 'Owner' };
        const memberOne = { id: 'mixed-member-1', displayName: 'Member One' };
        const memberTwo = { id: 'mixed-member-2', displayName: 'Member Two' };
        seedUsers(owner, memberOne, memberTwo);

        const group = await createGroupWithMembers(owner.id, [memberOne.id, memberTwo.id], 'Mixed Flow');

        await appDriver.removeGroupMember(group.id, memberOne.id, owner.id);
        await appDriver.leaveGroup(group.id, memberTwo.id);

        const members = (await appDriver.getGroupFullDetails(group.id, {}, owner.id)).members.members;
        expect(members.map((m) => m.uid)).toEqual([owner.id]);
    });

    describe('Group full details projections (stub firestore)', () => {
        it('returns consolidated data with pagination hints', async () => {
            const owner = { id: 'full-owner', displayName: 'Owner' };
            const memberA = { id: 'full-member-a', displayName: 'Member A' };
            const memberB = { id: 'full-member-b', displayName: 'Member B' };
            seedUsers(owner, memberA, memberB);

            const group = await createGroupWithMembers(owner.id, [memberA.id, memberB.id], 'Full Details');

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(owner.id)
                    .withParticipants([owner.id, memberA.id, memberB.id])
                    .withAmount(180, 'USD')
                    .withSplitType('equal')
                    .build(),
                owner.id,
            );

            await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(memberA.id)
                    .withPayeeId(owner.id)
                    .withAmount(40, 'USD')
                    .build(),
                memberA.id,
            );

            const fullDetails = await appDriver.getGroupFullDetails(group.id, {}, owner.id);

            expect(fullDetails.group.id).toBe(group.id);
            expect(fullDetails.members.members).toHaveLength(3);
            expect(fullDetails.expenses.expenses.length).toBeGreaterThanOrEqual(1);
            expect(fullDetails.settlements.settlements.length).toBeGreaterThanOrEqual(1);
            expect(fullDetails.balances).toHaveProperty('balancesByCurrency');

            const limited = await appDriver.getGroupFullDetails(group.id, {
                expenseLimit: 1,
                settlementLimit: 1,
            }, owner.id);

            expect(limited.expenses).toHaveProperty('hasMore');
            expect(limited.settlements).toHaveProperty('hasMore');
        });

        it('presents consistent projections to group members', async () => {
            const owner = { id: 'consistent-owner', displayName: 'Owner' };
            const member = { id: 'consistent-member', displayName: 'Member' };
            seedUsers(owner, member);

            const group = await createGroupWithMembers(owner.id, [member.id], 'Consistency Group');

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(owner.id)
                    .withParticipants([owner.id, member.id])
                    .withAmount(100, 'USD')
                    .withSplitType('equal')
                    .build(),
                owner.id,
            );

            const ownerView = await appDriver.getGroupFullDetails(group.id, {}, owner.id);
            const memberView = await appDriver.getGroupFullDetails(group.id, {}, member.id);

            // Both views should have the same group data (non-balance fields)
            expect(ownerView.group.id).toBe(memberView.group.id);
            expect(ownerView.group.name).toBe(memberView.group.name);
            expect(ownerView.expenses).toEqual(memberView.expenses);
            expect(ownerView.settlements).toEqual(memberView.settlements);

            // Balances are user-relative: owner is owed $50, member owes $50
            expect(ownerView.group.balance).toBeDefined();
            expect(ownerView.group.balance?.balancesByCurrency.USD).toEqual({
                currency: 'USD',
                netBalance: '50.00',
                totalOwed: '50.00',
                totalOwing: '0.00',
            });

            expect(memberView.group.balance).toBeDefined();
            expect(memberView.group.balance?.balancesByCurrency.USD).toEqual({
                currency: 'USD',
                netBalance: '-50.00',
                totalOwed: '0.00',
                totalOwing: '50.00',
            });
        });
    });

    describe('Group listing behaviour (stub firestore)', () => {
        const owner = { id: 'listing-owner', displayName: 'Listing Owner' };

        beforeEach(() => {
            seedUsers(owner);
        });

        const createSequentialGroups = async (count: number) => {
            const groups = [];
            for (let i = 0; i < count; i++) {
                const group = await appDriver.createGroup(
                    new CreateGroupRequestBuilder()
                        .withName(`Listing Group ${i}`)
                        .build(),
                    owner.id,
                );
                groups.push(group);
                await new Promise((resolve) => setTimeout(resolve, 10));
            }
            return groups;
        };

        it('lists groups with counts and metadata', async () => {
            await createSequentialGroups(5);

            const response = await appDriver.listGroups({}, owner.id);

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
                    .withPaidBy(owner.id)
                    .withParticipants([owner.id])
                    .withSplitType('equal')
                    .build(),
                owner.id,
            );

            const updated = await appDriver.listGroups({}, owner.id);
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

            const page1 = await appDriver.listGroups({ limit: 2 }, owner.id);
            expect(page1.groups).toHaveLength(2);
            expect(page1.hasMore).toBe(true);
            expect(page1.nextCursor).toBeDefined();

            const page2 = await appDriver.listGroups({
                limit: 2,
                cursor: page1.nextCursor,
            }, owner.id);
            expect(page2.groups.length).toBeGreaterThanOrEqual(1);

            const intersection = page1.groups.map((g) => g.id).filter((id) => page2.groups.some((g) => g.id === id));
            expect(intersection).toHaveLength(0);
        });

        it('supports explicit page size of eight entries', async () => {
            const created = await createSequentialGroups(12);

            const page1 = await appDriver.listGroups({ limit: 8 }, owner.id);
            expect(page1.groups).toHaveLength(8);
            expect(page1.hasMore).toBe(true);
            expect(page1.nextCursor).toBeDefined();
            expect(page1.pagination.limit).toBe(8);

            const page2 = await appDriver.listGroups({
                limit: 8,
                cursor: page1.nextCursor,
            }, owner.id);
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
                owner.id,
            );

            const responseDesc = await appDriver.listGroups({ order: 'desc' }, owner.id);
            const responseAsc = await appDriver.listGroups({ order: 'asc' }, owner.id);

            const topSix = responseDesc.groups.slice(0, 6).map((g) => g.id);
            expect(topSix).toContain(newestGroup.id);
            expect(responseDesc.groups[0].id).not.toBe(responseAsc.groups[0].id);
        });

        it('excludes groups where the user is not a member', async () => {
            const other = { id: 'listing-other', displayName: 'Other User' };
            seedUsers(other);

            const otherGroup = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Other Users Group')
                    .build(),
                other.id,
            );

            await createSequentialGroups(2);

            const response = await appDriver.listGroups({}, owner.id);
            const ids = response.groups.map((group) => group.id);
            expect(ids).not.toContain(otherGroup.id);
        });

        it('requires authentication', async () => {
            const response = await appDriver.listGroups({ limit: 1 }, '');
            expect(response).toHaveProperty('error');
            expect((response as any).error.code).toBe('UNAUTHORIZED');
        });

        it('supports includeMetadata flag', async () => {
            await createSequentialGroups(2);

            const withoutMeta = await appDriver.listGroups({ includeMetadata: false }, owner.id);
            expect(withoutMeta.metadata).toBeUndefined();

            const withMeta = await appDriver.listGroups({ includeMetadata: true }, owner.id);
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
                    .withPaidBy(owner.id)
                    .withParticipants([owner.id])
                    .withSplitType('equal')
                    .build(),
                owner.id,
            );

            const response = await appDriver.listGroups({}, owner.id);
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
            const owner = { id: 'edge-owner', displayName: 'Owner' };
            seedUsers(owner);

            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('No Expense Group')
                    .build(),
                owner.id,
            );

            const details = await appDriver.getGroupFullDetails(group.id, {}, owner.id);
            expect(details.group.id).toBe(group.id);

            const expenses = await appDriver.getGroupExpenses(group.id, {}, owner.id);
            expect(expenses.expenses).toHaveLength(0);

            const balances = await appDriver.getGroupBalances(group.id, owner.id);
            if (balances.balancesByCurrency?.['EUR']) {
                expect(Number(balances.balancesByCurrency['EUR'].netBalance)).toBe(0);
            }
        });

        it('handles multiple expenses with identical participants', async () => {
            const owner = { id: 'edge-multi-owner', displayName: 'Owner' };
            seedUsers(owner);

            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Multi Expense Group')
                    .build(),
                owner.id,
            );

            const amounts = ['50', '30', '20'];
            for (const amount of amounts) {
                await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withAmount(Number(amount), 'USD')
                        .withDescription(`Expense ${amount}`)
                        .withPaidBy(owner.id)
                        .withParticipants([owner.id])
                        .withSplitType('equal')
                        .build(),
                    owner.id,
                );
            }

            const expenses = await appDriver.getGroupExpenses(group.id, {}, owner.id);
            expect(expenses.expenses).toHaveLength(3);

            const groupSummary = await appDriver.getGroup(group.id, owner.id);
            if (groupSummary.balance?.balancesByCurrency?.['USD']) {
                expect(Number(groupSummary.balance.balancesByCurrency['USD'].netBalance)).toBe(0);
            }
        });

        it('deletes expenses successfully', async () => {
            const owner = { id: 'edge-delete-owner', displayName: 'Owner' };
            const member = { id: 'edge-delete-member', displayName: 'Member' };
            seedUsers(owner, member);

            const group = await createGroupWithMembers(owner.id, [member.id], 'Deletion Group');

            const createdExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('Deletable Expense')
                    .withAmount(100, 'USD')
                    .withPaidBy(owner.id)
                    .withParticipants([owner.id, member.id])
                    .withSplitType('equal')
                    .build(),
                owner.id,
            );

            const fullBefore = await appDriver.getExpenseFullDetails(createdExpense.id, owner.id);
            expect(fullBefore.expense.description).toBe('Deletable Expense');

            await appDriver.deleteExpense(createdExpense.id, owner.id);

            await expect(appDriver.getExpenseFullDetails(createdExpense.id, owner.id)).rejects.toThrow();
        });

        it('handles complex split scenarios', async () => {
            const owner = { id: 'edge-split-owner', displayName: 'Owner' };
            seedUsers(owner);

            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Split Group')
                    .build(),
                owner.id,
            );

            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(90, 'USD')
                    .withPaidBy(owner.id)
                    .withParticipants([owner.id])
                    .withSplitType('equal')
                    .build(),
                owner.id,
            );

            const details = await appDriver.getGroupFullDetails(group.id, {}, owner.id);
            expect(details.expenses.expenses).toHaveLength(1);

            if (details.group.balance?.balancesByCurrency?.['USD']) {
                expect(Number(details.group.balance.balancesByCurrency['USD'].netBalance)).toBe(0);
            }
        });

        it('updates expenses successfully', async () => {
            const owner = { id: 'edge-update-owner', displayName: 'Owner' };
            const member = { id: 'edge-update-member', displayName: 'Member' };
            seedUsers(owner, member);

            const group = await createGroupWithMembers(owner.id, [member.id], 'Update Group');

            const initialExpense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('Updatable Expense')
                    .withAmount(50, 'USD')
                    .withPaidBy(owner.id)
                    .withParticipants([owner.id, member.id])
                    .withSplitType('equal')
                    .build(),
                owner.id,
            );

            const participants = [owner.id, member.id];
            await appDriver.updateExpense(
                initialExpense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(80, 'USD')
                    .withDescription('Updated Expense')
                    .withParticipants(participants)
                    .withSplits(calculateEqualSplits(80, 'USD', participants))
                    .build(),
                owner.id,
            );

            const updatedExpense = await appDriver.getExpenseFullDetails(initialExpense.id, owner.id);
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
