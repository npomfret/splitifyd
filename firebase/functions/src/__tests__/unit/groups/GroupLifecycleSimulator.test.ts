import { amountToSmallestUnit, calculateEqualSplits, MemberRoles, MemberStatuses } from '@splitifyd/shared';
import { DisplayName } from '@splitifyd/shared';
import { toGroupName } from '@splitifyd/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder, ExpenseUpdateBuilder } from '@splitifyd/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('Group lifecycle behaviour (stub firestore)', () => {
    let appDriver: AppDriver;
    let groupService: ReturnType<ApplicationBuilderInstance['buildGroupService']>;
    let groupMemberService: ReturnType<ApplicationBuilderInstance['buildGroupMemberService']>;
    let groupShareService: NonNullable<ReturnType<ApplicationBuilderInstance['buildGroupShareService']>>;
    let firestoreReader: ReturnType<ApplicationBuilderInstance['buildFirestoreReader']>;

    type Harness = ReturnType<AppDriver['getTestHarness']>;
    type ApplicationBuilderInstance = Harness['applicationBuilder'];

    beforeEach(() => {
        appDriver = new AppDriver();
        const harness = appDriver.getTestHarness();
        const builder = harness.applicationBuilder;
        groupService = builder.buildGroupService();
        groupMemberService = builder.buildGroupMemberService();
        groupShareService = builder.buildGroupShareService();
        firestoreReader = builder.buildFirestoreReader();
    });

    afterEach(() => {
        appDriver.dispose();
    });

    const seedUsers = (...users: Array<{ id: string; displayName: DisplayName; }>) => {
        for (const user of users) {
            appDriver.seedUser(user.id, { displayName: user.displayName, email: `${user.id}@test.local` });
        }
    };

    const createGroupWithMembers = async (ownerId: string, memberIds: string[], name: string = 'Joined Group') => {
        const group = await groupService.createGroup(
            ownerId,
            new CreateGroupRequestBuilder()
                .withName(name)
                .build(),
        );

        if (memberIds.length > 0) {
            const { linkId } = await groupShareService.generateShareableLink(ownerId, group.id);
            let counter = 1;
            for (const memberId of memberIds) {
                await groupShareService.joinGroupByLink(memberId, linkId, `Test Member ${counter++}`);
            }
        }

        return group;
    };

    it('deletes groups with full cascade via service', async () => {
        const owner = { id: 'owner-user', displayName: 'Owner' };
        const member = { id: 'member-user', displayName: 'Member' };
        seedUsers(owner, member);

        const group = await groupService.createGroup(
            owner.id,
            new CreateGroupRequestBuilder()
                .withName('Cascade Group')
                .withDescription('Group slated for deletion')
                .build(),
        );

        const { linkId } = await groupShareService.generateShareableLink(owner.id, group.id);
        await groupShareService.joinGroupByLink(member.id, linkId, "Test Member");

        const expense = await appDriver.createExpense(
            owner.id,
            new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(owner.id)
                .withParticipants([owner.id, member.id])
                .withAmount(125, 'USD')
                .withSplitType('equal')
                .build(),
        );

        const settlement = await appDriver.createSettlement(
            owner.id,
            new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(member.id)
                .withPayeeId(owner.id)
                .withAmount(50, 'USD')
                .build(),
        );

        const response = await groupService.deleteGroup(group.id, owner.id);
        expect(response.message).toBe('Group deleted successfully');

        await expect(firestoreReader.getGroup(group.id)).resolves.toBeNull();

        const softDeletedGroup = await firestoreReader.getGroup(group.id, { includeDeleted: true });
        expect(softDeletedGroup).not.toBeNull();
        expect(softDeletedGroup?.deletedAt).not.toBeNull();

        await expect(firestoreReader.getExpense(expense.id)).resolves.not.toBeNull();
        await expect(firestoreReader.getSettlement(settlement.id)).resolves.not.toBeNull();

        const remainingMembers = await firestoreReader.getAllGroupMembers(group.id);
        expect(remainingMembers).toHaveLength(2);

        const repeatDelete = await groupService.deleteGroup(group.id, owner.id);
        expect(repeatDelete.message).toBe('Group deleted successfully');
    });

    it('prevents non-owners from deleting groups', async () => {
        const owner = { id: 'delete-owner', displayName: 'Owner' };
        const member = { id: 'delete-member', displayName: 'Member' };
        seedUsers(owner, member);

        const group = await groupService.createGroup(
            owner.id,
            new CreateGroupRequestBuilder()
                .withName('Protected Group')
                .build(),
        );
        const { linkId } = await groupShareService.generateShareableLink(owner.id, group.id);
        await groupShareService.joinGroupByLink(member.id, linkId, "Test Member");

        await expect(groupService.deleteGroup(group.id, member.id)).rejects.toThrow();
        await expect(firestoreReader.getGroup(group.id)).resolves.not.toBeNull();
    });

    it('enforces security for full details access and writes', async () => {
        const owner = { id: 'secure-owner', displayName: 'Owner' };
        const member = { id: 'secure-member', displayName: 'Member' };
        const outsider = { id: 'secure-outsider', displayName: 'Outsider' };
        seedUsers(owner, member, outsider);

        const group = await groupService.createGroup(
            owner.id,
            new CreateGroupRequestBuilder()
                .withName('Security Group')
                .build(),
        );

        const { linkId } = await groupShareService.generateShareableLink(owner.id, group.id);
        await groupShareService.joinGroupByLink(member.id, linkId, "Test Member");

        await expect(groupService.getGroupFullDetails(group.id, outsider.id)).rejects.toThrow();

        const memberResult = await groupService.getGroupFullDetails(group.id, member.id);
        expect(memberResult.group.id).toBe(group.id);

        await expect(groupService.updateGroup(
            group.id,
            member.id,
            {
                name: toGroupName('Intrusion Attempt'),
            },
        ))
            .rejects
            .toThrow();

        await expect(groupService.deleteGroup(group.id, member.id)).rejects.toThrow();
    });

    it('exposes top-level member state via reader utilities', async () => {
        const owner = { id: 'member-owner', displayName: 'Owner' };
        const member = { id: 'member-joiner', displayName: 'Joiner' };
        seedUsers(owner, member);

        const group = await groupService.createGroup(
            owner.id,
            new CreateGroupRequestBuilder()
                .withName('Member Ops')
                .build(),
        );

        const { linkId } = await groupShareService.generateShareableLink(owner.id, group.id);
        await groupShareService.joinGroupByLink(member.id, linkId, "Test Member");

        const members = await firestoreReader.getAllGroupMembers(group.id);
        expect(members).toHaveLength(2);

        const createdMember = members.find((m) => m.uid === member.id)!;
        expect(createdMember.memberRole).toBe(MemberRoles.MEMBER);
        expect(createdMember.memberStatus).toBe(MemberStatuses.ACTIVE);

        await groupMemberService.removeGroupMember(owner.id, group.id, member.id);
        const afterRemoval = await firestoreReader.getGroupMember(group.id, member.id);
        expect(afterRemoval).toBeNull();
    });

    it('allows members to leave groups and loses access afterwards', async () => {
        const owner = { id: 'leave-owner', displayName: 'Owner' };
        const member = { id: 'leave-member', displayName: 'Leaver' };
        seedUsers(owner, member);

        const group = await createGroupWithMembers(owner.id, [member.id], 'Leave Group');

        const response = await appDriver.leaveGroup(member.id, group.id);
        expect(response.message).toContain('Successfully left the group');

        const membership = await firestoreReader.getGroupMember(group.id, member.id);
        expect(membership).toBeNull();

        await expect(groupService.getGroupFullDetails(group.id, member.id)).rejects.toThrow();
    });

    it('updates timestamps when members leave', async () => {
        const owner = { id: 'timestamp-owner', displayName: 'Owner' };
        const member = { id: 'timestamp-member', displayName: 'Member' };
        seedUsers(owner, member);

        const group = await createGroupWithMembers(owner.id, [member.id], 'Timestamp Group');

        const before = await groupService.getGroupFullDetails(group.id, owner.id);

        await new Promise((resolve) => setTimeout(resolve, 10));

        await appDriver.leaveGroup(member.id, group.id);
        const after = await groupService.getGroupFullDetails(group.id, owner.id);

        expect(new Date(after.group.updatedAt).getTime()).toBeGreaterThan(new Date(before.group.updatedAt).getTime());
    });

    it('handles sequential leave operations leaving only the owner', async () => {
        const owner = { id: 'sequence-owner', displayName: 'Owner' };
        const memberOne = { id: 'sequence-member-1', displayName: 'Member One' };
        const memberTwo = { id: 'sequence-member-2', displayName: 'Member Two' };
        seedUsers(owner, memberOne, memberTwo);

        const group = await createGroupWithMembers(owner.id, [memberOne.id, memberTwo.id], 'Sequential Leaves');

        await appDriver.leaveGroup(memberOne.id, group.id);
        await appDriver.leaveGroup(memberTwo.id, group.id);

        const remainingMembers = await firestoreReader.getAllGroupMembers(group.id);
        expect(remainingMembers.map((m) => m.uid)).toEqual([owner.id]);
    });

    it('handles mixed leave and removal flows', async () => {
        const owner = { id: 'mixed-owner', displayName: 'Owner' };
        const memberOne = { id: 'mixed-member-1', displayName: 'Member One' };
        const memberTwo = { id: 'mixed-member-2', displayName: 'Member Two' };
        seedUsers(owner, memberOne, memberTwo);

        const group = await createGroupWithMembers(owner.id, [memberOne.id, memberTwo.id], 'Mixed Flow');

        await groupMemberService.removeGroupMember(owner.id, group.id, memberOne.id);
        await appDriver.leaveGroup(memberTwo.id, group.id);

        const members = await firestoreReader.getAllGroupMembers(group.id);
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
                owner.id,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(owner.id)
                    .withParticipants([owner.id, memberA.id, memberB.id])
                    .withAmount(180, 'USD')
                    .withSplitType('equal')
                    .build(),
            );

            await appDriver.createSettlement(
                memberA.id,
                new CreateSettlementRequestBuilder()
                    .withGroupId(group.id)
                    .withPayerId(memberA.id)
                    .withPayeeId(owner.id)
                    .withAmount(40, 'USD')
                    .build(),
            );

            const fullDetails = await appDriver.getGroupFullDetails(owner.id, group.id);

            expect(fullDetails.group.id).toBe(group.id);
            expect(fullDetails.members.members).toHaveLength(3);
            expect(fullDetails.expenses.expenses.length).toBeGreaterThanOrEqual(1);
            expect(fullDetails.settlements.settlements.length).toBeGreaterThanOrEqual(1);
            expect(fullDetails.balances).toHaveProperty('balancesByCurrency');

            const limited = await appDriver.getGroupFullDetails(owner.id, group.id, {
                expenseLimit: 1,
                settlementLimit: 1,
            });

            expect(limited.expenses).toHaveProperty('hasMore');
            expect(limited.settlements).toHaveProperty('hasMore');
        });

        it('stays consistent with service projections', async () => {
            const owner = { id: 'consistent-owner', displayName: 'Owner' };
            const member = { id: 'consistent-member', displayName: 'Member' };
            seedUsers(owner, member);

            const group = await createGroupWithMembers(owner.id, [member.id], 'Consistency Group');

            await appDriver.createExpense(
                owner.id,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(owner.id)
                    .withParticipants([owner.id, member.id])
                    .withAmount(100, 'USD')
                    .withSplitType('equal')
                    .build(),
            );

            const handlerResult = await appDriver.getGroupFullDetails(owner.id, group.id);
            const serviceResult = await groupService.getGroupFullDetails(group.id, owner.id, {
                expenseLimit: 20,
                settlementLimit: 20,
            });

            expect(handlerResult).toEqual(serviceResult);
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
                    owner.id,
                    new CreateGroupRequestBuilder()
                        .withName(`Listing Group ${i}`)
                        .build(),
                );
                groups.push(group);
                await new Promise((resolve) => setTimeout(resolve, 10));
            }
            return groups;
        };

        it('lists groups with counts and metadata', async () => {
            await createSequentialGroups(5);

            const response = await appDriver.listGroups(owner.id);

            expect(Array.isArray(response.groups)).toBe(true);
            expect(response.groups.length).toBeGreaterThanOrEqual(5);
            expect(response.count).toBe(response.groups.length);
            expect(response).toHaveProperty('hasMore');
        });

        it('includes balance summaries in listings', async () => {
            const [targetGroup] = await createSequentialGroups(3);

            await appDriver.createExpense(
                owner.id,
                new CreateExpenseRequestBuilder()
                    .withGroupId(targetGroup.id)
                    .withDescription('Listing expense')
                    .withAmount(100, 'USD')
                    .withPaidBy(owner.id)
                    .withParticipants([owner.id])
                    .withSplitType('equal')
                    .build(),
            );

            const updated = await appDriver.listGroups(owner.id);
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

            const page1 = await appDriver.listGroups(owner.id, { limit: 2 });
            expect(page1.groups).toHaveLength(2);
            expect(page1.hasMore).toBe(true);
            expect(page1.nextCursor).toBeDefined();

            const page2 = await appDriver.listGroups(owner.id, {
                limit: 2,
                cursor: page1.nextCursor,
            });
            expect(page2.groups.length).toBeGreaterThanOrEqual(1);

            const intersection = page1.groups.map((g) => g.id).filter((id) => page2.groups.some((g) => g.id === id));
            expect(intersection).toHaveLength(0);
        });

        it('supports explicit page size of eight entries', async () => {
            const created = await createSequentialGroups(12);

            const page1 = await appDriver.listGroups(owner.id, { limit: 8 });
            expect(page1.groups).toHaveLength(8);
            expect(page1.hasMore).toBe(true);
            expect(page1.nextCursor).toBeDefined();
            expect(page1.pagination.limit).toBe(8);

            const page2 = await appDriver.listGroups(owner.id, {
                limit: 8,
                cursor: page1.nextCursor,
            });
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
                owner.id,
                new CreateGroupRequestBuilder()
                    .withName('Latest Listing Group')
                    .build(),
            );

            const responseDesc = await appDriver.listGroups(owner.id, { order: 'desc' });
            const responseAsc = await appDriver.listGroups(owner.id, { order: 'asc' });

            const topSix = responseDesc.groups.slice(0, 6).map((g) => g.id);
            expect(topSix).toContain(newestGroup.id);
            expect(responseDesc.groups[0].id).not.toBe(responseAsc.groups[0].id);
        });

        it('excludes groups where the user is not a member', async () => {
            const other = { id: 'listing-other', displayName: 'Other User' };
            seedUsers(other);

            const otherGroup = await appDriver.createGroup(
                other.id,
                new CreateGroupRequestBuilder()
                    .withName('Other Users Group')
                    .build(),
            );

            await createSequentialGroups(2);

            const response = await appDriver.listGroups(owner.id);
            const ids = response.groups.map((group) => group.id);
            expect(ids).not.toContain(otherGroup.id);
        });

        it('requires authentication', async () => {
            await expect(appDriver.listGroups('', { limit: 1 })).rejects.toThrow();
        });

        it('supports includeMetadata flag', async () => {
            await createSequentialGroups(2);

            const withoutMeta = await appDriver.listGroups(owner.id, { includeMetadata: false });
            expect(withoutMeta.metadata).toBeUndefined();

            const withMeta = await appDriver.listGroups(owner.id, { includeMetadata: true });
            if (withMeta.metadata) {
                expect(withMeta.metadata).toHaveProperty('lastChangeTimestamp');
                expect(withMeta.metadata).toHaveProperty('changeCount');
                expect(withMeta.metadata).toHaveProperty('serverTime');
            }
        });

        it('reflects expenses and settlements in listings', async () => {
            const [targetGroup] = await createSequentialGroups(1);

            await appDriver.createExpense(
                owner.id,
                new CreateExpenseRequestBuilder()
                    .withGroupId(targetGroup.id)
                    .withDescription('Listing Balances')
                    .withAmount(100, 'USD')
                    .withPaidBy(owner.id)
                    .withParticipants([owner.id])
                    .withSplitType('equal')
                    .build(),
            );

            const response = await appDriver.listGroups(owner.id);
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
                owner.id,
                new CreateGroupRequestBuilder()
                    .withName('No Expense Group')
                    .build(),
            );

            const details = await appDriver.getGroupFullDetails(owner.id, group.id);
            expect(details.group.id).toBe(group.id);

            const expenses = await appDriver.getGroupExpenses(owner.id, group.id);
            expect(expenses.expenses).toHaveLength(0);

            const balances = await appDriver.getGroupBalances(owner.id, group.id);
            if (balances.balancesByCurrency?.['EUR']) {
                expect(Number(balances.balancesByCurrency['EUR'].netBalance)).toBe(0);
            }
        });

        it('handles multiple expenses with identical participants', async () => {
            const owner = { id: 'edge-multi-owner', displayName: 'Owner' };
            seedUsers(owner);

            const group = await appDriver.createGroup(
                owner.id,
                new CreateGroupRequestBuilder()
                    .withName('Multi Expense Group')
                    .build(),
            );

            const amounts = ['50', '30', '20'];
            for (const amount of amounts) {
                await appDriver.createExpense(
                    owner.id,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withAmount(Number(amount), 'USD')
                        .withDescription(`Expense ${amount}`)
                        .withPaidBy(owner.id)
                        .withParticipants([owner.id])
                        .withSplitType('equal')
                        .build(),
                );
            }

            const expenses = await appDriver.getGroupExpenses(owner.id, group.id);
            expect(expenses.expenses).toHaveLength(3);

            const groupSummary = await appDriver.getGroup(owner.id, group.id);
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
                owner.id,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('Deletable Expense')
                    .withAmount(100, 'USD')
                    .withPaidBy(owner.id)
                    .withParticipants([owner.id, member.id])
                    .withSplitType('equal')
                    .build(),
            );

            const fullBefore = await appDriver.getExpenseFullDetails(owner.id, createdExpense.id);
            expect(fullBefore.expense.description).toBe('Deletable Expense');

            await appDriver.deleteExpense(owner.id, createdExpense.id);

            await expect(appDriver.getExpenseFullDetails(owner.id, createdExpense.id)).rejects.toThrow();
        });

        it('handles complex split scenarios', async () => {
            const owner = { id: 'edge-split-owner', displayName: 'Owner' };
            seedUsers(owner);

            const group = await appDriver.createGroup(
                owner.id,
                new CreateGroupRequestBuilder()
                    .withName('Split Group')
                    .build(),
            );

            await appDriver.createExpense(
                owner.id,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(90, 'USD')
                    .withPaidBy(owner.id)
                    .withParticipants([owner.id])
                    .withSplitType('equal')
                    .build(),
            );

            const details = await appDriver.getGroupFullDetails(owner.id, group.id);
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
                owner.id,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withDescription('Updatable Expense')
                    .withAmount(50, 'USD')
                    .withPaidBy(owner.id)
                    .withParticipants([owner.id, member.id])
                    .withSplitType('equal')
                    .build(),
            );

            const participants = [owner.id, member.id];
            await appDriver.updateExpense(
                owner.id,
                initialExpense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(80, 'USD')
                    .withDescription('Updated Expense')
                    .withParticipants(participants)
                    .withSplits(calculateEqualSplits(80, 'USD', participants))
                    .build(),
            );

            const updatedExpense = await appDriver.getExpenseFullDetails(owner.id, initialExpense.id);
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
