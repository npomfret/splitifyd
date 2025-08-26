import { SecurityPresets, MemberRoles, MemberStatuses } from '@splitifyd/shared';

// Mock Firebase modules
jest.mock('firebase-admin');
jest.mock('../../firebase', () => ({
    firestoreDb: {
        collection: jest.fn(),
    },
}));
jest.mock('../../logger', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
    },
}));
jest.mock('../../services/balance', () => ({
    calculateGroupBalances: jest.fn(),
}));
jest.mock('../../services/expenseMetadataService', () => ({
    calculateExpenseMetadata: jest.fn(),
}));
jest.mock('../../groups/handlers', () => ({
    transformGroupDocument: jest.fn(),
}));
jest.mock('../../utils/groupHelpers', () => ({
    isGroupOwner: jest.fn(),
    isGroupMember: jest.fn(),
}));

// Import after mocking
import { GroupService } from '../../services/GroupService';
import { firestoreDb } from '../../firebase';
import { calculateGroupBalances } from '../../services/balance';
import { calculateExpenseMetadata } from '../../services/expenseMetadataService';
import { transformGroupDocument } from '../../groups/handlers';
import { isGroupOwner, isGroupMember } from '../../utils/groupHelpers';

// Test builders to reduce noise and focus tests on what matters
class GroupBuilder {
    private group: any = {
        id: 'test-group-id',
        name: 'Test Group',
        description: 'Test Description',
        createdBy: 'creator-id',
        members: {
            'test-user-id': {
                role: MemberRoles.MEMBER,
                status: MemberStatuses.ACTIVE,
                theme: { name: 'blue' },
                joinedAt: '2024-01-01T00:00:00.000Z',
            },
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        securityPreset: SecurityPresets.OPEN,
        permissions: {},
    };

    withId(id: string): GroupBuilder {
        this.group.id = id;
        return this;
    }

    withName(name: string): GroupBuilder {
        this.group.name = name;
        return this;
    }

    withMember(userId: string, role = MemberRoles.MEMBER): GroupBuilder {
        this.group.members[userId] = {
            role,
            status: MemberStatuses.ACTIVE,
            theme: { name: 'blue' },
            joinedAt: '2024-01-01T00:00:00.000Z',
        };
        return this;
    }

    build(): any {
        return { ...this.group };
    }
}

class BalanceBuilder {
    private balances: any = {
        balancesByCurrency: {},
    };

    withCurrency(currency: string, userId: string, netBalance: number): BalanceBuilder {
        if (!this.balances.balancesByCurrency[currency]) {
            this.balances.balancesByCurrency[currency] = {};
        }
        this.balances.balancesByCurrency[currency][userId] = { netBalance };
        return this;
    }

    build(): any {
        return { ...this.balances };
    }
}

class ExpenseMetadataBuilder {
    private metadata: any = {};

    withLastExpenseTime(date: Date): ExpenseMetadataBuilder {
        this.metadata.lastExpenseTime = date;
        return this;
    }

