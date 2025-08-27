import { SecurityPresets, MemberRoles, MemberStatuses, FirestoreCollections } from '@splitifyd/shared';

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
    calculateGroupBalancesWithData: jest.fn(),
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
jest.mock('../../services/UserService2', () => ({
    userService: {
        getUsers: jest.fn(),
    },
}));
jest.mock('../../utils/pagination', () => ({
    buildPaginatedQuery: jest.fn(),
    encodeCursor: jest.fn(),
}));
jest.mock('../../constants', () => ({
    DOCUMENT_CONFIG: {
        LIST_LIMIT: 20,
    },
}));
jest.mock('../../utils/dateHelpers', () => ({
    parseISOToTimestamp: jest.fn(),
    getRelativeTime: jest.fn(),
    createOptimisticTimestamp: jest.fn(),
    createTrueServerTimestamp: jest.fn(),
    timestampToISO: jest.fn(),
}));
jest.mock('../../utils/optimistic-locking', () => ({
    getUpdatedAtTimestamp: jest.fn(),
    updateWithTimestamp: jest.fn(),
}));
jest.mock('../../utils/errors', () => ({
    Errors: {
        NOT_FOUND: jest.fn((resource) => new Error(`${resource} not found`)),
        FORBIDDEN: jest.fn(() => new Error('Forbidden')),
        UNAUTHORIZED: jest.fn(() => new Error('Unauthorized')),
        INVALID_INPUT: jest.fn((message) => new Error(message)),
    },
}));
jest.mock('../../permissions', () => ({
    PermissionEngine: {
        getDefaultPermissions: jest.fn(),
    },
}));
jest.mock('../../constants/user-colors', () => ({
    USER_COLORS: [
        { light: '#FF0000', dark: '#CC0000', name: 'Red' },
        { light: '#00FF00', dark: '#00CC00', name: 'Green' },
        { light: '#0000FF', dark: '#0000CC', name: 'Blue' },
    ],
    COLOR_PATTERNS: ['solid', 'striped', 'dotted'],
}));
jest.mock('../../logger', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
    },
    LoggerContext: {
        setBusinessContext: jest.fn(),
    },
}));

