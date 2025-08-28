import { Timestamp } from 'firebase-admin/firestore';
import { calculateGroupBalances } from '../../services/balanceCalculator';
import { SimplifiedDebt } from '@splitifyd/shared';
import { UserProfile } from '../../services/UserService2';
import { ExpenseBuilder, SettlementBuilder } from '@splitifyd/test-support';

// Mock dependencies
vi.mock('../../firebase', () => ({
    firestoreDb: {
        collection: vi.fn(),
    },
}));

vi.mock('../../services/UserService2', () => ({
    userService: {
        getUsers: vi.fn(),
    },
}));

vi.mock('../../utils/debtSimplifier', () => ({
    simplifyDebts: vi.fn(),
}));

// Import mocked dependencies
import { firestoreDb } from '../../firebase';
import { userService } from '../../services/UserService2';
import { simplifyDebts } from '../../utils/debtSimplifier';

// Type the mocked functions
const mockDb = firestoreDb as vi.Mocked<typeof firestoreDb>;
const mockUserService = userService as vi.Mocked<typeof userService>;
const mockSimplifyDebts = simplifyDebts as vi.MockedFunction<typeof simplifyDebts>;

// Enhanced builders - only specify what's needed for each test
class FirestoreExpenseBuilder extends ExpenseBuilder {
    private firestoreFields: any = {
        id: 'expense-1',
        createdAt: Timestamp.now()
    };
    private excludeCurrency = false;

    withId(id: string): FirestoreExpenseBuilder {
        this.firestoreFields.id = id;
        return this;
    }

    withoutCurrency(): FirestoreExpenseBuilder {
        // For testing missing currency validation
        this.excludeCurrency = true;
        return this;
    }

    build(): any {
        const baseExpense = super.build();
        const result = {
            ...this.firestoreFields,
            ...baseExpense
        };
        // Remove currency if withoutCurrency was called
        if (this.excludeCurrency) {
            delete result.currency;
        }
        return result;
    }
}

class FirestoreSettlementBuilder extends SettlementBuilder {
    private firestoreFields: any = {
        id: 'settlement-1',
        createdAt: Timestamp.now()
    };
    private excludeCurrency = false;

    withId(id: string): FirestoreSettlementBuilder {
        this.firestoreFields.id = id;
        return this;
    }

    withoutCurrency(): FirestoreSettlementBuilder {
        // For testing missing currency validation
        this.excludeCurrency = true;
        return this;
    }

    build(): any {
        const baseSettlement = super.build();
        const result = {
            ...this.firestoreFields,
            ...baseSettlement
        };
        // Remove currency if withoutCurrency was called
        if (this.excludeCurrency) {
            delete result.currency;
        }
        return result;
    }
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

// Builder for mock group
class MockGroupBuilder {
    private group: any = {
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

    withMembers(members: Record<string, any>): MockGroupBuilder {
        this.group.data.data.members = members;
        return this;
    }

    build(): any {
        return { ...this.group };
    }
}

// Builder for user profiles
class UserProfileBuilder {
    private user: UserProfile = {
        uid: 'user-1',
        displayName: 'Test User',
        email: 'test@example.com',
        photoURL: null,
        emailVerified: true
    };

    withUid(uid: string): UserProfileBuilder {
        this.user.uid = uid;
        return this;
    }

    withDisplayName(name: string): UserProfileBuilder {
        this.user.displayName = name;
        return this;
    }

    withEmail(email: string): UserProfileBuilder {
        this.user.email = email;
        return this;
    }