    build(): any {
        return { ...this.metadata };
    }
}

describe('GroupService', () => {
    let groupService: GroupService;
    let mockFirestoreGet: jest.Mock;
    let mockCalculateGroupBalances: jest.Mock;
    let mockCalculateExpenseMetadata: jest.Mock;
    let mockTransformGroupDocument: jest.Mock;
    let mockIsGroupOwner: jest.Mock;
    let mockIsGroupMember: jest.Mock;

    beforeEach(() => {
        // Create a new instance for each test
        groupService = new GroupService();

        // Setup mocks
        mockFirestoreGet = jest.fn();
        mockCalculateGroupBalances = calculateGroupBalances as jest.Mock;
        mockCalculateExpenseMetadata = calculateExpenseMetadata as jest.Mock;
        mockTransformGroupDocument = transformGroupDocument as jest.Mock;
        mockIsGroupOwner = isGroupOwner as jest.Mock;
        mockIsGroupMember = isGroupMember as jest.Mock;

        // Mock Firestore chain
        const mockDoc = jest.fn(() => ({
            get: mockFirestoreGet,
        }));

        const mockCollection = jest.fn(() => ({
            doc: mockDoc,
        }));

        (firestoreDb.collection as jest.Mock) = mockCollection;

        // Clear all mocks
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getGroup', () => {
        const groupId = 'test-group-id';
        const userId = 'test-user-id';

        it('should successfully get group for owner', async () => {
            // Arrange - focus on what matters: positive balance
            const group = new GroupBuilder().withMember(userId).build();
            const balances = new BalanceBuilder().withCurrency('USD', userId, 10.50).build();
            const expenseMetadata = new ExpenseMetadataBuilder()
                .withLastExpenseTime(new Date('2024-01-15T10:00:00.000Z'))
                .build();

            mockFirestoreGet.mockResolvedValue({ exists: true, data: () => ({}) });
            mockTransformGroupDocument.mockReturnValue(group);
            mockIsGroupOwner.mockReturnValue(true);
            mockCalculateGroupBalances.mockResolvedValue(balances);
            mockCalculateExpenseMetadata.mockResolvedValue(expenseMetadata);

            // Act
            const result = await groupService.getGroup(groupId, userId);

            // Assert
            expect(result.balance.userBalance).toEqual({
                netBalance: 10.50,
                totalOwed: 10.50,
                totalOwing: 0,
            });
            expect(result.balance.balancesByCurrency.USD).toEqual({
                currency: 'USD',
                netBalance: 10.50,
                totalOwed: 10.50,
                totalOwing: 0,
            });
            expect(mockIsGroupOwner).toHaveBeenCalledWith(group, userId);
        });

        it('should successfully get group for member', async () => {
            // Arrange - focus on what matters: member (not owner) access
            const group = new GroupBuilder().withMember(userId).build();
            const balances = new BalanceBuilder().build();
            const expenseMetadata = new ExpenseMetadataBuilder().build();

            mockFirestoreGet.mockResolvedValue({ exists: true, data: () => ({}) });
            mockTransformGroupDocument.mockReturnValue(group);
            mockIsGroupOwner.mockReturnValue(false);
            mockIsGroupMember.mockReturnValue(true);
            mockCalculateGroupBalances.mockResolvedValue(balances);
            mockCalculateExpenseMetadata.mockResolvedValue(expenseMetadata);

            // Act
            const result = await groupService.getGroup(groupId, userId);

            // Assert
            expect(result.id).toBe(groupId);
            expect(mockIsGroupOwner).toHaveBeenCalledWith(group, userId);
            expect(mockIsGroupMember).toHaveBeenCalledWith(group, userId);
        });

        it('should throw NOT_FOUND error when group does not exist', async () => {
            // Arrange
            mockFirestoreGet.mockResolvedValue({
                exists: false,
            });

            // Act & Assert
            await expect(groupService.getGroup(groupId, userId)).rejects.toThrow('Group not found');

            expect(mockFirestoreGet).toHaveBeenCalledTimes(1);
            expect(mockTransformGroupDocument).not.toHaveBeenCalled();
        });

        it('should throw NOT_FOUND error when user is not owner or member', async () => {
            // Arrange - focus on what matters: user has no access
            const group = new GroupBuilder().build(); // No members added

            mockFirestoreGet.mockResolvedValue({ exists: true, data: () => ({}) });
            mockTransformGroupDocument.mockReturnValue(group);
            mockIsGroupOwner.mockReturnValue(false);
            mockIsGroupMember.mockReturnValue(false);

            // Act & Assert
            await expect(groupService.getGroup(groupId, userId)).rejects.toThrow('Group not found');

            expect(mockIsGroupOwner).toHaveBeenCalledWith(group, userId);
            expect(mockIsGroupMember).toHaveBeenCalledWith(group, userId);
        });

        it('should handle negative balance correctly', async () => {
            // Arrange - focus on what matters: negative balance
            const group = new GroupBuilder().withMember(userId).build();
            const balances = new BalanceBuilder().withCurrency('USD', userId, -25.75).build();
            const expenseMetadata = new ExpenseMetadataBuilder().build();

            mockFirestoreGet.mockResolvedValue({ exists: true, data: () => ({}) });
            mockTransformGroupDocument.mockReturnValue(group);
            mockIsGroupOwner.mockReturnValue(true);
            mockCalculateGroupBalances.mockResolvedValue(balances);
            mockCalculateExpenseMetadata.mockResolvedValue(expenseMetadata);

            // Act
            const result = await groupService.getGroup(groupId, userId);

            // Assert
            expect(result.balance.userBalance).toEqual({
                netBalance: -25.75,
                totalOwed: 0,
                totalOwing: 25.75,
            });
        });

        it('should handle zero balance correctly', async () => {
            // Arrange - focus on what matters: tiny balance below threshold
            const group = new GroupBuilder().withMember(userId).build();
            const balances = new BalanceBuilder().withCurrency('USD', userId, 0.005).build(); // Below 0.01 threshold
            const expenseMetadata = new ExpenseMetadataBuilder().build();

            mockFirestoreGet.mockResolvedValue({ exists: true, data: () => ({}) });
            mockTransformGroupDocument.mockReturnValue(group);
            mockIsGroupOwner.mockReturnValue(true);
            mockCalculateGroupBalances.mockResolvedValue(balances);
            mockCalculateExpenseMetadata.mockResolvedValue(expenseMetadata);

            // Act
            const result = await groupService.getGroup(groupId, userId);

            // Assert - balance is filtered out of balancesByCurrency but preserved in userBalance
            expect(result.balance.balancesByCurrency).toEqual({});
            expect(result.balance.userBalance).toEqual({
                netBalance: 0.005,
                totalOwed: 0.005,
                totalOwing: 0,
            });
        });

        it('should handle group with no balances', async () => {
            // Arrange - focus on what matters: no balances at all
            const group = new GroupBuilder().withMember(userId).build();
            const balances = new BalanceBuilder().build(); // Empty balances
            const expenseMetadata = new ExpenseMetadataBuilder().build();

            mockFirestoreGet.mockResolvedValue({ exists: true, data: () => ({}) });
            mockTransformGroupDocument.mockReturnValue(group);
            mockIsGroupOwner.mockReturnValue(true);
            mockCalculateGroupBalances.mockResolvedValue(balances);
            mockCalculateExpenseMetadata.mockResolvedValue(expenseMetadata);

            // Act
            const result = await groupService.getGroup(groupId, userId);

            // Assert
            expect(result.balance.balancesByCurrency).toEqual({});
            expect(result.balance.userBalance).toBeNull();
        });

        it('should handle group with no expense metadata', async () => {
            // Arrange - focus on what matters: no expense history
            const group = new GroupBuilder().withMember(userId).build();
            const balances = new BalanceBuilder().build();
            const expenseMetadata = new ExpenseMetadataBuilder().build(); // No lastExpenseTime

            mockFirestoreGet.mockResolvedValue({ exists: true, data: () => ({}) });
            mockTransformGroupDocument.mockReturnValue(group);
            mockIsGroupOwner.mockReturnValue(true);
            mockCalculateGroupBalances.mockResolvedValue(balances);
            mockCalculateExpenseMetadata.mockResolvedValue(expenseMetadata);

            // Act
            const result = await groupService.getGroup(groupId, userId);

            // Assert
            expect(result.lastActivity).toBe('No recent activity');
            expect(result.lastActivityRaw).toBe(group.createdAt);
        });

        it('should handle multiple currencies correctly', async () => {
            // Arrange - focus on what matters: multiple currencies with filtering
            const group = new GroupBuilder().withMember(userId).build();
            const balances = new BalanceBuilder()
                .withCurrency('USD', userId, 10.50)
                .withCurrency('EUR', userId, -5.25)
                .withCurrency('GBP', userId, 0.005) // Below threshold
                .build();
            const expenseMetadata = new ExpenseMetadataBuilder().build();

            mockFirestoreGet.mockResolvedValue({ exists: true, data: () => ({}) });
            mockTransformGroupDocument.mockReturnValue(group);
            mockIsGroupOwner.mockReturnValue(true);
            mockCalculateGroupBalances.mockResolvedValue(balances);
            mockCalculateExpenseMetadata.mockResolvedValue(expenseMetadata);

            // Act
            const result = await groupService.getGroup(groupId, userId);

            // Assert - GBP filtered out, userBalance from first currency (USD)
            expect(result.balance.balancesByCurrency).toEqual({
                USD: {
                    currency: 'USD',
                    netBalance: 10.50,
                    totalOwed: 10.50,
                    totalOwing: 0,
                },
                EUR: {
                    currency: 'EUR',
                    netBalance: -5.25,
                    totalOwed: 0,
                    totalOwing: 5.25,
                },
            });
            expect(result.balance.userBalance).toEqual({
                netBalance: 10.50,
                totalOwed: 10.50,
                totalOwing: 0,
            });
        });
    });
});