import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, GroupUpdateBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { GroupHandlers } from '../../../groups/GroupHandlers';
import { AppDriver } from '../AppDriver';

describe('GroupHandlers - Unit Tests', () => {
    let appDriver: AppDriver;

    beforeEach(() => {
        appDriver = new AppDriver();
    });

    describe('createGroup', () => {
        it('should create a group successfully with name and description', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, { displayName: 'Test User' });

            const groupRequest = new CreateGroupRequestBuilder()
                .withName('My Test Group')
                .withDescription('A test group description')
                .build();

            const result = await appDriver.createGroup(userId, groupRequest);

            expect(result).toMatchObject({
                id: expect.any(String),
                name: 'My Test Group',
                description: 'A test group description',
                createdBy: userId,
            });
        });

        it('should create a group successfully without description', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, { displayName: 'Test User' });

            const groupRequest = new CreateGroupRequestBuilder()
                .withName('Simple Group')
                .build();
            delete (groupRequest as any).description;

            const result = await appDriver.createGroup(userId, groupRequest);

            expect(result).toMatchObject({
                name: 'Simple Group',
            });
        });

        it('should reject group creation with empty name', async () => {
            const groupRequest = new CreateGroupRequestBuilder()
                .withName('')
                .build();

            await expect(appDriver.createGroup('test-user', groupRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject group creation with name exceeding 100 characters', async () => {
            const longName = 'a'.repeat(101);
            const groupRequest = new CreateGroupRequestBuilder()
                .withName(longName)
                .build();

            await expect(appDriver.createGroup('test-user', groupRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject group creation with description exceeding 500 characters', async () => {
            const longDescription = 'a'.repeat(501);
            const groupRequest = new CreateGroupRequestBuilder()
                .withName('Test Group')
                .withDescription(longDescription)
                .build();

            await expect(appDriver.createGroup('test-user', groupRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject group creation with missing name field', async () => {
            const invalidRequest = {};

            await expect(appDriver.createGroup('test-user', invalidRequest as any)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });
    });

    describe('updateGroup', () => {
        it('should update group name successfully', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, { displayName: 'Test User' });

            const group = await appDriver.createGroup(
                userId,
                new CreateGroupRequestBuilder()
                    .withName('Old Name')
                    .build(),
            );

            const updateRequest = new GroupUpdateBuilder()
                .withName('New Name')
                .build();

            const result = await appDriver.updateGroup(userId, group.id, updateRequest);

            expect(result).toMatchObject({
                message: 'Group updated successfully',
            });
        });

        it('should update group description successfully', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, { displayName: 'Test User' });

            const group = await appDriver.createGroup(
                userId,
                new CreateGroupRequestBuilder()
                    .withName('Test Group')
                    .withDescription('Old description')
                    .build(),
            );

            const updateRequest = new GroupUpdateBuilder()
                .withDescription('New description')
                .build();

            const result = await appDriver.updateGroup(userId, group.id, updateRequest);

            expect(result).toMatchObject({
                message: 'Group updated successfully',
            });
        });

        it('should update both name and description', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, { displayName: 'Test User' });

            const group = await appDriver.createGroup(
                userId,
                new CreateGroupRequestBuilder()
                    .withName('Old Name')
                    .withDescription('Old description')
                    .build(),
            );

            const updateRequest = new GroupUpdateBuilder()
                .withName('New Name')
                .withDescription('New description')
                .build();

            const result = await appDriver.updateGroup(userId, group.id, updateRequest);

            expect(result).toMatchObject({
                message: 'Group updated successfully',
            });
        });

        it('should reject update with no fields provided', async () => {
            const updateRequest = {};

            await expect(appDriver.updateGroup('test-user', 'test-group', updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with empty group ID', async () => {
            const updateRequest = new GroupUpdateBuilder()
                .withName('New Name')
                .build();

            await expect(appDriver.updateGroup('test-user', '', updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with name exceeding 100 characters', async () => {
            const longName = 'a'.repeat(101);
            const updateRequest = new GroupUpdateBuilder()
                .withName(longName)
                .build();

            await expect(appDriver.updateGroup('test-user', 'test-group', updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with description exceeding 500 characters', async () => {
            const longDescription = 'a'.repeat(501);
            const updateRequest = new GroupUpdateBuilder()
                .withDescription(longDescription)
                .build();

            await expect(appDriver.updateGroup('test-user', 'test-group', updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });
    });

    describe('deleteGroup', () => {
        it('should delete group successfully as admin', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, { displayName: 'Test User' });

            const group = await appDriver.createGroup(userId);

            const result = await appDriver.deleteGroup(userId, group.id);

            expect(result).toMatchObject({
                message: 'Group deleted successfully',
            });
        });

        it('should reject delete with empty group ID', async () => {
            await expect(appDriver.deleteGroup('test-user', '')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject delete of non-existent group', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, { displayName: 'Test User' });

            await expect(appDriver.deleteGroup(userId, 'non-existent-group')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });
    });

    describe('listGroups', () => {
        it('should list groups for user', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, { displayName: 'Test User' });

            await appDriver.createGroup(
                userId,
                new CreateGroupRequestBuilder()
                    .withName('Group 1')
                    .build(),
            );
            await appDriver.createGroup(
                userId,
                new CreateGroupRequestBuilder()
                    .withName('Group 2')
                    .build(),
            );

            const result = await appDriver.listGroups(userId);

            expect(result).toMatchObject({
                groups: expect.any(Array),
            });
            expect(result.groups.length).toBeGreaterThanOrEqual(2);
        });

        it('should list groups with pagination parameters', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, { displayName: 'Test User' });

            const result = await appDriver.listGroups(userId);

            expect(result).toHaveProperty('groups');
        });
    });

    describe('updateGroupMemberDisplayName', () => {
        it('should update member display name successfully', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, { displayName: 'Original Name' });

            const group = await appDriver.createGroup(userId);

            const result = await appDriver.updateGroupMemberDisplayName(userId, group.id, 'New Display Name');

            expect(result).toMatchObject({
                message: 'Display name updated successfully',
            });
        });

        it('should reject update with empty display name', async () => {
            await expect(appDriver.updateGroupMemberDisplayName('test-user', 'test-group', '')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with display name exceeding 50 characters', async () => {
            const longName = 'a'.repeat(51);

            await expect(appDriver.updateGroupMemberDisplayName('test-user', 'test-group', longName)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with missing display name field', async () => {
            await expect(appDriver.updateGroupMemberDisplayName('test-user', 'test-group', undefined as any)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });
    });

    describe('getGroupFullDetails', () => {
        it('should return full group details with string-based amounts', async () => {
            const userId = 'details-owner';
            appDriver.seedUser(userId, { displayName: 'Owner User', email: 'owner@example.com' });

            const group = await appDriver.createGroup(
                userId,
                new CreateGroupRequestBuilder()
                    .withName('Adventure Squad')
                    .build(),
            );

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withAmount(120.50, 'GBP')
                .withDescription('Team dinner')
                .withCategory('food')
                .withParticipants([userId])
                .build();

            await appDriver.createExpense(userId, expenseRequest);

            const result = await appDriver.getGroupFullDetails(userId, group.id);

            expect(result.group.id).toBe(group.id);
            expect(result.members.members[0]).toMatchObject({
                uid: userId,
                displayName: 'Owner User',
            });
            expect(result.expenses.expenses).toHaveLength(1);
            expect(result.expenses.expenses[0].amount).toBe('120.5');
            expect(result.expenses.expenses[0].splits[0].amount).toBe('120.50');
            expect(result.balances.lastUpdated).toBeDefined();
        });

        it('should return full group details with multiple members and expenses', async () => {
            const userId = 'owner';
            const memberId = 'member';

            appDriver.seedUser(userId, { displayName: 'Owner User' });
            appDriver.seedUser(memberId, { displayName: 'Member User' });

            const group = await appDriver.createGroup(userId);
            const { linkId } = await appDriver.generateShareableLink(userId, group.id);
            await appDriver.joinGroupByLink(memberId, linkId);

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withAmount(100, 'USD')
                .withDescription('Dinner')
                .withParticipants([userId, memberId])
                .build();

            await appDriver.createExpense(userId, expenseRequest);

            const result = await appDriver.getGroupFullDetails(userId, group.id);

            expect(result.group.id).toBe(group.id);
            expect(result.members.members).toHaveLength(2);
            expect(result.expenses.expenses).toHaveLength(1);
            expect(result.balances).toBeDefined();
        });

        it('should include soft-deleted expenses only when includeDeletedExpenses is true', async () => {
            const ownerId = 'include-deleted-owner';
            appDriver.seedUser(ownerId, { displayName: 'Owner User' });

            const group = await appDriver.createGroup(
                ownerId,
                new CreateGroupRequestBuilder()
                    .withName('Include Deleted Expenses Group')
                    .build(),
            );

            const activeExpenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(ownerId)
                .withParticipants([ownerId])
                .withSplitType('equal')
                .withAmount(75, 'USD')
                .withDescription('Active dinner expense')
                .build();
            await appDriver.createExpense(ownerId, activeExpenseRequest);

            const deletedExpenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(ownerId)
                .withParticipants([ownerId])
                .withSplitType('equal')
                .withAmount(120, 'USD')
                .withDescription('Soft-deleted tour deposit')
                .build();
            const deletedExpense = await appDriver.createExpense(ownerId, deletedExpenseRequest);
            await appDriver.deleteExpense(ownerId, deletedExpense.id);

            const defaultDetails = await appDriver.getGroupFullDetails(ownerId, group.id);
            const defaultDescriptions = defaultDetails.expenses.expenses.map((expense) => expense.description);
            expect(defaultDescriptions).toContain('Active dinner expense');
            expect(defaultDescriptions).not.toContain('Soft-deleted tour deposit');
            expect(defaultDetails.expenses.expenses.every((expense) => expense.deletedAt === null)).toBe(true);

            const detailsWithDeleted = await appDriver.getGroupFullDetails(ownerId, group.id, {
                includeDeletedExpenses: true,
            });
            const withDeletedDescriptions = detailsWithDeleted.expenses.expenses.map((expense) => expense.description);
            expect(withDeletedDescriptions).toContain('Active dinner expense');
            expect(withDeletedDescriptions).toContain('Soft-deleted tour deposit');

            const resurrectedExpense = detailsWithDeleted.expenses.expenses.find((expense) => expense.description === 'Soft-deleted tour deposit');
            expect(resurrectedExpense?.deletedAt).not.toBeNull();
            expect(resurrectedExpense?.deletedBy).toBe(ownerId);
        });
    });

    describe('Static Factory Method', () => {
        it('should create GroupHandlers instance with default ApplicationBuilder', () => {
            const handlers = GroupHandlers.createGroupHandlers();
            expect(handlers).toBeInstanceOf(GroupHandlers);
            expect(handlers.createGroup).toBeDefined();
            expect(handlers.updateGroup).toBeDefined();
            expect(handlers.deleteGroup).toBeDefined();
            expect(handlers.listGroups).toBeDefined();
            expect(handlers.updateGroupMemberDisplayName).toBeDefined();
        });
    });
});
