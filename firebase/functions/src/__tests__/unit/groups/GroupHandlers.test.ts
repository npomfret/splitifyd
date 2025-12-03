import { StubCloudTasksClient } from 'ts-firebase-simulator';
import { StubFirestoreDatabase, StubStorage } from '@billsplit-wl/test-support';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, GroupUpdateBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { GroupHandlers } from '../../../groups/GroupHandlers';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { createUnitTestServiceConfig } from '../../test-config';
import { AppDriver } from '../AppDriver';
import { StubAuthService } from '../mocks/StubAuthService';

describe('GroupHandlers - Unit Tests', () => {
    let appDriver: AppDriver;

    beforeEach(() => {
        appDriver = new AppDriver();
    });

    describe('createGroup', () => {
        it('should create a group successfully with name and description', async () => {
            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('testuser@example.com')
                .withDisplayName('Test User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(registration);
            const userId = userResult.user.uid;

            const groupRequest = new CreateGroupRequestBuilder()
                .withName('My Test Group')
                .withGroupDisplayName('Captain')
                .withDescription('A test group description')
                .build();

            const result = await appDriver.createGroup(groupRequest, userId);

            expect(result).toMatchObject({
                id: expect.any(String),
                name: 'My Test Group',
                description: 'A test group description',
                createdBy: userId,
            });
        });

        it('should create a group successfully without description', async () => {
            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('simpleuser@example.com')
                .withDisplayName('Simple User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(registration);
            const userId = userResult.user.uid;

            const groupRequest = new CreateGroupRequestBuilder()
                .withName('Simple Group')
                .withGroupDisplayName('Skipper')
                .withoutDescription()
                .build();

            const result = await appDriver.createGroup(groupRequest, userId);

            expect(result).toMatchObject({
                name: 'Simple Group',
            });
        });

        it('should reject group creation with empty name', async () => {
            const groupRequest = new CreateGroupRequestBuilder()
                .withName('')
                .build();

            await expect(appDriver.createGroup(groupRequest, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                    data: expect.objectContaining({ detail: 'INVALID_GROUP_NAME' }),
                }),
            );
        });

        it('should reject group creation with name exceeding 100 characters', async () => {
            const longName = 'a'.repeat(101);
            const groupRequest = new CreateGroupRequestBuilder()
                .withName(longName)
                .build();

            await expect(appDriver.createGroup(groupRequest, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                    data: expect.objectContaining({ detail: 'INVALID_GROUP_NAME' }),
                }),
            );
        });

        it('should reject group creation with empty display name', async () => {
            const groupRequest = new CreateGroupRequestBuilder()
                .withGroupDisplayName('')
                .build();

            await expect(appDriver.createGroup(groupRequest, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                    data: expect.objectContaining({ detail: 'INVALID_DISPLAY_NAME' }),
                }),
            );
        });

        it('should reject group creation when display name contains unsupported characters', async () => {
            const groupRequest = new CreateGroupRequestBuilder()
                .withGroupDisplayName('Name<script>')
                .build();

            await expect(appDriver.createGroup(groupRequest, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                    data: expect.objectContaining({ detail: 'INVALID_DISPLAY_NAME' }),
                }),
            );
        });

        it('should reject group creation with description exceeding 500 characters', async () => {
            const longDescription = 'a'.repeat(501);
            const groupRequest = new CreateGroupRequestBuilder()
                .withName('Test Group')
                .withDescription(longDescription)
                .build();

            await expect(appDriver.createGroup(groupRequest, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                    data: expect.objectContaining({ detail: 'INVALID_DESCRIPTION' }),
                }),
            );
        });

        it('should reject group creation with missing name field', async () => {
            const invalidRequest = CreateGroupRequestBuilder.empty().build();

            await expect(appDriver.createGroup(invalidRequest as any, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                    data: expect.objectContaining({ detail: 'INVALID_GROUP_NAME' }),
                }),
            );
        });
    });

    describe('updateGroup', () => {
        it('should update group name successfully', async () => {
            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('updateuser@example.com')
                .withDisplayName('Update User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(registration);
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Old Name')
                    .build(),
                userId,
            );

            const updateRequest = new GroupUpdateBuilder()
                .withName('New Name')
                .build();

            // Returns 204 No Content on success
            await appDriver.updateGroup(group.id, updateRequest, userId);

            // Verify the update persisted
            const updatedGroup = await appDriver.getGroupFullDetails(group.id, {}, userId);
            expect(updatedGroup.group.name).toBe('New Name');
        });

        it('should update group description successfully', async () => {
            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('descuser@example.com')
                .withDisplayName('Desc User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(registration);
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Test Group')
                    .withDescription('Old description')
                    .build(),
                userId,
            );

            const updateRequest = new GroupUpdateBuilder()
                .withDescription('New description')
                .build();

            // Returns 204 No Content on success
            await appDriver.updateGroup(group.id, updateRequest, userId);

            // Verify the update persisted
            const updatedGroup = await appDriver.getGroupFullDetails(group.id, {}, userId);
            expect(updatedGroup.group.description).toBe('New description');
        });

        it('should update both name and description', async () => {
            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('bothupdate@example.com')
                .withDisplayName('Both Update User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(registration);
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Old Name')
                    .withDescription('Old description')
                    .build(),
                userId,
            );

            const updateRequest = new GroupUpdateBuilder()
                .withName('New Name')
                .withDescription('New description')
                .build();

            // Returns 204 No Content on success
            await appDriver.updateGroup(group.id, updateRequest, userId);

            // Verify the updates persisted
            const updatedGroup = await appDriver.getGroupFullDetails(group.id, {}, userId);
            expect(updatedGroup.group.name).toBe('New Name');
            expect(updatedGroup.group.description).toBe('New description');
        });

        it('should reject update with no fields provided', async () => {
            const updateRequest = GroupUpdateBuilder.empty().build();

            await expect(appDriver.updateGroup('test-group', updateRequest, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject update with empty group ID', async () => {
            const updateRequest = new GroupUpdateBuilder()
                .withName('New Name')
                .build();

            await expect(appDriver.updateGroup('', updateRequest, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject update with name exceeding 100 characters', async () => {
            const longName = 'a'.repeat(101);
            const updateRequest = new GroupUpdateBuilder()
                .withName(longName)
                .build();

            await expect(appDriver.updateGroup('test-group', updateRequest, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                    data: expect.objectContaining({ detail: 'INVALID_GROUP_NAME' }),
                }),
            );
        });

        it('should reject update with description exceeding 500 characters', async () => {
            const longDescription = 'a'.repeat(501);
            const updateRequest = new GroupUpdateBuilder()
                .withDescription(longDescription)
                .build();

            await expect(appDriver.updateGroup('test-group', updateRequest, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                    data: expect.objectContaining({ detail: 'INVALID_DESCRIPTION' }),
                }),
            );
        });
    });

    describe('deleteGroup', () => {
        it('should delete group successfully as admin', async () => {
            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('deleteuser@example.com')
                .withDisplayName('Delete User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(registration);
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            // Returns 204 No Content on success
            await appDriver.deleteGroup(group.id, userId);

            // Verify group was deleted by trying to fetch it
            await expect(appDriver.getGroupFullDetails(group.id, {}, userId)).rejects.toThrow();
        });

        it('should reject delete with empty group ID', async () => {
            await expect(appDriver.deleteGroup('', 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject delete of non-existent group', async () => {
            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('deletenonexist@example.com')
                .withDisplayName('Delete Non Exist')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(registration);
            const userId = userResult.user.uid;

            await expect(appDriver.deleteGroup('non-existent-group', userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });
    });

    describe('listGroups', () => {
        it('should list groups for user', async () => {
            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('listuser@example.com')
                .withDisplayName('List User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(registration);
            const userId = userResult.user.uid;

            await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Group 1')
                    .build(),
                userId,
            );
            await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Group 2')
                    .build(),
                userId,
            );

            const result = await appDriver.listGroups({}, userId);

            expect(result).toMatchObject({
                groups: expect.any(Array),
            });
            expect(result.groups.length).toBeGreaterThanOrEqual(2);
        });

        it('should list groups with pagination parameters', async () => {
            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('paginationuser@example.com')
                .withDisplayName('Pagination User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(registration);
            const userId = userResult.user.uid;

            const result = await appDriver.listGroups({}, userId);

            expect(result).toHaveProperty('groups');
        });
    });

    describe('updateGroupMemberDisplayName', () => {
        it('should update member display name successfully', async () => {
            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('updatedisplay@example.com')
                .withDisplayName('Original Name')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(registration);
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            // Returns 204 No Content on success
            await appDriver.updateGroupMemberDisplayName(group.id, 'New Display Name', userId);

            // Verify the update persisted
            const groupDetails = await appDriver.getGroupFullDetails(group.id, {}, userId);
            const member = groupDetails.members.members.find((m: any) => m.uid === userId);
            expect(member?.groupDisplayName).toBe('New Display Name');
        });

        it('sanitizes group display name updates before persisting', async () => {
            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('sanitizeuser@example.com')
                .withDisplayName('Sanitize User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(registration);
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            await appDriver.updateGroupMemberDisplayName(group.id, 'Captain<script>alert(1)</script>', userId);

            const groupDetails = await appDriver.getGroupFullDetails(group.id, {}, userId);
            const member = groupDetails.members.members.find((m) => m.uid === userId);

            expect(member?.groupDisplayName).toBe('Captain');
        });

        it('should reject update with empty display name', async () => {
            await expect(appDriver.updateGroupMemberDisplayName('test-group', '', 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                    data: expect.objectContaining({ detail: 'INVALID_DISPLAY_NAME' }),
                }),
            );
        });

        it('should reject update with display name exceeding 50 characters', async () => {
            const longName = 'a'.repeat(51);

            await expect(appDriver.updateGroupMemberDisplayName('test-group', longName, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                    data: expect.objectContaining({ detail: 'INVALID_DISPLAY_NAME' }),
                }),
            );
        });

        it('should reject update with missing display name field', async () => {
            await expect(appDriver.updateGroupMemberDisplayName('test-group', undefined as any, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                    data: expect.objectContaining({ detail: 'INVALID_DISPLAY_NAME' }),
                }),
            );
        });
    });

    describe('getGroupFullDetails', () => {
        it('should return full group details with string-based amounts', async () => {
            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('detailsowner@example.com')
                .withDisplayName('Owner User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(registration);
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Adventure Squad')
                    .withGroupDisplayName('Owner User')
                    .build(),
                userId,
            );

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withAmount(120.50, 'GBP')
                .withDescription('Team dinner')
                .withLabel('food')
                .withParticipants([userId])
                .build();

            await appDriver.createExpense(expenseRequest, userId);

            const result = await appDriver.getGroupFullDetails(group.id, {}, userId);

            expect(result.group.id).toBe(group.id);
            expect(result.members.members[0]).toMatchObject({
                uid: userId,
                groupDisplayName: 'Owner User',
            });
            expect(result.expenses.expenses).toHaveLength(1);
            expect(result.expenses.expenses[0].amount).toBe('120.5');
            expect(result.expenses.expenses[0].splits[0].amount).toBe('120.50');
            expect(result.balances.lastUpdated).toBeDefined();
        });

        it('should return full group details with multiple members and expenses', async () => {
            // Register owner via API
            const ownerReg = new UserRegistrationBuilder()
                .withEmail('multiowner@example.com')
                .withDisplayName('Owner User')
                .withPassword('password12345')
                .build();
            const ownerResult = await appDriver.registerUser(ownerReg);
            const userId = ownerResult.user.uid;

            // Register member via API
            const memberReg = new UserRegistrationBuilder()
                .withEmail('multimember@example.com')
                .withDisplayName('Member User')
                .withPassword('password12345')
                .build();
            const memberResult = await appDriver.registerUser(memberReg);
            const memberId = memberResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, userId);
            await appDriver.joinGroupByLink(shareToken, undefined, memberId);

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withAmount(100, 'USD')
                .withDescription('Dinner')
                .withParticipants([userId, memberId])
                .build();

            await appDriver.createExpense(expenseRequest, userId);

            const result = await appDriver.getGroupFullDetails(group.id, {}, userId);

            expect(result.group.id).toBe(group.id);
            expect(result.members.members).toHaveLength(2);
            expect(result.expenses.expenses).toHaveLength(1);
            expect(result.balances).toBeDefined();
        });

        it('should include soft-deleted expenses only when includeDeletedExpenses is true', async () => {
            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('deletedowner@example.com')
                .withDisplayName('Deleted Owner')
                .withPassword('password12345')
                .build();
            const ownerResult = await appDriver.registerUser(registration);
            const ownerId = ownerResult.user.uid;

            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Include Deleted Expenses Group')
                    .build(),
                ownerId,
            );

            const activeExpenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(ownerId)
                .withParticipants([ownerId])
                .withSplitType('equal')
                .withAmount(75, 'USD')
                .withDescription('Active dinner expense')
                .build();
            await appDriver.createExpense(activeExpenseRequest, ownerId);

            const deletedExpenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(ownerId)
                .withParticipants([ownerId])
                .withSplitType('equal')
                .withAmount(120, 'USD')
                .withDescription('Soft-deleted tour deposit')
                .build();
            const deletedExpense = await appDriver.createExpense(deletedExpenseRequest, ownerId);
            await appDriver.deleteExpense(deletedExpense.id, ownerId);

            const defaultDetails = await appDriver.getGroupFullDetails(group.id, {}, ownerId);
            const defaultDescriptions = defaultDetails.expenses.expenses.map((expense) => expense.description);
            expect(defaultDescriptions).toContain('Active dinner expense');
            expect(defaultDescriptions).not.toContain('Soft-deleted tour deposit');
            expect(defaultDetails.expenses.expenses.every((expense) => expense.deletedAt === null)).toBe(true);

            const detailsWithDeleted = await appDriver.getGroupFullDetails(group.id, {
                includeDeletedExpenses: true,
            }, ownerId);
            const withDeletedDescriptions = detailsWithDeleted.expenses.expenses.map((expense) => expense.description);
            expect(withDeletedDescriptions).toContain('Active dinner expense');
            expect(withDeletedDescriptions).toContain('Soft-deleted tour deposit');

            const resurrectedExpense = detailsWithDeleted.expenses.expenses.find((expense) => expense.description === 'Soft-deleted tour deposit');
            expect(resurrectedExpense?.deletedAt).not.toBeNull();
            expect(resurrectedExpense?.deletedBy).toBe(ownerId);
        });
    });

    describe('Static Factory Method', () => {
        it('should create GroupHandlers instance with GroupService and FirestoreWriter', () => {
            const db = new StubFirestoreDatabase();
            const authService = new StubAuthService();
            const componentBuilder = new ComponentBuilder(
                authService,
                db,
                new StubStorage({ defaultBucketName: 'test-bucket' }),
                new StubCloudTasksClient(),
                createUnitTestServiceConfig(),
            );

            const handlers = new GroupHandlers(componentBuilder.buildGroupService());
            expect(handlers).toBeInstanceOf(GroupHandlers);
            expect(handlers.createGroup).toBeDefined();
            expect(handlers.updateGroup).toBeDefined();
            expect(handlers.deleteGroup).toBeDefined();
            expect(handlers.listGroups).toBeDefined();
            expect(handlers.updateGroupMemberDisplayName).toBeDefined();
        });
    });
});
