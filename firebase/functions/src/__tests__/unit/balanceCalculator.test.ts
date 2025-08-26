import { Timestamp } from 'firebase-admin/firestore';
import { calculateGroupBalances } from '../../services/balanceCalculator';
import { SimplifiedDebt } from '@splitifyd/shared';
import { UserProfile } from '../../services/userService';
import { ExpenseBuilder, SettlementBuilder } from '../support/builders';

// Mock dependencies
jest.mock('../../firebase', () => ({
    firestoreDb: {
        collection: jest.fn(),
    },
}));

jest.mock('../../services/UserService', () => ({
    userService: {
        getUsers: jest.fn(),
    },
}));

jest.mock('../../utils/debtSimplifier', () => ({
    simplifyDebts: jest.fn(),
}));

// Import mocked dependencies
import { firestoreDb } from '../../firebase';
import { userService } from '../../services/userService';
import { simplifyDebts } from '../../utils/debtSimplifier';

// Type the mocked functions
const mockDb = firestoreDb as jest.Mocked<typeof firestoreDb>;
const mockUserService = userService as jest.Mocked<typeof userService>;
const mockSimplifyDebts = simplifyDebts as jest.MockedFunction<typeof simplifyDebts>;

// Adapter functions to convert existing builders to Firestore format
function createFirestoreExpense(overrides: Partial<any> = {}) {
    const testExpense = new ExpenseBuilder().build();
    return {
        id: 'expense-1',
        createdAt: Timestamp.now(),
        ...testExpense,
        ...overrides
    };
}

function createFirestoreSettlement(overrides: Partial<any> = {}) {
    const testSettlement = new SettlementBuilder().build();
    return {
        id: 'settlement-1',
        createdAt: Timestamp.now(),
        ...testSettlement,
        ...overrides
    };
}

// Helper class for mock Firestore responses
class MockFirestoreBuilder {
    static createQuerySnapshot(docs: any[]) {
        return {
            docs: docs.map(doc => ({
                id: doc.id || 'default-id',
                data: () => doc
            })),
            empty: docs.length === 0
        };
    }

    static createDocSnapshot(doc: any) {
        return {
            exists: true,
            id: doc.id || 'default-id',
            data: () => doc.data || doc
        };
    }
}

// Mock group data with correct nested structure expected by balance calculator
const mockGroup = {
    id: 'group-1',
    data: {
        data: {
            name: 'Test Group',
            members: {
                'user-1': { role: 'owner' },
                'user-2': { role: 'member' }
            }
        }
    }
};

// Mock user profiles
const mockUsers: UserProfile[] = [
    {
        uid: 'user-1',
        displayName: 'User One',
        email: 'user1@test.com',
        photoURL: null,
        emailVerified: true
    },
    {
        uid: 'user-2',
        displayName: 'User Two',
        email: 'user2@test.com',
        photoURL: null,
        emailVerified: true
    }
];

