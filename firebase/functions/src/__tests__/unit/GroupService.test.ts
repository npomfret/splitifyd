import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupService } from '../../services/GroupService';
import { ApplicationBuilder } from '../../services/ApplicationBuilder';
import { StubFirestoreReader, StubFirestoreWriter, StubAuthService } from './mocks/firestore-stubs';
import { FirestoreGroupBuilder } from '@splitifyd/test-support';
import { ApiError } from '../../utils/errors';

// Mock logger
vi.mock('../../logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
    LoggerContext: {
        setBusinessContext: vi.fn(),
        clearBusinessContext: vi.fn(),
    },
}));

describe('GroupService - Unit Tests', () => {
    let groupService: GroupService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;
    let stubAuth: StubAuthService;
    let applicationBuilder: ApplicationBuilder;

    beforeEach(() => {
        // Create stubs
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();
        stubAuth = new StubAuthService();

        // Pass stubs directly to ApplicationBuilder constructor
        applicationBuilder = new ApplicationBuilder(stubReader, stubWriter, stubAuth);
        groupService = applicationBuilder.buildGroupService();

        vi.clearAllMocks();
    });

    describe('createGroup', () => {
        it('should create group successfully', async () => {
            const userId = 'test-user-123';
            const createGroupRequest = {
                name: 'Test Group',
                description: 'Test Description',
            };

            const expectedGroupId = 'test-group-created';

            // Mock createInTransaction to return a group ID
            vi.spyOn(stubWriter, 'createInTransaction').mockResolvedValue({
                id: expectedGroupId,
                path: `groups/${expectedGroupId}`,
            });

            // Mock getGroup to return the created group directly
            const createdGroup = new FirestoreGroupBuilder().withId(expectedGroupId).withName(createGroupRequest.name).withDescription(createGroupRequest.description).withCreatedBy(userId).build();

            vi.spyOn(stubReader, 'getGroup').mockResolvedValue(createdGroup);

            // Add group membership for balance calculation
            const membershipDoc = {
                userId: userId,
                groupId: expectedGroupId,
                memberRole: 'admin',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            stubReader.setDocument('group-members', `${expectedGroupId}_${userId}`, membershipDoc);

            const result = await groupService.createGroup(userId, createGroupRequest);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.name).toBe(createGroupRequest.name);
            expect(result.description).toBe(createGroupRequest.description);
        });
    });

    describe('getGroupFullDetails', () => {
        it('should return group when it exists and user has access', async () => {
            const userId = 'test-user-123';
            const groupId = 'test-group-456';

            // Set up test group using builder
            const testGroup = new FirestoreGroupBuilder().withId(groupId).withName('Test Group').withDescription('Test Description').withCreatedBy(userId).build();

            stubReader.setDocument('groups', groupId, testGroup);
            stubWriter.setDocument('groups', groupId, testGroup);

            // Set up group membership so user has access
            const membershipDoc = {
                userId: userId,
                groupId: groupId,
                memberRole: 'admin',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            stubReader.setDocument('group-members', `${groupId}_${userId}`, membershipDoc);
            stubWriter.setDocument('group-members', `${groupId}_${userId}`, membershipDoc);

            // Mock ExpenseService.listGroupExpenses to avoid permission issues
            const expenseService = applicationBuilder.buildExpenseService();
            vi.spyOn(expenseService, 'listGroupExpenses').mockResolvedValue({
                expenses: [],
                count: 0,
                hasMore: false,
            });

            const result = await groupService.getGroupFullDetails(groupId, userId);

            expect(result).toBeDefined();
            expect(result.group.id).toBe(groupId);
            expect(result.group.name).toBe('Test Group');
            expect(result.group.description).toBe('Test Description');
        });

        it('should throw NOT_FOUND when group does not exist', async () => {
            const userId = 'test-user-123';
            const nonExistentGroupId = 'non-existent-group';

            await expect(groupService.getGroupFullDetails(nonExistentGroupId, userId)).rejects.toThrow(ApiError);
        });
    });

    describe('updateGroup', () => {
        it('should update group successfully when user is owner', async () => {
            const userId = 'test-user-123';
            const groupId = 'test-group-456';

            // Set up existing group
            const existingGroup = new FirestoreGroupBuilder().withId(groupId).withName('Original Name').withDescription('Original Description').withCreatedBy(userId).build();

            stubReader.setDocument('groups', groupId, existingGroup);

            // Set up group membership so user has access (as owner)
            const membershipDoc = {
                userId: userId,
                groupId: groupId,
                memberRole: 'admin',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            stubReader.setDocument('group-members', `${groupId}_${userId}`, membershipDoc);

            const updateRequest = {
                name: 'Updated Name',
                description: 'Updated Description',
            };

            const result = await groupService.updateGroup(groupId, userId, updateRequest);

            expect(result).toBeDefined();
            expect(result.message).toBeDefined();
        });
    });

    describe('deleteGroup', () => {
        it('should delete group successfully when user is owner', async () => {
            const userId = 'test-user-123';
            const groupId = 'test-group-456';

            // Set up existing group (not marked for deletion yet)
            const existingGroup = new FirestoreGroupBuilder().withId(groupId).withName('Test Group').withCreatedBy(userId).build();

            stubReader.setDocument('groups', groupId, existingGroup);
            stubWriter.setDocument('groups', groupId, existingGroup);

            // Set up group membership so user has access (as owner)
            const membershipDoc = {
                userId: userId,
                groupId: groupId,
                memberRole: 'admin',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            stubReader.setDocument('group-members', `${groupId}_${userId}`, membershipDoc);

            const result = await groupService.deleteGroup(groupId, userId);

            expect(result).toBeDefined();
            expect(result.message).toBeDefined();
        });
    });

    describe('listGroups', () => {
        it('should return user groups successfully', async () => {
            const userId = 'test-user-123';

            // Set up test groups using builder
            const group1 = new FirestoreGroupBuilder().withId('group-1').withName('Group 1').withCreatedBy(userId).build();

            stubReader.setDocument('groups', 'group-1', group1);

            const result = await groupService.listGroups(userId);

            expect(result).toBeDefined();
            expect(result.groups).toBeDefined();
            expect(Array.isArray(result.groups)).toBe(true);
        });

        it('should return empty array when user has no groups', async () => {
            const userId = 'new-user-with-no-groups';

            const result = await groupService.listGroups(userId);

            expect(result).toBeDefined();
            expect(result.groups).toHaveLength(0);
        });
    });
});
