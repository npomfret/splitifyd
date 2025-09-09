import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupService } from '../../services/GroupService';
import { MockFirestoreReader } from '../test-utils/MockFirestoreReader';
import { FirestoreGroupBuilder, FirestoreExpenseBuilder } from '@splitifyd/test-support';
import {SettlementService} from "../../services/SettlementService";
import {GroupMemberService} from "../../services/GroupMemberService";
import {GroupShareService} from "../../services/GroupShareService";

// Create mock services for GroupService dependencies
const createMockUserService = () => ({
    getUsers: vi.fn().mockResolvedValue(new Map()),
    getUser: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    deleteAccount: vi.fn(),
    registerUser: vi.fn(),
    createUserDirect: vi.fn(),
    getAllGroupMembers: vi.fn().mockResolvedValue([])
});

const createMockExpenseService = () => ({
    listGroupExpenses: vi.fn(),
    getExpense: vi.fn(),
    createExpense: vi.fn(),
    updateExpense: vi.fn(),
    deleteExpense: vi.fn()
});

const createMockSettlementService = () => ({
    listSettlements: vi.fn(),
    getSettlement: vi.fn(),
    createSettlement: vi.fn(),
    updateSettlement: vi.fn(),
    deleteSettlement: vi.fn()
});

const createMockGroupMemberService = () => ({
    isGroupMemberAsync: vi.fn().mockResolvedValue(true),
    isGroupOwnerAsync: vi.fn().mockResolvedValue(true),
    getGroupMember: vi.fn(),
    getAllGroupMembers: vi.fn().mockResolvedValue([]),
    getGroupMembersResponseFromSubcollection: vi.fn()
});

const createMockNotificationService = () => ({
    initializeUserNotifications: vi.fn(),
    updateUserNotification: vi.fn(),
    getUserNotifications: vi.fn()
});

const createMockExpenseMetadataService = () => ({
    calculateExpenseMetadata: vi.fn().mockResolvedValue({
        expenseCount: 0,
        lastExpenseTime: undefined,
    })
});

const createMockGroupShareService = () => ({
    generateShareableLink: vi.fn(),
    previewGroupByLink: vi.fn(),
    joinGroupByLink: vi.fn()
});

// Mock Firebase dependencies
vi.mock('../../firebase', () => ({
    getFirestore: vi.fn(() => ({
        collection: vi.fn(() => ({
            doc: vi.fn(() => ({
                get: vi.fn(),
                set: vi.fn(),
                update: vi.fn(),
                delete: vi.fn()
            }))
        }))
    }))
}));