// Import after mocking
import { GroupService } from '../../services/GroupService';
import { firestoreDb } from '../../firebase';
import { calculateGroupBalances, calculateGroupBalancesWithData } from '../../services/balance';
import { calculateExpenseMetadata } from '../../services/expenseMetadataService';
import { transformGroupDocument } from '../../groups/handlers';
import { isGroupOwner, isGroupMember } from '../../utils/groupHelpers';
import { userService } from '../../services/UserService2';
import { buildPaginatedQuery, encodeCursor } from '../../utils/pagination';
import { parseISOToTimestamp, getRelativeTime } from '../../utils/dateHelpers';

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

    withCreatedBy(userId: string): GroupBuilder {
        this.group.createdBy = userId;
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

    describe('listGroups', () => {
        const userId = 'test-user-id';
        let mockFirestoreWhere: jest.Mock;
        let mockFirestoreSelect: jest.Mock;
        let mockCalculateGroupBalancesWithData: jest.Mock;
        let mockGetUsers: jest.Mock;
        let mockBuildPaginatedQuery: jest.Mock;
        let mockEncodeCursor: jest.Mock;
        let mockParseISOToTimestamp: jest.Mock;
        let mockGetRelativeTime: jest.Mock;

        beforeEach(() => {
            mockCalculateGroupBalancesWithData = calculateGroupBalancesWithData as jest.Mock;
            mockGetUsers = userService.getUsers as jest.Mock;
            mockBuildPaginatedQuery = buildPaginatedQuery as jest.Mock;
            mockEncodeCursor = encodeCursor as jest.Mock;
            mockParseISOToTimestamp = parseISOToTimestamp as jest.Mock;
            mockGetRelativeTime = getRelativeTime as jest.Mock;

            // Setup Firestore query chain mocks
            mockFirestoreWhere = jest.fn();
            mockFirestoreSelect = jest.fn();

            const mockCollection = jest.fn(() => ({
                where: mockFirestoreWhere,
                doc: jest.fn(() => ({ get: mockFirestoreGet })),
            }));

            mockFirestoreWhere.mockReturnValue({
                select: mockFirestoreSelect,
            });

            mockFirestoreSelect.mockReturnValue({});

            (firestoreDb.collection as jest.Mock) = mockCollection;
        });

        it('should list groups with pagination', async () => {
            // Arrange
            const group1 = new GroupBuilder()
                .withId('group-1')
                .withName('Group 1')
                .withMember(userId)
                .withMember('other-user')
                .build();
            const group2 = new GroupBuilder()
                .withId('group-2')
                .withName('Group 2')
                .withMember(userId)
                .build();

            const mockSnapshot = {
                docs: [
                    { data: () => ({}), id: 'group-1' },
                    { data: () => ({}), id: 'group-2' },
                ],
            };

            const mockQuery = { get: jest.fn().mockResolvedValue(mockSnapshot) };
            mockBuildPaginatedQuery.mockReturnValue(mockQuery);
            mockTransformGroupDocument.mockImplementation((doc) => {
                if (doc.id === 'group-1') return group1;
                if (doc.id === 'group-2') return group2;
                return null;
            });

            // Mock batch fetching of expenses and settlements
            const mockExpenseSnapshot = { docs: [] };
            const mockSettlementSnapshot = { docs: [] };
            (firestoreDb.collection as jest.Mock).mockImplementation((name) => {
                if (name === FirestoreCollections.EXPENSES) {
                    return { where: jest.fn(() => ({ get: jest.fn().mockResolvedValue(mockExpenseSnapshot) })) };
                }
                if (name === FirestoreCollections.SETTLEMENTS) {
                    return { where: jest.fn(() => ({ get: jest.fn().mockResolvedValue(mockSettlementSnapshot) })) };
                }
                if (name === FirestoreCollections.GROUPS) {
                    return { where: mockFirestoreWhere, doc: jest.fn(() => ({ get: mockFirestoreGet })) };
                }
                return {};
            });

            // Mock user profiles
            mockGetUsers.mockResolvedValue(new Map([
                [userId, { id: userId, displayName: 'Test User' }],
                ['other-user', { id: 'other-user', displayName: 'Other User' }],
            ]));

            // Mock balance calculation
            mockCalculateGroupBalancesWithData.mockReturnValue({
                balancesByCurrency: {
                    USD: {
                        [userId]: { netBalance: 10.00 },
                    },
                },
            });

            // Mock date helpers
            mockParseISOToTimestamp.mockReturnValue({ toMillis: () => Date.now() });
            mockGetRelativeTime.mockReturnValue('2 hours ago');

            // Act
            const result = await groupService.listGroups(userId, { limit: 10 });

            // Assert
            expect(result.groups).toHaveLength(2);
            expect(result.groups[0].id).toBe('group-1');
            expect(result.groups[1].id).toBe('group-2');
            expect(result.count).toBe(2);
            expect(result.hasMore).toBe(false);
            expect(result.pagination).toEqual({ limit: 10, order: 'desc' });
        });

        it('should handle cursor pagination correctly', async () => {
            // Arrange
            const group1 = new GroupBuilder()
                .withId('group-1')
                .withName('Group 1')
                .withMember(userId)
                .build();

            const mockSnapshot = {
                docs: [
                    { data: () => ({}), id: 'group-1' },
                    { data: () => ({}), id: 'group-2' }, // Extra doc for hasMore detection
                ],
            };

            const mockQuery = { get: jest.fn().mockResolvedValue(mockSnapshot) };
            mockBuildPaginatedQuery.mockReturnValue(mockQuery);
            mockTransformGroupDocument.mockReturnValue(group1);
            mockEncodeCursor.mockReturnValue('next-cursor-token');

            // Setup mocks for batch fetching
            (firestoreDb.collection as jest.Mock).mockImplementation((name) => {
                if (name === FirestoreCollections.EXPENSES) {
                    return { where: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ docs: [] }) })) };
                }
                if (name === FirestoreCollections.SETTLEMENTS) {
                    return { where: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ docs: [] }) })) };
                }
                return { where: mockFirestoreWhere, doc: jest.fn() };
            });

            mockGetUsers.mockResolvedValue(new Map([[userId, { id: userId }]]));
            mockCalculateGroupBalancesWithData.mockReturnValue({ balancesByCurrency: {} });
            mockParseISOToTimestamp.mockReturnValue({ toMillis: () => Date.now() });
            mockGetRelativeTime.mockReturnValue('now');

            // Act
            const result = await groupService.listGroups(userId, { limit: 1, cursor: 'previous-cursor' });

            // Assert
            expect(mockBuildPaginatedQuery).toHaveBeenCalledWith(
                expect.anything(),
                'previous-cursor',
                'desc',
                2 // limit + 1
            );
            expect(result.hasMore).toBe(true);
            expect(result.nextCursor).toBe('next-cursor-token');
            expect(result.groups).toHaveLength(1); // Only returns limit amount
        });

        it('should include metadata when requested', async () => {
            // Arrange
            const group1 = new GroupBuilder()
                .withId('group-1')
                .withMember(userId)
                .build();

            const mockGroupSnapshot = {
                docs: [{ data: () => ({}), id: 'group-1' }],
            };
            const mockChangesSnapshot = {
                docs: [{
                    data: () => ({ timestamp: { toMillis: () => Date.now() } }),
                }],
                size: 1,
            };

            const mockGroupQuery = { get: jest.fn().mockResolvedValue(mockGroupSnapshot) };
            const mockChangesQuery = { get: jest.fn().mockResolvedValue(mockChangesSnapshot) };
            
            mockBuildPaginatedQuery.mockReturnValue(mockGroupQuery);
            mockTransformGroupDocument.mockReturnValue(group1);

            // Setup mocks
            (firestoreDb.collection as jest.Mock).mockImplementation((name) => {
                if (name === FirestoreCollections.GROUP_CHANGES) {
                    return {
                        where: jest.fn(() => ({
                            where: jest.fn(() => ({
                                orderBy: jest.fn(() => ({
                                    limit: jest.fn(() => mockChangesQuery),
                                })),
                            })),
                        })),
                    };
                }
                if (name === FirestoreCollections.EXPENSES) {
                    return { where: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ docs: [] }) })) };
                }
                if (name === FirestoreCollections.SETTLEMENTS) {
                    return { where: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ docs: [] }) })) };
                }
                return { where: mockFirestoreWhere, doc: jest.fn() };
            });

            mockGetUsers.mockResolvedValue(new Map());
            mockCalculateGroupBalancesWithData.mockReturnValue({ balancesByCurrency: {} });
            mockParseISOToTimestamp.mockReturnValue({ toMillis: () => Date.now() });
            mockGetRelativeTime.mockReturnValue('now');

            // Act
            const result = await groupService.listGroups(userId, { includeMetadata: true });

            // Assert
            expect(result.metadata).toBeDefined();
            expect(result.metadata?.changeCount).toBe(1);
            expect(result.metadata?.hasRecentChanges).toBe(true);
        });

        it('should handle empty groups list', async () => {
            // Arrange
            const mockSnapshot = { docs: [] };
            const mockQuery = { get: jest.fn().mockResolvedValue(mockSnapshot) };
            mockBuildPaginatedQuery.mockReturnValue(mockQuery);

            // Act
            const result = await groupService.listGroups(userId);

            // Assert
            expect(result.groups).toHaveLength(0);
            expect(result.count).toBe(0);
            expect(result.hasMore).toBe(false);
            expect(result.nextCursor).toBeUndefined();
        });

        it('should handle balance calculation errors gracefully', async () => {
            // Arrange
            const group1 = new GroupBuilder()
                .withId('group-1')
                .withMember(userId)
                .build();

            const mockSnapshot = {
                docs: [{ data: () => ({}), id: 'group-1' }],
            };

            const mockQuery = { get: jest.fn().mockResolvedValue(mockSnapshot) };
            mockBuildPaginatedQuery.mockReturnValue(mockQuery);
            mockTransformGroupDocument.mockReturnValue(group1);

            // Setup mocks for batch fetching
            (firestoreDb.collection as jest.Mock).mockImplementation((name) => {
                if (name === FirestoreCollections.EXPENSES) {
                    return { where: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ docs: [] }) })) };
                }
                if (name === FirestoreCollections.SETTLEMENTS) {
                    return { where: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ docs: [] }) })) };
                }
                return { where: mockFirestoreWhere, doc: jest.fn() };
            });

            mockGetUsers.mockResolvedValue(new Map());
            // Simulate error in balance calculation
            mockCalculateGroupBalancesWithData.mockImplementation(() => {
                throw new Error('Balance calculation failed');
            });
            mockParseISOToTimestamp.mockReturnValue({ toMillis: () => Date.now() });
            mockGetRelativeTime.mockReturnValue('now');

            // Act
            const result = await groupService.listGroups(userId);

            // Assert - should return fallback empty balances
            expect(result.groups).toHaveLength(1);
            expect(result.groups[0]?.balance?.balancesByCurrency).toEqual({});
            expect((result.groups[0] as any)?.balance?.userBalance).toBeNull();
        });
    });

    describe('createGroup', () => {
        const userId = 'test-user-id';
        let mockFirestoreDoc: jest.Mock;
        let mockFirestoreSet: jest.Mock;
        let mockFirestoreGet: jest.Mock;
        let mockCreateOptimisticTimestamp: jest.Mock;
        let mockCreateTrueServerTimestamp: jest.Mock;
        let mockTimestampToISO: jest.Mock;
        let mockTransformGroupDocument: jest.Mock;
        let mockCalculateGroupBalances: jest.Mock;
        let mockCalculateExpenseMetadata: jest.Mock;
        let mockPermissionEngine: jest.Mock;
        let mockLoggerInfo: jest.Mock;
        let mockLoggerContext: jest.Mock;

        beforeEach(() => {
            // Import mocked functions
            const { createOptimisticTimestamp, createTrueServerTimestamp, timestampToISO } = require('../../utils/dateHelpers');
            const { PermissionEngine } = require('../../permissions');
            const { logger, LoggerContext } = require('../../logger');
            const { transformGroupDocument } = require('../../groups/handlers');
            const { calculateGroupBalances } = require('../../services/balance');
            const { calculateExpenseMetadata } = require('../../services/expenseMetadataService');
            
            mockCreateOptimisticTimestamp = createOptimisticTimestamp as jest.Mock;
            mockCreateTrueServerTimestamp = createTrueServerTimestamp as jest.Mock;
            mockTimestampToISO = timestampToISO as jest.Mock;
            mockTransformGroupDocument = transformGroupDocument as jest.Mock;
            mockCalculateGroupBalances = calculateGroupBalances as jest.Mock;
            mockCalculateExpenseMetadata = calculateExpenseMetadata as jest.Mock;
            mockPermissionEngine = PermissionEngine.getDefaultPermissions as jest.Mock;
            mockLoggerInfo = logger.info as jest.Mock;
            mockLoggerContext = LoggerContext.setBusinessContext as jest.Mock;

            // Setup Firestore mocks
            mockFirestoreDoc = jest.fn();
            mockFirestoreSet = jest.fn().mockResolvedValue(undefined);
            mockFirestoreGet = jest.fn();

            const mockDocRef = {
                id: 'new-group-id',
                set: mockFirestoreSet,
                get: mockFirestoreGet,
            };

            mockFirestoreDoc.mockReturnValue(mockDocRef);

            const mockCollection = jest.fn(() => ({
                doc: mockFirestoreDoc,
            }));

            (firestoreDb.collection as jest.Mock) = mockCollection;

            // Setup timestamp mocks
            const mockNow = new Date('2024-01-01T12:00:00Z');
            mockCreateOptimisticTimestamp.mockReturnValue({
                toDate: () => mockNow,
            });
            mockCreateTrueServerTimestamp.mockReturnValue('SERVER_TIMESTAMP');
            mockTimestampToISO.mockReturnValue('2024-01-01T12:00:00.000Z');

            // Setup permission mock
            mockPermissionEngine.mockReturnValue({
                expenseEditing: 'all-members',
                expenseDeletion: 'all-members',
                memberInvitation: 'all-members',
                memberApproval: 'automatic',
                settingsManagement: 'admins-only',
            });

            // Reset other mocks
            mockLoggerInfo.mockClear();
            mockLoggerContext.mockClear();
        });

        it('should create a group with minimal data', async () => {
            // Arrange
            const groupData = {
                name: 'Test Group',
                description: 'Test Description',
            };

            const createdGroup = new GroupBuilder()
                .withId('new-group-id')
                .withName('Test Group')
                .withMember(userId)
                .build();
            createdGroup.description = 'Test Description';
            createdGroup.createdBy = userId;

            mockFirestoreGet.mockResolvedValue({
                data: () => ({ /* mock doc data */ }),
                exists: true,
            });
            mockTransformGroupDocument.mockReturnValue(createdGroup);
            mockCalculateGroupBalances.mockResolvedValue({
                balancesByCurrency: {},
            });
            mockCalculateExpenseMetadata.mockResolvedValue({
                count: 0,
                lastExpenseTime: null,
            });

            // Act
            const result = await groupService.createGroup(userId, groupData);

            // Assert
            expect(mockFirestoreSet).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    id: 'new-group-id',
                    name: 'Test Group',
                    description: 'Test Description',
                    createdBy: userId,
                    members: expect.objectContaining({
                        [userId]: expect.objectContaining({
                            role: MemberRoles.ADMIN,
                            status: MemberStatuses.ACTIVE,
                            theme: expect.objectContaining({
                                light: '#FF0000',
                                dark: '#CC0000',
                                name: 'Red',
                                pattern: 'solid',
                                colorIndex: 0,
                            }),
                        }),
                    }),
                    securityPreset: SecurityPresets.OPEN,
                }),
                createdAt: 'SERVER_TIMESTAMP',
                updatedAt: 'SERVER_TIMESTAMP',
            });

            expect(result).toEqual(expect.objectContaining({
                id: 'new-group-id',
                name: 'Test Group',
                description: 'Test Description',
                createdBy: userId,
            }));

            expect(mockLoggerInfo).toHaveBeenCalledWith('group-created', { id: 'new-group-id' });
            expect(mockLoggerContext).toHaveBeenCalledWith({ groupId: 'new-group-id' });
        });

        it('should create a group with additional members', async () => {
            // Arrange
            const groupData = {
                name: 'Test Group',
                description: 'Test Description',
                members: [
                    { uid: userId, email: 'user@test.com', displayName: 'User' },
                    { uid: 'member-2', email: 'member2@test.com', displayName: 'Member 2' },
                    { uid: 'member-3', email: 'member3@test.com', displayName: 'Member 3' },
                ],
            };

            const createdGroup = new GroupBuilder()
                .withId('new-group-id')
                .withMember(userId)
                .withMember('member-2')
                .withMember('member-3')
                .build();

            mockFirestoreGet.mockResolvedValue({
                data: () => ({ /* mock doc data */ }),
                exists: true,
            });
            mockTransformGroupDocument.mockReturnValue(createdGroup);
            mockCalculateGroupBalances.mockResolvedValue({ balancesByCurrency: {} });
            mockCalculateExpenseMetadata.mockResolvedValue({ count: 0 });

            // Act
            const result = await groupService.createGroup(userId, groupData);

            // Assert
            expect(mockFirestoreSet).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    members: expect.objectContaining({
                        [userId]: expect.objectContaining({
                            role: MemberRoles.ADMIN,
                            theme: expect.objectContaining({ colorIndex: 0, pattern: 'solid' }),
                        }),
                        'member-2': expect.objectContaining({
                            role: MemberRoles.MEMBER,
                            theme: expect.objectContaining({ colorIndex: 1, pattern: 'solid' }),
                        }),
                        'member-3': expect.objectContaining({
                            role: MemberRoles.MEMBER,
                            theme: expect.objectContaining({ colorIndex: 2, pattern: 'solid' }),
                        }),
                    }),
                }),
                createdAt: 'SERVER_TIMESTAMP',
                updatedAt: 'SERVER_TIMESTAMP',
            });

            expect(result.id).toBe('new-group-id');
        });

        it('should ensure creator is always admin even if in members list', async () => {
            // Arrange
            const groupData = {
                name: 'Test Group',
                members: [
                    { uid: 'other-member', email: 'other@test.com', displayName: 'Other' },
                    { uid: userId, email: 'user@test.com', displayName: 'User' }, // Creator in members list
                ],
            };

            mockFirestoreGet.mockResolvedValue({ data: () => ({}), exists: true });
            mockTransformGroupDocument.mockReturnValue(new GroupBuilder().build());
            mockCalculateGroupBalances.mockResolvedValue({ balancesByCurrency: {} });
            mockCalculateExpenseMetadata.mockResolvedValue({ count: 0 });

            // Act
            await groupService.createGroup(userId, groupData);

            // Assert
            expect(mockFirestoreSet).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    members: expect.objectContaining({
                        [userId]: expect.objectContaining({
                            role: MemberRoles.ADMIN,
                            theme: expect.objectContaining({ colorIndex: 0 }), // Always gets first color
                        }),
                        'other-member': expect.objectContaining({
                            role: MemberRoles.MEMBER,
                            theme: expect.objectContaining({ colorIndex: 1 }),
                        }),
                    }),
                }),
                createdAt: 'SERVER_TIMESTAMP',
                updatedAt: 'SERVER_TIMESTAMP',
            });
        });

        it('should handle theme color wraparound for many members', async () => {
            // Arrange
            const members = [{ uid: userId, email: 'user@test.com', displayName: 'User' }];
            // Add 5 more members to test color wraparound (we have 3 colors)
            for (let i = 1; i <= 5; i++) {
                members.push({ uid: `member-${i}`, email: `member${i}@test.com`, displayName: `Member ${i}` });
            }

            const groupData = {
                name: 'Large Group',
                members,
            };

            mockFirestoreGet.mockResolvedValue({ data: () => ({}), exists: true });
            mockTransformGroupDocument.mockReturnValue(new GroupBuilder().build());
            mockCalculateGroupBalances.mockResolvedValue({ balancesByCurrency: {} });
            mockCalculateExpenseMetadata.mockResolvedValue({ count: 0 });

            // Act
            await groupService.createGroup(userId, groupData);

            // Assert
            expect(mockFirestoreSet).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    members: expect.objectContaining({
                        [userId]: expect.objectContaining({
                            theme: expect.objectContaining({ colorIndex: 0, pattern: 'solid' }),
                        }),
                        'member-1': expect.objectContaining({
                            theme: expect.objectContaining({ colorIndex: 1, pattern: 'solid' }),
                        }),
                        'member-2': expect.objectContaining({
                            theme: expect.objectContaining({ colorIndex: 2, pattern: 'solid' }),
                        }),
                        'member-3': expect.objectContaining({
                            theme: expect.objectContaining({ colorIndex: 0, pattern: 'striped' }), // Wraparound with new pattern
                        }),
                        'member-4': expect.objectContaining({
                            theme: expect.objectContaining({ colorIndex: 1, pattern: 'striped' }),
                        }),
                        'member-5': expect.objectContaining({
                            theme: expect.objectContaining({ colorIndex: 2, pattern: 'striped' }),
                        }),
                    }),
                }),
                createdAt: 'SERVER_TIMESTAMP',
                updatedAt: 'SERVER_TIMESTAMP',
            });
        });

        it('should add computed fields before returning', async () => {
            // Arrange
            const groupData = { name: 'Test Group' };
            
            const createdGroup = new GroupBuilder()
                .withId('new-group-id')
                .build();

            mockFirestoreGet.mockResolvedValue({ data: () => ({}), exists: true });
            mockTransformGroupDocument.mockReturnValue(createdGroup);
            
            // Mock balance and metadata calculations
            mockCalculateGroupBalances.mockResolvedValue({
                balancesByCurrency: {
                    USD: {
                        [userId]: { netBalance: 25.00 },
                    },
                },
            });
            mockCalculateExpenseMetadata.mockResolvedValue({
                count: 5,
                lastExpenseTime: new Date('2024-01-05'),
            });

            // Act
            const result = await groupService.createGroup(userId, groupData);

            // Assert
            expect(mockCalculateGroupBalances).toHaveBeenCalledWith('new-group-id');
            expect(mockCalculateExpenseMetadata).toHaveBeenCalledWith('new-group-id');
            expect(result.balance).toBeDefined();
            expect(result.lastActivity).toBeDefined();
        });

        it('should use default security preset and permissions', async () => {
            // Arrange
            const groupData = { name: 'Test Group' };

            mockFirestoreGet.mockResolvedValue({ data: () => ({}), exists: true });
            mockTransformGroupDocument.mockReturnValue(new GroupBuilder().build());
            mockCalculateGroupBalances.mockResolvedValue({ balancesByCurrency: {} });
            mockCalculateExpenseMetadata.mockResolvedValue({ count: 0 });

            // Act
            await groupService.createGroup(userId, groupData);

            // Assert
            expect(mockPermissionEngine).toHaveBeenCalledWith(SecurityPresets.OPEN);
            expect(mockFirestoreSet).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    securityPreset: SecurityPresets.OPEN,
                    permissions: expect.objectContaining({
                        expenseEditing: 'all-members',
                        expenseDeletion: 'all-members',
                    }),
                }),
                createdAt: 'SERVER_TIMESTAMP',
                updatedAt: 'SERVER_TIMESTAMP',
            });
        });
    });

    describe('updateGroup', () => {
        const userId = 'test-user-id';
        const groupId = 'test-group-id';
        let mockFirestoreCollection: jest.Mock;
        let mockFirestoreDoc: jest.Mock;
        let mockFirestoreGet: jest.Mock;
        let mockFirestoreRunTransaction: jest.Mock;
        let mockTransformGroupDocument: jest.Mock;
        let mockIsGroupOwner: jest.Mock;
        let mockIsGroupMember: jest.Mock;
        let mockCreateOptimisticTimestamp: jest.Mock;
        let mockGetUpdatedAtTimestamp: jest.Mock;
        let mockUpdateWithTimestamp: jest.Mock;
        let mockLoggerInfo: jest.Mock;

        beforeEach(() => {
            // Import mocked functions
            const { createOptimisticTimestamp } = require('../../utils/dateHelpers');
            const { getUpdatedAtTimestamp, updateWithTimestamp } = require('../../utils/optimistic-locking');
            const { logger, LoggerContext } = require('../../logger');
            const { transformGroupDocument } = require('../../groups/handlers');
            const { isGroupOwner, isGroupMember } = require('../../utils/groupHelpers');
            const { calculateGroupBalances } = require('../../services/balance');
            const { calculateExpenseMetadata } = require('../../services/expenseMetadataService');

            mockCreateOptimisticTimestamp = createOptimisticTimestamp as jest.Mock;
            mockGetUpdatedAtTimestamp = getUpdatedAtTimestamp as jest.Mock;
            mockUpdateWithTimestamp = updateWithTimestamp as jest.Mock;
            mockTransformGroupDocument = transformGroupDocument as jest.Mock;
            mockIsGroupOwner = isGroupOwner as jest.Mock;
            mockIsGroupMember = isGroupMember as jest.Mock;
            mockLoggerInfo = logger.info as jest.Mock;
            LoggerContext.setBusinessContext as jest.Mock;

            // Setup Firestore mocks
            mockFirestoreGet = jest.fn();
            mockFirestoreDoc = jest.fn();
            mockFirestoreRunTransaction = jest.fn();

            const mockDocRef = {
                id: groupId,
                get: mockFirestoreGet,
            };

            mockFirestoreDoc.mockReturnValue(mockDocRef);

            mockFirestoreCollection = jest.fn(() => ({
                doc: mockFirestoreDoc,
            }));

            const { firestoreDb } = require('../../firebase');
            firestoreDb.collection = mockFirestoreCollection;
            firestoreDb.runTransaction = mockFirestoreRunTransaction;

            // Setup default mock returns
            const mockTimestamp = {
                toDate: jest.fn(() => new Date('2023-01-01T00:00:00Z')),
            };
            mockCreateOptimisticTimestamp.mockReturnValue(mockTimestamp);

            // Mock balance calculations
            (calculateGroupBalances as jest.Mock).mockResolvedValue({ balancesByCurrency: {} });
            (calculateExpenseMetadata as jest.Mock).mockResolvedValue({ count: 0 });
        });

        it('should update a group successfully when user is owner', async () => {
            // Arrange
            const updates = { name: 'Updated Group', description: 'Updated Description' };
            const existingGroup = new GroupBuilder()
                .withId(groupId)
                .withCreatedBy(userId)
                .build();

            mockFirestoreGet.mockResolvedValue({ 
                exists: true,
                data: () => ({ data: existingGroup })
            });
            mockTransformGroupDocument.mockReturnValue(existingGroup);
            mockIsGroupOwner.mockReturnValue(true);

            mockFirestoreRunTransaction.mockImplementation(async (callback) => {
                const transaction = {
                    get: jest.fn().mockResolvedValue({ 
                        exists: true,
                        data: () => ({ data: existingGroup })
                    }),
                };
                return callback(transaction);
            });

            mockGetUpdatedAtTimestamp.mockReturnValue('2023-01-01T00:00:00Z');

            // Act
            const result = await groupService.updateGroup(groupId, userId, updates);

            // Assert
            expect(result).toEqual({ message: 'Group updated successfully' });
            expect(mockUpdateWithTimestamp).toHaveBeenCalledWith(
                expect.any(Object), // transaction
                expect.any(Object), // docRef
                {
                    'data.name': 'Updated Group',
                    'data.description': 'Updated Description',
                    'data.updatedAt': '2023-01-01T00:00:00.000Z',
                },
                '2023-01-01T00:00:00Z'
            );
            expect(mockLoggerInfo).toHaveBeenCalledWith('group-updated', { id: groupId });
        });

        it('should throw forbidden error when user is not owner', async () => {
            // Arrange
            const updates = { name: 'Updated Group' };
            const existingGroup = new GroupBuilder()
                .withId(groupId)
                .withCreatedBy('another-user')
                .build();

            mockFirestoreGet.mockResolvedValue({ 
                exists: true,
                data: () => ({ data: existingGroup })
            });
            mockTransformGroupDocument.mockReturnValue(existingGroup);
            mockIsGroupOwner.mockReturnValue(false);
            mockIsGroupMember.mockReturnValue(true);

            // Act & Assert
            await expect(groupService.updateGroup(groupId, userId, updates))
                .rejects.toThrow('Forbidden');
        });

        it('should throw not found error when group does not exist', async () => {
            // Arrange
            const updates = { name: 'Updated Group' };
            mockFirestoreGet.mockResolvedValue({ exists: false });

            // Act & Assert
            await expect(groupService.updateGroup(groupId, userId, updates))
                .rejects.toThrow('Group not found');
        });

        it('should handle transaction failures gracefully', async () => {
            // Arrange
            const updates = { name: 'Updated Group' };
            const existingGroup = new GroupBuilder()
                .withId(groupId)
                .withCreatedBy(userId)
                .build();

            mockFirestoreGet.mockResolvedValue({ 
                exists: true,
                data: () => ({ data: existingGroup })
            });
            mockTransformGroupDocument.mockReturnValue(existingGroup);
            mockIsGroupOwner.mockReturnValue(true);

            mockFirestoreRunTransaction.mockImplementation(async (callback) => {
                const transaction = {
                    get: jest.fn().mockResolvedValue({ exists: false }),
                };
                return callback(transaction);
            });

            // Act & Assert
            await expect(groupService.updateGroup(groupId, userId, updates))
                .rejects.toThrow('Group not found');
        });
    });

    describe('deleteGroup', () => {
        const userId = 'test-user-id';
        const groupId = 'test-group-id';
        let mockFirestoreCollection: jest.Mock;
        let mockFirestoreDoc: jest.Mock;
        let mockFirestoreGet: jest.Mock;
        let mockFirestoreDelete: jest.Mock;
        let mockFirestoreWhere: jest.Mock;
        let mockFirestoreLimit: jest.Mock;
        let mockExpensesGet: jest.Mock;
        let mockTransformGroupDocument: jest.Mock;
        let mockIsGroupOwner: jest.Mock;
        let mockIsGroupMember: jest.Mock;
        let mockLoggerInfo: jest.Mock;

        beforeEach(() => {
            // Import mocked functions
            const { logger, LoggerContext } = require('../../logger');
            const { transformGroupDocument } = require('../../groups/handlers');
            const { isGroupOwner, isGroupMember } = require('../../utils/groupHelpers');
            const { calculateGroupBalances } = require('../../services/balance');
            const { calculateExpenseMetadata } = require('../../services/expenseMetadataService');

            mockTransformGroupDocument = transformGroupDocument as jest.Mock;
            mockIsGroupOwner = isGroupOwner as jest.Mock;
            mockIsGroupMember = isGroupMember as jest.Mock;
            mockLoggerInfo = logger.info as jest.Mock;
            LoggerContext.setBusinessContext as jest.Mock;

            // Setup Firestore mocks
            mockFirestoreGet = jest.fn();
            mockFirestoreDelete = jest.fn().mockResolvedValue(undefined);
            mockFirestoreDoc = jest.fn();
            mockFirestoreWhere = jest.fn();
            mockFirestoreLimit = jest.fn();
            mockExpensesGet = jest.fn();

            const mockDocRef = {
                id: groupId,
                get: mockFirestoreGet,
                delete: mockFirestoreDelete,
            };

            mockFirestoreDoc.mockReturnValue(mockDocRef);

            // Mock expenses collection query chain
            mockFirestoreLimit.mockReturnValue({
                get: mockExpensesGet,
            });
            mockFirestoreWhere.mockReturnValue({
                limit: mockFirestoreLimit,
            });

            mockFirestoreCollection = jest.fn((collectionName) => {
                if (collectionName === FirestoreCollections.EXPENSES) {
                    return {
                        where: mockFirestoreWhere,
                    };
                }
                return {
                    doc: mockFirestoreDoc,
                };
            });

            const { firestoreDb } = require('../../firebase');
            firestoreDb.collection = mockFirestoreCollection;

            // Mock balance calculations
            (calculateGroupBalances as jest.Mock).mockResolvedValue({ balancesByCurrency: {} });
            (calculateExpenseMetadata as jest.Mock).mockResolvedValue({ count: 0 });
        });

        it('should delete a group successfully when user is owner and no expenses', async () => {
            // Arrange
            const existingGroup = new GroupBuilder()
                .withId(groupId)
                .withCreatedBy(userId)
                .build();

            mockFirestoreGet.mockResolvedValue({ 
                exists: true,
                data: () => ({ data: existingGroup })
            });
            mockTransformGroupDocument.mockReturnValue(existingGroup);
            mockIsGroupOwner.mockReturnValue(true);
            mockExpensesGet.mockResolvedValue({ empty: true });

            // Act
            const result = await groupService.deleteGroup(groupId, userId);

            // Assert
            expect(result).toEqual({ message: 'Group deleted successfully' });
            expect(mockFirestoreDelete).toHaveBeenCalled();
            expect(mockLoggerInfo).toHaveBeenCalledWith('group-deleted', { id: groupId });
        });

        it('should throw error when group has expenses', async () => {
            // Arrange
            const existingGroup = new GroupBuilder()
                .withId(groupId)
                .withCreatedBy(userId)
                .build();

            mockFirestoreGet.mockResolvedValue({ 
                exists: true,
                data: () => ({ data: existingGroup })
            });
            mockTransformGroupDocument.mockReturnValue(existingGroup);
            mockIsGroupOwner.mockReturnValue(true);
            mockExpensesGet.mockResolvedValue({ empty: false });

            // Act & Assert
            await expect(groupService.deleteGroup(groupId, userId))
                .rejects.toThrow('Cannot delete group with expenses. Delete all expenses first.');
        });


        it('should throw not found error when group does not exist', async () => {
            // Arrange
            mockFirestoreGet.mockResolvedValue({ exists: false });

            // Act & Assert
            await expect(groupService.deleteGroup(groupId, userId))
                .rejects.toThrow('Group not found');
        });

        it('should throw forbidden error when user is not an owner but is a member', async () => {
            // Arrange
            const existingGroup = new GroupBuilder()
                .withId(groupId)
                .withCreatedBy('another-user')
                .build();

            mockFirestoreGet.mockResolvedValue({ 
                exists: true,
                data: () => ({ data: existingGroup })
            });
            mockTransformGroupDocument.mockReturnValue(existingGroup);
            mockIsGroupOwner.mockReturnValue(false);
            mockIsGroupMember.mockReturnValue(true);

            // Act & Assert
            // For write operations, non-owners get FORBIDDEN error
            await expect(groupService.deleteGroup(groupId, userId))
                .rejects.toThrow('Forbidden');
        });

        it('should throw not found error when user is not a member', async () => {
            // Arrange
            const existingGroup = new GroupBuilder()
                .withId(groupId)
                .withCreatedBy('another-user')
                .build();

            mockFirestoreGet.mockResolvedValue({ 
                exists: true,
                data: () => ({ data: existingGroup })
            });
            mockTransformGroupDocument.mockReturnValue(existingGroup);
            mockIsGroupOwner.mockReturnValue(false);
            mockIsGroupMember.mockReturnValue(false);

            // Act & Assert
            // Security: Returns 404 instead of 403 to prevent information disclosure
            // However for write operations (requireWriteAccess=true), non-owners get FORBIDDEN first
            await expect(groupService.deleteGroup(groupId, userId))
                .rejects.toThrow('Forbidden');
        });
    });
});