    build(): UserProfile {
        return { ...this.user };
    }
}

describe('calculateGroupBalances', () => {
    let mockGet: vi.Mock;

    beforeEach(() => {
        vi.clearAllMocks();

        mockGet = vi.fn();
        mockDb.collection.mockReturnValue({
            where: vi.fn().mockReturnThis(),
            get: mockGet,
            doc: vi.fn().mockReturnThis()
        } as any);

        // Setup default user profiles
        const mockUsers = [
            new UserProfileBuilder()
                .withUid('user-1')
                .withDisplayName('User One')
                .withEmail('user1@test.com')
                .build(),
            new UserProfileBuilder()
                .withUid('user-2')
                .withDisplayName('User Two')
                .withEmail('user2@test.com')
                .build()
        ];
        
        const userMap = new Map<string, UserProfile>();
        mockUsers.forEach(user => userMap.set(user.uid, user));
        mockUserService.getUsers.mockResolvedValue(userMap);
        mockSimplifyDebts.mockImplementation((balances, currency) => []);
    });

    describe('edge cases', () => {
        it('should return empty balances for group with no expenses or settlements', async () => {
            const mockGroup = new MockGroupBuilder().build();
            
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
            const expenseWithoutCurrency = new FirestoreExpenseBuilder()
                .withoutCurrency()
                .build();
            
            const mockGroup = new MockGroupBuilder().build();

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([expenseWithoutCurrency]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            await expect(calculateGroupBalances('group-1')).rejects.toThrow('Expense expense-1 is missing currency - invalid state');
        });

        it('should throw error when settlement is missing currency', async () => {
            const settlementWithoutCurrency = new FirestoreSettlementBuilder()
                .withoutCurrency()
                .build();
            
            const mockGroup = new MockGroupBuilder().build();

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([settlementWithoutCurrency]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            await expect(calculateGroupBalances('group-1')).rejects.toThrow('Settlement settlement-1 is missing currency - invalid state');
        });
    });

    describe('single currency scenarios', () => {
        it('should handle single expense split equally between two users', async () => {
            const expense = new FirestoreExpenseBuilder()
                .withAmount(100)
                .withPaidBy('user-1')
                .withParticipants(['user-1', 'user-2'])
                .withSplits([
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ])
                .build();
            
            const mockGroup = new MockGroupBuilder().build();

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
            const expense1 = new FirestoreExpenseBuilder()
                .withAmount(100)
                .withPaidBy('user-1')
                .withSplits([
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ])
                .build();

            const expense2 = new FirestoreExpenseBuilder()
                .withId('expense-2')
                .withAmount(60)
                .withPaidBy('user-2')
                .withSplits([
                    { userId: 'user-1', amount: 30 },
                    { userId: 'user-2', amount: 30 }
                ])
                .build();
            
            const mockGroup = new MockGroupBuilder().build();

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
            const expense = new FirestoreExpenseBuilder()
                .withAmount(150)
                .withSplitType('exact')
                .withPaidBy('user-1')
                .withSplits([
                    { userId: 'user-1', amount: 60 },
                    { userId: 'user-2', amount: 90 }
                ])
                .build();
            
            const mockGroup = new MockGroupBuilder().build();

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
            const expense = new FirestoreExpenseBuilder()
                .withAmount(100)
                .withPaidBy('user-1')
                .withSplits([
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ])
                .build();

            const settlement = new FirestoreSettlementBuilder()
                .withPayer('user-2')
                .withPayee('user-1')
                .withAmount(25)
                .build();
            
            const mockGroup = new MockGroupBuilder().build();

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
            const expenseUSD = new FirestoreExpenseBuilder()
                .withAmount(100)
                .withCurrency('USD')
                .withPaidBy('user-1')
                .withSplits([
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ])
                .build();

            const expenseEUR = new FirestoreExpenseBuilder()
                .withId('expense-2')
                .withAmount(80)
                .withCurrency('EUR')
                .withPaidBy('user-2')
                .withSplits([
                    { userId: 'user-1', amount: 40 },
                    { userId: 'user-2', amount: 40 }
                ])
                .build();
            
            const mockGroup = new MockGroupBuilder().build();

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
            const expenseEUR = new FirestoreExpenseBuilder()
                .withCurrency('EUR')
                .withAmount(100)
                .withPaidBy('user-1')
                .withSplits([
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ])
                .build();
            
            const mockGroup = new MockGroupBuilder().build();

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
            const expense = new FirestoreExpenseBuilder()
                .withAmount(100)
                .withPaidBy('user-1')
                .withSplits([
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ])
                .build();

            const settlement = new FirestoreSettlementBuilder()
                .withPayer('user-2')
                .withPayee('user-1')
                .withAmount(50)
                .build();
            
            const mockGroup = new MockGroupBuilder().build();

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
            const expense = new FirestoreExpenseBuilder()
                .withAmount(100)
                .withPaidBy('user-1')
                .withSplits([
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ])
                .build();

            const settlement = new FirestoreSettlementBuilder()
                .withPayer('user-2')
                .withPayee('user-1')
                .withAmount(25)
                .build();
            
            const mockGroup = new MockGroupBuilder().build();

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
            const expense = new FirestoreExpenseBuilder()
                .withAmount(100)
                .withSplits([
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ])
                .build();
            
            const mockGroup = new MockGroupBuilder().build();

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
            const expense = new FirestoreExpenseBuilder()
                .withAmount(100)
                .withPaidBy('user-1')
                .withSplits([
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ])
                .build();
            
            const mockGroup = new MockGroupBuilder().build();

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

            const expense = new FirestoreExpenseBuilder()
                .withAmount(100)
                .withPaidBy('user-1')
                .withSplits([
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ])
                .build();
            
            const mockGroup = new MockGroupBuilder().build();

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([expense]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            const result = await calculateGroupBalances('group-1');

            expect(mockSimplifyDebts).toHaveBeenCalled();
            expect(result.simplifiedDebts).toEqual(mockSimplifiedDebts);
        });

        it('should fetch user profiles correctly', async () => {
            const expense = new FirestoreExpenseBuilder()
                .withAmount(100)
                .withSplits([
                    { userId: 'user-1', amount: 50 },
                    { userId: 'user-2', amount: 50 }
                ])
                .build();
            
            const mockGroup = new MockGroupBuilder().build();

            mockGet
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([expense]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createQuerySnapshot([]))
                .mockResolvedValueOnce(MockFirestoreBuilder.createDocSnapshot(mockGroup));

            await calculateGroupBalances('group-1');

            expect(mockUserService.getUsers).toHaveBeenCalledWith(['user-1', 'user-2']);
        });
    });
});