describe('GroupService - Unit Tests', () => {
    let groupService: GroupService;
    let mockFirestoreReader: MockFirestoreReader;
    let mockFirestoreWriter: any;
    let mockUserService: ReturnType<typeof createMockUserService>;
    let mockExpenseService: ReturnType<typeof createMockExpenseService>;
    let mockSettlementService: ReturnType<typeof createMockSettlementService>;
    let mockGroupMemberService: ReturnType<typeof createMockGroupMemberService>;
    let mockNotificationService: ReturnType<typeof createMockNotificationService>;
    let mockExpenseMetadataService: ReturnType<typeof createMockExpenseMetadataService>;
    let mockGroupShareService: ReturnType<typeof createMockGroupShareService>;

    beforeEach(() => {
        mockFirestoreReader = new MockFirestoreReader();
        mockFirestoreWriter = {
            runTransaction: vi.fn(),
            bulkDelete: vi.fn(),
            createInTransaction: vi.fn(),
            updateInTransaction: vi.fn(),
            deleteInTransaction: vi.fn(),
            createUser: vi.fn(),
            updateUser: vi.fn(),
            deleteUser: vi.fn()
        };
        
        mockUserService = createMockUserService();
        mockExpenseService = createMockExpenseService();
        mockSettlementService = createMockSettlementService();
        mockGroupMemberService = createMockGroupMemberService();
        mockNotificationService = createMockNotificationService();
        mockExpenseMetadataService = createMockExpenseMetadataService();
        mockGroupShareService = createMockGroupShareService();
        
        groupService = new GroupService(
            mockFirestoreReader,
            mockFirestoreWriter,
            mockUserService as any,
            mockExpenseService as any,
            mockSettlementService as any,
            mockGroupMemberService as any,
            mockNotificationService as any,
            mockExpenseMetadataService as any,
            mockGroupShareService as any
        );

        // Reset all mocks
        vi.clearAllMocks();
        mockFirestoreReader.resetAllMocks();
        
        // Set up default mock implementations after clearing
        mockFirestoreWriter.bulkDelete.mockResolvedValue({
            successCount: 1,
            failureCount: 0,
            results: [{ id: 'test-group-123', success: true }]
        });
        
        // Default mock for ExpenseMetadataService dependency
        mockFirestoreReader.getExpensesForGroup.mockResolvedValue([]);
        mockFirestoreReader.getSettlementsForGroup.mockResolvedValue([]);
        
        // Mock expense metadata service
        mockExpenseMetadataService.calculateExpenseMetadata.mockResolvedValue({});
    });

    describe('fetchGroupWithAccess', () => {
        it('should return group data when group exists and user has access', async () => {
            const groupId = 'test-group-123';
            const userId = 'test-user-123';
            const mockGroupData = new FirestoreGroupBuilder()
                .withId(groupId)
                .withName('Test Group')
                .build();

            mockFirestoreReader.getGroup.mockResolvedValue(mockGroupData);
            // Mock user access - make sure user is a member
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(true);
            // Mock members for balance calculation
            mockUserService.getAllGroupMembers.mockResolvedValue([
                { userId: userId, memberRole: 'member', memberStatus: 'active' }
            ]);

            // Access the private method via type assertion
            const result = await (groupService as any).fetchGroupWithAccess(groupId, userId);

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
            expect(result.group).toBeDefined();
            expect(result.group.id).toBe(groupId);
            expect(result.group.name).toBe('Test Group');
        });

        it('should throw NOT_FOUND error when group does not exist', async () => {
            const groupId = 'nonexistent-group';
            const userId = 'test-user-123';

            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(
                (groupService as any).fetchGroupWithAccess(groupId, userId)
            ).rejects.toThrow('Group not found');
        });
    });

    describe('deleteGroup', () => {
        it('should delete group when no expenses exist', async () => {
            const groupId = 'test-group-123';
            const userId = 'test-user-123';
            
            const mockGroupData = new FirestoreGroupBuilder()
                .withId(groupId)
                .build();

            mockFirestoreReader.getGroup.mockResolvedValue(mockGroupData);
            // Mock user as group owner for write access
            mockGroupMemberService.isGroupOwnerAsync.mockResolvedValue(true);
            // Mock members for balance calculation
            mockUserService.getAllGroupMembers.mockResolvedValue([
                { userId: userId, memberRole: 'admin', memberStatus: 'active' }
            ]);
            
            // Mock the getGroupDeletionData method with empty QuerySnapshot-like objects
            const mockEmptyQuerySnapshot = {
                size: 0,
                docs: [],
                forEach: vi.fn(),
                empty: true
            } as any;

            mockFirestoreReader.getGroupDeletionData.mockResolvedValue({
                expenses: mockEmptyQuerySnapshot,
                settlements: mockEmptyQuerySnapshot,
                transactionChanges: mockEmptyQuerySnapshot,
                balanceChanges: mockEmptyQuerySnapshot,
                shareLinks: mockEmptyQuerySnapshot,
                groupComments: mockEmptyQuerySnapshot,
                expenseComments: []
            });

            const result = await groupService.deleteGroup(groupId, userId);

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
            expect(mockFirestoreReader.getGroupDeletionData).toHaveBeenCalledWith(groupId);
            expect(result.message).toBe('Group and all associated data deleted permanently');
        });

        it('should successfully delete group with expenses (hard delete)', async () => {
            const groupId = 'test-group-123';
            const userId = 'test-user-123';
            
            const mockGroupData = new FirestoreGroupBuilder()
                .withId(groupId)
                .build();

            const mockExpense = new FirestoreExpenseBuilder()
                .withId('expense-1')
                .withGroupId(groupId)
                .withCreatedBy(userId)
                .withPaidBy(userId)
                .withAmount(100)
                .withCurrency('USD')
                .withDescription('Test Expense')
                .withCategory('general')
                .withSplitType('equal')
                .withParticipants([userId])
                .build();

            mockFirestoreReader.getGroup.mockResolvedValue(mockGroupData);
            // Mock user as group owner for write access
            mockGroupMemberService.isGroupOwnerAsync.mockResolvedValue(true);
            // Mock members for balance calculation
            mockUserService.getAllGroupMembers.mockResolvedValue([
                { userId: userId, memberRole: 'admin', memberStatus: 'active' }
            ]);
            
            // Mock the getGroupDeletionData method with QuerySnapshot containing expense
            const mockExpenseQuerySnapshot = {
                size: 1,
                docs: [{
                    ref: { path: 'expenses/expense-1' },
                    id: 'expense-1',
                    data: () => mockExpense
                }],
                forEach: vi.fn(),
                empty: false
            } as any;

            const mockEmptyQuerySnapshot = {
                size: 0,
                docs: [],
                forEach: vi.fn(),
                empty: true
            } as any;

            mockFirestoreReader.getGroupDeletionData.mockResolvedValue({
                expenses: mockExpenseQuerySnapshot,
                settlements: mockEmptyQuerySnapshot,
                transactionChanges: mockEmptyQuerySnapshot,
                balanceChanges: mockEmptyQuerySnapshot,
                shareLinks: mockEmptyQuerySnapshot,
                groupComments: mockEmptyQuerySnapshot,
                expenseComments: []
            });

            const result = await groupService.deleteGroup(groupId, userId);

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
            expect(mockFirestoreReader.getGroupDeletionData).toHaveBeenCalledWith(groupId);
            expect(result.message).toBe('Group and all associated data deleted permanently');
        });
    });

    describe('getGroupBalances', () => {
        it('should return group balances for valid group and user', async () => {
            const groupId = 'test-group-123';
            const userId = 'test-user-123';
            
            const mockGroupData = new FirestoreGroupBuilder()
                .withId(groupId)
                .build();

            mockFirestoreReader.getGroup.mockResolvedValue(mockGroupData);
            
            // Mock required data for balance calculations
            mockFirestoreReader.getExpensesForGroup.mockResolvedValue([]);
            mockFirestoreReader.getSettlementsForGroup.mockResolvedValue([]);
            
            // Mock getUsers to return a Map with the user
            const mockUserProfile = { uid: userId, email: 'test@example.com', displayName: 'Test User' };
            const userProfilesMap = new Map([[userId, mockUserProfile]]);
            mockUserService.getUsers.mockResolvedValue(userProfilesMap);
            
            // Mock group member check to return true (user is a member)
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(true);
            
            // Mock group members for balance calculation (DataFetcher calls userService.getAllGroupMembers)
            mockUserService.getAllGroupMembers.mockResolvedValue([
                { userId: userId, memberRole: 'member', memberStatus: 'active' }
            ]);

            const result = await groupService.getGroupBalances(groupId, userId);

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
            expect(result.groupId).toBe(groupId);
            expect(result).toHaveProperty('userBalances');
            expect(result).toHaveProperty('simplifiedDebts');
            expect(result).toHaveProperty('lastUpdated');
            expect(result).toHaveProperty('balancesByCurrency');
        });

        it('should throw NOT_FOUND error when group does not exist', async () => {
            const groupId = 'nonexistent-group';
            const userId = 'test-user-123';

            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(
                groupService.getGroupBalances(groupId, userId)
            ).rejects.toThrow('Group not found');
        });
    });

    describe('batchFetchGroupData', () => {
        it('should return empty maps for empty group list', async () => {
            const result = await (groupService as any).batchFetchGroupData([]);

            expect(result.expensesByGroup.size).toBe(0);
            expect(result.settlementsByGroup.size).toBe(0);
            expect(result.expenseMetadataByGroup.size).toBe(0);
        });

        it('should batch fetch expenses and settlements for multiple groups', async () => {
            const groupIds = ['group1', 'group2'];
            
            const mockExpense1 = new FirestoreExpenseBuilder()
                .withId('expense-1')
                .withGroupId('group1')
                .withCreatedBy('user1')
                .withPaidBy('user1')
                .withAmount(100)
                .withCurrency('USD')
                .withDescription('Test Expense 1')
                .withCategory('general')
                .withSplitType('equal')
                .withParticipants(['user1'])
                .build();

            mockFirestoreReader.getExpensesForGroup
                .mockResolvedValueOnce([mockExpense1])
                .mockResolvedValueOnce([]);

            mockFirestoreReader.getSettlementsForGroup
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            const result = await (groupService as any).batchFetchGroupData(groupIds);

            expect(mockFirestoreReader.getExpensesForGroup).toHaveBeenCalledTimes(2);
            expect(mockFirestoreReader.getSettlementsForGroup).toHaveBeenCalledTimes(2);
            expect(result.expensesByGroup.has('group1')).toBe(true);
            expect(result.expensesByGroup.get('group1')).toHaveLength(1);
            expect(result.expenseMetadataByGroup.has('group1')).toBe(true);
            expect(result.expenseMetadataByGroup.get('group1')?.count).toBe(1);
        });
    });
});