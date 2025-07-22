import { apiService, apiCall } from './api';
import type { 
    CreateGroupRequest, 
    CreateExpenseRequest, 
    UpdateExpenseRequest,
    ExpenseData,
    GroupBalances,
    ShareableLinkResponse,
    JoinGroupResponse
} from './types/api';

// Mock the api-client
jest.mock('./api-client', () => ({
    apiClient: {
        request: jest.fn()
    }
}));

// Mock auth manager
jest.mock('./auth', () => ({
    authManager: {
        getUserId: jest.fn().mockReturnValue('mock-user-id')
    }
}));

// Mock localStorage methods
const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
};

// Mock localStorage methods using spies
jest.spyOn(Storage.prototype, 'getItem').mockImplementation(mockLocalStorage.getItem);
jest.spyOn(Storage.prototype, 'setItem').mockImplementation(mockLocalStorage.setItem);
jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(mockLocalStorage.removeItem);

// Import after mocks are set up
import { apiClient } from './api-client';

describe('ApiService', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue('mock-token');
    });

    describe('getGroups', () => {
        it('should fetch groups data', async () => {
            const mockResponse = {
                groups: [
                    {
                        id: 'group-1',
                        name: 'Test Group',
                        description: 'Test description',
                        memberCount: 2,
                        balance: {
                            userBalance: {
                                userId: 'user-1',
                                name: 'User 1',
                                owes: {},
                                owedBy: { 'user-2': 50 },
                                netBalance: 50
                            },
                            totalOwed: 50,
                            totalOwing: 0
                        },
                        lastActivity: '2 hours ago',
                        lastActivityRaw: '2023-01-01T00:00:00Z',
                        lastExpense: {
                            description: 'Pizza',
                            amount: 100,
                            date: '2023-01-01'
                        },
                        expenseCount: 5
                    }
                ],
                count: 1,
                hasMore: false,
                pagination: {
                    limit: 20,
                    order: 'desc' as const
                }
            };

            (apiClient.request as jest.Mock).mockResolvedValue(mockResponse);

            const result = await apiService.getGroups();

            expect(apiClient.request).toHaveBeenCalledWith('/groups', {
                method: 'GET'
            });

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                id: 'group-1',
                name: 'Test Group',
                memberCount: 2,
                balance: {
                    userBalance: {
                        netBalance: 50
                    }
                },
                expenseCount: 5
            });
        });

        it('should handle empty groups array', async () => {
            (apiClient.request as jest.Mock).mockResolvedValue({ 
                groups: [],
                count: 0,
                hasMore: false,
                pagination: { limit: 20, order: 'desc' }
            });

            const result = await apiService.getGroups();

            expect(result).toEqual([]);
        });

        it('should propagate API errors', async () => {
            const error = new Error('API Error');
            (apiClient.request as jest.Mock).mockRejectedValue(error);

            await expect(apiService.getGroups()).rejects.toThrow('API Error');
        });
    });

    describe('createGroup', () => {
        it('should create a group with valid data', async () => {
            const groupData: CreateGroupRequest = {
                name: 'New Group',
                description: 'Test description',
                memberEmails: ['user@example.com']
            };

            const mockResponse = {
                id: 'new-group-id',
                name: 'New Group',
                description: 'Test description',
                createdBy: 'user-1',
                memberIds: ['user-1'],
                memberEmails: ['user@example.com'],
                members: [{ uid: 'user-1', name: 'User 1', initials: 'U1' }],
                expenseCount: 0,
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z'
            };
            (apiClient.request as jest.Mock).mockResolvedValue(mockResponse);

            const result = await apiService.createGroup(groupData);

            expect((apiClient.request as jest.Mock)).toHaveBeenCalledWith('/groups', {
                method: 'POST',
                body: JSON.stringify({
                    name: 'New Group',
                    description: 'Test description',
                    memberEmails: ['user@example.com']
                })
            });

            expect(result).toMatchObject({
                id: 'new-group-id',
                name: 'New Group',
                description: 'Test description'
            });
        });

        it('should throw error for empty group name', async () => {
            const groupData: CreateGroupRequest = {
                name: '',
                description: 'Test'
            };

            await expect(apiService.createGroup(groupData)).rejects.toThrow('Group name is required');
        });

        it('should trim whitespace from group name', async () => {
            const groupData: CreateGroupRequest = {
                name: '  Trimmed Group  ',
                description: ''
            };

            const mockResponse = {
                id: 'test-id',
                name: 'Trimmed Group',
                description: '',
                createdBy: 'user-1',
                memberIds: ['user-1'],
                memberEmails: [],
                members: [],
                expenseCount: 0,
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z'
            };

            (apiClient.request as jest.Mock).mockResolvedValue(mockResponse);

            await apiService.createGroup(groupData);

            expect((apiClient.request as jest.Mock)).toHaveBeenCalledWith('/groups', {
                method: 'POST',
                body: JSON.stringify({
                    name: 'Trimmed Group',
                    description: '',
                    memberEmails: []
                })
            });
        });
    });

    describe('getGroup', () => {
        it('should fetch group details by ID', async () => {
            const mockResponse = {
                id: 'group-1',
                name: 'Test Group',
                description: 'Test description',
                createdBy: 'user-1',
                memberIds: ['user-1'],
                memberEmails: [],
                members: [],
                expenseCount: 0,
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z'
            };

            (apiClient.request as jest.Mock).mockResolvedValue(mockResponse);

            const result = await apiService.getGroup('group-1');

            expect((apiClient.request as jest.Mock)).toHaveBeenCalledWith('/groups/group-1', {
                method: 'GET'
            });

            expect(result.data).toMatchObject({
                id: 'group-1',
                name: 'Test Group',
                description: 'Test description'
            });
        });

        it('should throw error for empty group ID', async () => {
            await expect(apiService.getGroup('')).rejects.toThrow('Group ID is required');
        });
    });

    describe('deleteGroup', () => {
        it('should delete group successfully', async () => {
            (apiClient.request as jest.Mock).mockResolvedValue({});

            const result = await apiService.deleteGroup('group-1');

            expect((apiClient.request as jest.Mock)).toHaveBeenCalledWith('/groups/group-1', {
                method: 'DELETE'
            });

            expect(result).toEqual({ success: true });
        });
    });

    describe('getGroupBalances', () => {
        it('should fetch group balances', async () => {
            const mockBalances: GroupBalances = {
                groupId: 'group-1',
                userBalances: {
                    'user-1': {
                        userId: 'user-1',
                        name: 'User 1',
                        owes: {},
                        owedBy: { 'user-2': 50 },
                        netBalance: 50
                    },
                    'user-2': {
                        userId: 'user-2',
                        name: 'User 2',
                        owes: { 'user-1': 50 },
                        owedBy: {},
                        netBalance: -50
                    }
                },
                simplifiedDebts: [
                    {
                        from: { userId: 'user-2', name: 'User 2' },
                        to: { userId: 'user-1', name: 'User 1' },
                        amount: 50
                    }
                ],
                lastUpdated: '2023-01-01T00:00:00Z'
            };

            (apiClient.request as jest.Mock).mockResolvedValue(mockBalances);

            const result = await apiService.getGroupBalances('group-1');

            expect((apiClient.request as jest.Mock)).toHaveBeenCalledWith('/groups/balances?groupId=group-1', {
                method: 'GET'
            });

            expect(result.data).toEqual(mockBalances);
        });
    });

    describe('getGroupExpenses', () => {
        it('should fetch group expenses with default pagination', async () => {
            const mockExpenses = {
                expenses: [
                    { id: 'expense-1', description: 'Test expense', amount: 100 }
                ],
                hasMore: false
            };

            (apiClient.request as jest.Mock).mockResolvedValue(mockExpenses);

            const result = await apiService.getGroupExpenses('group-1');

            expect((apiClient.request as jest.Mock)).toHaveBeenCalledWith('/expenses/group?groupId=group-1&limit=20', {
                method: 'GET'
            });

            expect(result.expenses).toEqual(mockExpenses.expenses);
            expect(result.hasMore).toBe(false);
        });

        it('should fetch group expenses with custom pagination', async () => {
            const mockExpenses = { 
                expenses: [], 
                hasMore: true, 
                cursor: 'next-cursor' 
            };
            (apiClient.request as jest.Mock).mockResolvedValue(mockExpenses);

            await apiService.getGroupExpenses('group-1', 10, 'some-cursor');

            expect((apiClient.request as jest.Mock)).toHaveBeenCalledWith('/expenses/group?groupId=group-1&limit=10&cursor=some-cursor', {
                method: 'GET'
            });
        });
    });

    describe('createExpense', () => {
        it('should create an expense', async () => {
            const expenseData: CreateExpenseRequest = {
                groupId: 'group-1',
                description: 'Test expense',
                amount: 100,
                paidBy: 'user-1',
                category: 'food',
                date: '2023-01-01',
                splitType: 'equal',
                participants: ['user-1', 'user-2']
            };

            const mockResponse: ExpenseData = {
                id: 'expense-1',
                ...expenseData,
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z',
                createdBy: 'user-1',
                splits: []
            };

            (apiClient.request as jest.Mock).mockResolvedValue(mockResponse);

            const result = await apiService.createExpense(expenseData);

            expect((apiClient.request as jest.Mock)).toHaveBeenCalledWith('/expenses', {
                method: 'POST',
                body: JSON.stringify(expenseData)
            });

            expect(result).toEqual({ success: true, data: mockResponse });
        });
    });

    describe('getExpense', () => {
        it('should fetch expense by ID', async () => {
            const mockExpense: ExpenseData = {
                id: 'expense-1',
                groupId: 'group-1',
                description: 'Test expense',
                amount: 100,
                paidBy: 'user-1',
                category: 'food',
                date: '2023-01-01',
                splitType: 'equal',
                participants: ['user-1', 'user-2'],
                splits: [],
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z',
                createdBy: 'user-1'
            };

            (apiClient.request as jest.Mock).mockResolvedValue(mockExpense);

            const result = await apiService.getExpense('expense-1');

            expect((apiClient.request as jest.Mock)).toHaveBeenCalledWith('/expenses?id=expense-1', {
                method: 'GET'
            });

            expect(result.data).toEqual(mockExpense);
        });

        it('should throw error for empty expense ID', async () => {
            await expect(apiService.getExpense('')).rejects.toThrow('Expense ID is required');
        });
    });

    describe('updateExpense', () => {
        it('should update an expense', async () => {
            const updateData: UpdateExpenseRequest = {
                description: 'Updated expense',
                amount: 150
            };

            const mockResponse: ExpenseData = {
                id: 'expense-1',
                groupId: 'group-1',
                description: 'Updated expense',
                amount: 150,
                paidBy: 'user-1',
                category: 'food',
                date: '2023-01-01',
                splitType: 'equal',
                participants: ['user-1', 'user-2'],
                splits: [],
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z',
                createdBy: 'user-1'
            };

            (apiClient.request as jest.Mock).mockResolvedValue(mockResponse);

            const result = await apiService.updateExpense('expense-1', updateData);

            expect((apiClient.request as jest.Mock)).toHaveBeenCalledWith('/expenses?id=expense-1', {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });

            expect(result).toEqual({ success: true, data: mockResponse });
        });

        it('should throw error for empty expense ID', async () => {
            await expect(apiService.updateExpense('', {})).rejects.toThrow('Expense ID is required');
        });
    });

    describe('generateShareableLink', () => {
        it('should generate shareable link for group', async () => {
            const mockResponse: ShareableLinkResponse = {
                linkId: 'share-123',
                groupId: 'group-1',
                expiresAt: '2023-12-31T23:59:59Z',
                shareUrl: 'https://example.com/join/share-123'
            };

            (apiClient.request as jest.Mock).mockResolvedValue(mockResponse);

            const result = await apiService.generateShareableLink('group-1');

            expect((apiClient.request as jest.Mock)).toHaveBeenCalledWith('/groups/share', {
                method: 'POST',
                body: JSON.stringify({ groupId: 'group-1' })
            });

            expect(result).toEqual({ success: true, data: mockResponse });
        });

        it('should throw error for empty group ID', async () => {
            await expect(apiService.generateShareableLink('')).rejects.toThrow('Group ID is required');
        });
    });

    describe('joinGroupByLink', () => {
        it('should join group using link', async () => {
            const mockResponse: JoinGroupResponse = {
                groupId: 'group-1',
                success: true,
                message: 'Successfully joined group',
                groupName: 'Test Group'
            };

            (apiClient.request as jest.Mock).mockResolvedValue(mockResponse);

            const result = await apiService.joinGroupByLink('link-123');

            expect((apiClient.request as jest.Mock)).toHaveBeenCalledWith('/groups/join', {
                method: 'POST',
                body: JSON.stringify({ linkId: 'link-123' })
            });

            expect(result).toEqual({ success: true, data: mockResponse });
        });

        it('should throw error for empty link ID', async () => {
            await expect(apiService.joinGroupByLink('')).rejects.toThrow('Link ID is required');
        });
    });
});

describe('apiCall', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue('mock-token');
    });

    it('should make successful API call', async () => {
        const mockResponse = { data: 'test' };
        (apiClient.request as jest.Mock).mockResolvedValue(mockResponse);

        const result = await apiCall('/test');

        expect(apiClient.request).toHaveBeenCalledWith('/test', {});
        expect(result).toEqual(mockResponse);
    });

    it('should handle 401 errors by clearing token and redirecting', async () => {
        const error = new Error('401 Unauthorized');
        (apiClient.request as jest.Mock).mockRejectedValue(error);

        await expect(apiCall('/test')).rejects.toThrow('401 Unauthorized');

        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
        // Note: jsdom doesn't support navigation, so we can't test window.location.href assignment
    });

    it('should propagate non-401 errors without redirect', async () => {
        const error = new Error('500 Server Error');
        (apiClient.request as jest.Mock).mockRejectedValue(error);

        await expect(apiCall('/test')).rejects.toThrow('500 Server Error');

        expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    });
});