describe('calculateGroupBalances', () => {
    let mockGet: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        mockGet = jest.fn();
        mockDb.collection.mockReturnValue({
            where: jest.fn().mockReturnThis(),
            get: mockGet,
            doc: jest.fn().mockReturnThis()
        } as any);

        const userMap = new Map<string, UserProfile>();
        mockUsers.forEach(user => userMap.set(user.uid, user));
        mockUserService.getUsers.mockResolvedValue(userMap);
        mockSimplifyDebts.mockImplementation((balances, currency) => []);
    });

    describe('edge cases', () => {
        it('should return empty balances for group with no expenses or settlements', async () => {
            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([])) // expenses
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([])) // settlements
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup)); // group

            const result = await calculateGroupBalances('group-1');

            expect(result).toEqual({
                groupId: 'group-1',
                userBalances: {},
                simplifiedDebts: [],
                lastUpdated: expect.any(Timestamp),
                balancesByCurrency: {}
            });
        });

        it('should throw error when expense is missing currency', async () => {
            const expenseWithoutCurrency = createFirestoreExpense({ currency: undefined });

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([expenseWithoutCurrency]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            await expect(calculateGroupBalances('group-1')).rejects.toThrow('Expense expense-1 is missing currency - invalid state');
        });

        it('should throw error when settlement is missing currency', async () => {
            const settlementWithoutCurrency = createFirestoreSettlement({ currency: undefined });

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([settlementWithoutCurrency]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            await expect(calculateGroupBalances('group-1')).rejects.toThrow('Settlement settlement-1 is missing currency - invalid state');
        });
    });

    describe('single currency scenarios', () => {
        it('should handle single expense split equally between two users', async () => {
            const expense = createFirestoreExpense({
                amount: 100,
                paidBy: 'user-1',
                participants: ['user-1', 'user-2'],
                splits: [
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ]
            });

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([expense]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            const result = await calculateGroupBalances('group-1');

            expect(result.userBalances).toEqual({
                'user-1': expect.objectContaining({ netBalance: 50 }),
                'user-2': expect.objectContaining({ netBalance: -50 })
            });
        });

        it('should handle multiple expenses between same users', async () => {
            const expense1 = createFirestoreExpense({
                id: 'expense-1',
                amount: 100,
                paidBy: 'user-1',
                participants: ['user-1', 'user-2'],
                splits: [
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ]
            });

            const expense2 = createFirestoreExpense({
                id: 'expense-2',
                amount: 60,
                paidBy: 'user-2',
                participants: ['user-1', 'user-2'],
                splits: [
                    { userId: 'user-1', amount: 30 },
                    { userId: 'user-2', amount: 30 }
                ]
            });

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([expense1, expense2]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            const result = await calculateGroupBalances('group-1');

            expect(result.userBalances).toEqual({
                'user-1': expect.objectContaining({ netBalance: 20 }),
                'user-2': expect.objectContaining({ netBalance: -20 })
            });
        });

        it('should handle exact split expenses', async () => {
            const expense = createFirestoreExpense({
                amount: 150,
                splitType: 'exact',
                paidBy: 'user-1',
                participants: ['user-1', 'user-2'],
                splits: [
                    { userId: 'user-1', amount: 60 },
                    { userId: 'user-2', amount: 90 }
                ]
            });

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([expense]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            const result = await calculateGroupBalances('group-1');

            expect(result.userBalances).toEqual({
                'user-1': expect.objectContaining({ netBalance: 90 }),
                'user-2': expect.objectContaining({ netBalance: -90 })
            });
        });

        it('should handle settlements', async () => {
            const expense = createFirestoreExpense({
                amount: 100,
                paidBy: 'user-1',
                participants: ['user-1', 'user-2'],
                splits: [
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ]
            });

            const settlement = createFirestoreSettlement({
                payerId: 'user-2',
                payeeId: 'user-1',
                amount: 25
            });

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([expense]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([settlement]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            const result = await calculateGroupBalances('group-1');

            expect(result.userBalances).toEqual({
                'user-1': expect.objectContaining({ netBalance: 25 }),
                'user-2': expect.objectContaining({ netBalance: -25 })
            });
        });
    });

    describe('multi-currency scenarios', () => {
        it('should handle expenses in different currencies', async () => {
            const expenseUSD = createFirestoreExpense({
                id: 'expense-1',
                amount: 100,
                currency: 'USD',
                paidBy: 'user-1',
                participants: ['user-1', 'user-2'],
                splits: [
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ]
            });

            const expenseEUR = createFirestoreExpense({
                id: 'expense-2',
                amount: 80,
                currency: 'EUR',
                paidBy: 'user-2',
                participants: ['user-1', 'user-2'],
                splits: [
                    { userId: 'user-1', amount: 40 },
                    { userId: 'user-2', amount: 40 }
                ]
            });

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([expenseUSD, expenseEUR]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            const result = await calculateGroupBalances('group-1');

            expect(result.balancesByCurrency).toEqual({
                'USD': {
                    'user-1': expect.objectContaining({ netBalance: 50 }),
                    'user-2': expect.objectContaining({ netBalance: -50 })
                },
                'EUR': {
                    'user-1': expect.objectContaining({ netBalance: -40 }),
                    'user-2': expect.objectContaining({ netBalance: 40 })
                }
            });
        });

        it('should use first currency for legacy userBalances field', async () => {
            const expenseEUR = createFirestoreExpense({
                currency: 'EUR',
                amount: 100,
                paidBy: 'user-1',
                participants: ['user-1', 'user-2'],
                splits: [
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ]
            });

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([expenseEUR]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            const result = await calculateGroupBalances('group-1');

            expect(result.userBalances).toEqual({
                'user-1': expect.objectContaining({ netBalance: 50 }),
                'user-2': expect.objectContaining({ netBalance: -50 })
            });
            expect(result.balancesByCurrency['EUR']).toBeDefined();
        });
    });

    describe('settlement processing', () => {
        it('should handle settlements between same users as expenses', async () => {
            const expense = createFirestoreExpense({
                amount: 100,
                paidBy: 'user-1',
                participants: ['user-1', 'user-2'],
                splits: [
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ]
            });

            const settlement = createFirestoreSettlement({
                payerId: 'user-2',
                payeeId: 'user-1',
                amount: 50
            });

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([expense]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([settlement]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            const result = await calculateGroupBalances('group-1');

            expect(result.userBalances).toEqual({
                'user-1': expect.objectContaining({ netBalance: 0 }),
                'user-2': expect.objectContaining({ netBalance: 0 })
            });
        });

        it('should handle partial settlements', async () => {
            const expense = createFirestoreExpense({
                amount: 100,
                paidBy: 'user-1',
                participants: ['user-1', 'user-2'],
                splits: [
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ]
            });

            const settlement = createFirestoreSettlement({
                payerId: 'user-2',
                payeeId: 'user-1',
                amount: 25
            });

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([expense]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([settlement]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            const result = await calculateGroupBalances('group-1');

            expect(result.userBalances).toEqual({
                'user-1': expect.objectContaining({ netBalance: 25 }),
                'user-2': expect.objectContaining({ netBalance: -25 })
            });
        });
    });

    describe('data structure validation', () => {
        it('should include all required fields in response', async () => {
            const expense = createFirestoreExpense({
                amount: 100,
                splits: [
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ]
            });

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([expense]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            const result = await calculateGroupBalances('group-1');

            expect(result).toHaveProperty('groupId', 'group-1');
            expect(result).toHaveProperty('userBalances');
            expect(result).toHaveProperty('simplifiedDebts');
            expect(result).toHaveProperty('lastUpdated');
            expect(result).toHaveProperty('balancesByCurrency');
        });

        it('should have consistent balance totals that sum to zero', async () => {
            const expense = createFirestoreExpense({
                amount: 100,
                paidBy: 'user-1',
                participants: ['user-1', 'user-2'],
                splits: [
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ]
            });

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([expense]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            const result = await calculateGroupBalances('group-1');

            const totalSum = Object.values(result.userBalances).reduce((sum: number, balance: any) => sum + balance.netBalance, 0);
            expect(Math.abs(totalSum)).toBeLessThan(0.01);
        });
    });

    describe('integration with external services', () => {
        it('should call simplifyDebts with correct debt array', async () => {
            const mockSimplifiedDebts: SimplifiedDebt[] = [
                {
                    from: { userId: 'user-2' },
                    to: { userId: 'user-1' },
                    amount: 50,
                    currency: 'USD'
                }
            ];
            mockSimplifyDebts.mockReturnValue(mockSimplifiedDebts);

            const expense = createFirestoreExpense({
                amount: 100,
                paidBy: 'user-1',
                participants: ['user-1', 'user-2'],
                splits: [
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ]
            });

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([expense]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            const result = await calculateGroupBalances('group-1');

            expect(mockSimplifyDebts).toHaveBeenCalled();
            expect(result.simplifiedDebts).toEqual(mockSimplifiedDebts);
        });

        it('should fetch user profiles correctly', async () => {
            const expense = createFirestoreExpense({
                amount: 100,
                splits: [
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ]
            });

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([expense]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            await calculateGroupBalances('group-1');

            expect(mockUserService.getUsers).toHaveBeenCalledWith(['user-1', 'user-2']);
        });
    });
});