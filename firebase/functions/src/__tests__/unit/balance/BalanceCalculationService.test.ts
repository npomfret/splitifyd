import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BalanceCalculationService } from '../../../services/balance/BalanceCalculationService';
import { MockFirestoreReader } from '../../test-utils/MockFirestoreReader';

// Mock service registration  
const mockGetUsers = vi.fn();

const createMockUserService = () => ({
    getUsers: mockGetUsers
});

describe('BalanceCalculationService', () => {
    let balanceCalculationService: BalanceCalculationService;
    let mockFirestoreReader: MockFirestoreReader;
    let mockUserService: ReturnType<typeof createMockUserService>;

    beforeEach(() => {
        mockFirestoreReader = new MockFirestoreReader();
        mockUserService = createMockUserService();
        balanceCalculationService = new BalanceCalculationService(mockFirestoreReader as any, mockUserService as any);
        mockFirestoreReader.resetAllMocks();
        mockGetUsers.mockClear();
    });

    describe('fetchBalanceCalculationData', () => {
        it('should fetch all required data for balance calculation', async () => {
            const groupId = 'test-group-id';
            const userId1 = 'user-1';
            const userId2 = 'user-2';

            // Create minimal mock objects with only required fields
            const mockExpenses = [
                { 
                    id: 'expense-1', 
                    groupId,
                    description: 'Test',
                    amount: 100,
                    currency: 'USD',
                    paidBy: userId1,
                    splitType: 'equal',
                    participants: [userId1],
                    splits: [],
                    date: new Date(),
                    category: 'Food',
                    createdAt: new Date(),
                    deletedAt: null 
                },
                { 
                    id: 'expense-2', 
                    groupId,
                    description: 'Test',
                    amount: 50,
                    currency: 'USD',
                    paidBy: userId2,
                    splitType: 'equal',
                    participants: [userId2],
                    splits: [],
                    date: new Date(),
                    category: 'Food',
                    createdAt: new Date(),
                    deletedAt: null 
                }
            ];

            const mockSettlements = [
                { id: 'settlement-1' }
            ];

            const mockGroup = { 
                id: groupId, 
                name: 'Test Group',
                members: {
                    [userId1]: { userId: userId1, memberRole: 'admin', memberStatus: 'active' },
                    [userId2]: { userId: userId2, memberRole: 'member', memberStatus: 'active' }
                }
            };

            const mockUserProfiles = [
                { uid: userId1 },
                { uid: userId2 }
            ];

            const mockGroupMemberDocs = [
                { userId: userId1 },
                { userId: userId2 }
            ];

            // Set up mocks
            mockFirestoreReader.getExpensesForGroup.mockResolvedValue(mockExpenses as any);
            mockFirestoreReader.getSettlementsForGroup.mockResolvedValue(mockSettlements as any);
            mockFirestoreReader.getGroup.mockResolvedValue(mockGroup as any);
            mockGetUsers.mockResolvedValue(mockUserProfiles);
            mockFirestoreReader.getAllGroupMembers.mockResolvedValue(mockGroupMemberDocs as any);

            // Execute
            const result = await balanceCalculationService.fetchBalanceCalculationData(groupId);

            // Verify
            expect(result.groupId).toBe(groupId);
            expect(result.expenses).toHaveLength(2);
            expect(result.settlements).toHaveLength(1);
            expect(result.groupData.id).toBe(groupId);
            expect(result.groupData.name).toBe('Test Group');
            expect(result.memberProfiles).toHaveLength(2);

            // Verify service calls
            expect(mockFirestoreReader.getExpensesForGroup).toHaveBeenCalledWith(groupId);
            expect(mockFirestoreReader.getSettlementsForGroup).toHaveBeenCalledWith(groupId);
            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
        });

        it('should throw error when group is not found', async () => {
            const groupId = 'non-existent-group';

            mockFirestoreReader.getExpensesForGroup.mockResolvedValue([]);
            mockFirestoreReader.getSettlementsForGroup.mockResolvedValue([]);
            mockFirestoreReader.getGroup.mockResolvedValue(null);

            // Execute and verify error
            await expect(balanceCalculationService.fetchBalanceCalculationData(groupId))
                .rejects
                .toThrow('Group not found');
        });

        it('should throw error when group has no members', async () => {
            const groupId = 'test-group-id';

            mockFirestoreReader.getExpensesForGroup.mockResolvedValue([]);
            mockFirestoreReader.getSettlementsForGroup.mockResolvedValue([]);
            mockFirestoreReader.getGroup.mockResolvedValue({ 
                id: groupId,
                members: {}
            } as any);
            mockGetUsers.mockResolvedValue([]);
            mockFirestoreReader.getAllGroupMembers.mockResolvedValue([]);

            // Execute and verify error
            await expect(balanceCalculationService.fetchBalanceCalculationData(groupId))
                .rejects
                .toThrow(`Group ${groupId} has no members for balance calculation`);
        });

        it('should filter out soft-deleted expenses', async () => {
            const groupId = 'test-group-id';
            const userId1 = 'user-1';

            const mockExpenses = [
                { 
                    id: 'expense-1', 
                    groupId,
                    description: 'Test',
                    amount: 100,
                    currency: 'USD',
                    paidBy: userId1,
                    splitType: 'equal',
                    participants: [userId1],
                    splits: [],
                    date: new Date(),
                    category: 'Food',
                    createdAt: new Date(),
                    deletedAt: null 
                }
            ];

            mockFirestoreReader.getExpensesForGroup.mockResolvedValue(mockExpenses as any);
            mockFirestoreReader.getSettlementsForGroup.mockResolvedValue([]);
            mockFirestoreReader.getGroup.mockResolvedValue({ 
                id: groupId,
                members: {
                    [userId1]: { userId: userId1, memberRole: 'admin', memberStatus: 'active' }
                }
            } as any);
            mockGetUsers.mockResolvedValue([{ uid: userId1 }]);
            mockFirestoreReader.getAllGroupMembers.mockResolvedValue([{ userId: userId1 }] as any);

            // Execute
            const result = await balanceCalculationService.fetchBalanceCalculationData(groupId);

            // Verify only active expense is returned
            expect(result.expenses).toHaveLength(1);
            expect(result.expenses[0].id).toBe('expense-1');
            expect(result.expenses[0].deletedAt).toBeUndefined();
        });
    });
});