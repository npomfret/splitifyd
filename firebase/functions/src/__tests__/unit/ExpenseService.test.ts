import { describe, expect, beforeEach, vi, it } from 'vitest';
import { ExpenseService } from '../../services/ExpenseService';
import { firestoreDb } from '../../firebase';
import { ApiError, Errors } from '../../utils/errors';
import { HTTP_STATUS } from '../../constants';
import { FirestoreCollections, SplitTypes, CreateExpenseRequest } from '@splitifyd/shared';
import { timestampToISO, parseISOToTimestamp } from '../../utils/dateHelpers';
import * as dateHelpers from '../../utils/dateHelpers';
import * as groupHelpers from '../../utils/groupHelpers';
import { Timestamp } from 'firebase-admin/firestore';
import { PermissionEngine } from '../../permissions';

// Mock dependencies
vi.mock('../../firebase');
vi.mock('../../logger');
vi.mock('../../utils/groupHelpers');
vi.mock('../../groups/handlers');
vi.mock('../../permissions');

// Type the mocked dependencies
const mockFirestoreDb = firestoreDb as any;
const mockGroupHelpers = groupHelpers as any;
const mockPermissionEngine = PermissionEngine as any;

describe('ExpenseService', () => {
    let service: ExpenseService;
    let mockExpensesCollection: any;
    let mockGroupsCollection: any;
    let mockDoc: any;
    let mockGroupDoc: any;

    const mockExpenseId = 'expense123';
    const mockUserId = 'user123';
    const mockGroupId = 'group123';

    const mockTimestamp = Timestamp.fromDate(new Date('2024-01-01'));

    const mockExpenseData = {
        id: mockExpenseId,
        groupId: mockGroupId,
        createdBy: mockUserId,
        paidBy: mockUserId,
        amount: 100,
        currency: 'USD',
        description: 'Test expense',
        category: 'Food',
        date: mockTimestamp,
        splitType: SplitTypes.EQUAL,
        participants: [mockUserId, 'user456'],
        splits: [
            { userId: mockUserId, amount: 50 },
            { userId: 'user456', amount: 50 },
        ],
        receiptUrl: 'https://example.com/receipt.jpg',
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
        deletedAt: null,
        deletedBy: null,
    };

    const mockGroupData = {
        data: {
            name: 'Test Group',
            members: {
                [mockUserId]: { role: 'ADMIN', joinedAt: mockTimestamp },
                user456: { role: 'MEMBER', joinedAt: mockTimestamp },
            },
        },
    };

    let mockExpenseDocRef: any;
    let mockTransaction: any;

    beforeEach(() => {
        // Create mock document references
        mockDoc = {
            exists: true,
            id: mockExpenseId,
            data: vi.fn(() => mockExpenseData),
            get: vi.fn(),
        };

        mockGroupDoc = {
            exists: true,
            id: mockGroupId,
            data: vi.fn(() => mockGroupData),
            get: vi.fn(),
        };

        // Create mock expense document reference
        mockExpenseDocRef = {
            get: vi.fn().mockResolvedValue(mockDoc),
            collection: vi.fn(() => ({
                doc: vi.fn(() => ({})),
            })),
        };

        // Create mock transaction
        mockTransaction = {
            get: vi.fn().mockResolvedValue(mockDoc),
            set: vi.fn(),
            update: vi.fn(),
        };

        // Create mock collections
        mockExpensesCollection = {
            doc: vi.fn(() => mockExpenseDocRef),
            where: vi.fn(),
            select: vi.fn(),
            orderBy: vi.fn(),
            limit: vi.fn(),
            startAfter: vi.fn(),
            get: vi.fn(),
        };

        mockGroupsCollection = {
            doc: vi.fn(() => ({
                get: vi.fn().mockResolvedValue(mockGroupDoc),
            })),
        };

        // Mock Firestore database
        mockFirestoreDb.collection.mockImplementation((collection: string) => {
            if (collection === FirestoreCollections.EXPENSES) {
                return mockExpensesCollection;
            }
            if (collection === FirestoreCollections.GROUPS) {
                return mockGroupsCollection;
            }
            return null;
        });

        // Mock runTransaction
        mockFirestoreDb.runTransaction.mockImplementation(async (callback: any) => {
            return callback(mockTransaction);
        });

        service = new ExpenseService();
    });

    describe('getExpense', () => {
        it('should successfully get an expense when user is a participant', async () => {
            const result = await service.getExpense(mockExpenseId, mockUserId);

            expect(result).toEqual({
                id: mockExpenseId,
                groupId: mockGroupId,
                createdBy: mockUserId,
                paidBy: mockUserId,
                amount: 100,
                currency: 'USD',
                description: 'Test expense',
                category: 'Food',
                date: timestampToISO(mockTimestamp),
                splitType: SplitTypes.EQUAL,
                participants: [mockUserId, 'user456'],
                splits: [
                    { userId: mockUserId, amount: 50 },
                    { userId: 'user456', amount: 50 },
                ],
                receiptUrl: 'https://example.com/receipt.jpg',
                createdAt: timestampToISO(mockTimestamp),
                updatedAt: timestampToISO(mockTimestamp),
                deletedAt: null,
                deletedBy: null,
            });

            expect(mockExpensesCollection.doc).toHaveBeenCalledWith(mockExpenseId);
        });

        it('should deny access to group members who are not participants in the expense', async () => {
            // User is not a participant but is a group member
            const nonParticipantUserId = 'user789';

            // This should throw a FORBIDDEN error
            await expect(service.getExpense(mockExpenseId, nonParticipantUserId)).rejects.toEqual(
                new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_EXPENSE_PARTICIPANT', 'You are not a participant in this expense'),
            );
        });

        it('should throw NOT_FOUND error when expense does not exist', async () => {
            mockDoc.exists = false;

            await expect(service.getExpense(mockExpenseId, mockUserId)).rejects.toEqual(Errors.NOT_FOUND('Expense'));

            expect(mockExpensesCollection.doc).toHaveBeenCalledWith(mockExpenseId);
        });

        it('should throw NOT_FOUND error when expense is soft-deleted', async () => {
            mockDoc.data.mockReturnValue({
                ...mockExpenseData,
                deletedAt: mockTimestamp,
                deletedBy: 'someUserId',
            });

            await expect(service.getExpense(mockExpenseId, mockUserId)).rejects.toEqual(Errors.NOT_FOUND('Expense'));
        });

        it('should throw FORBIDDEN error when user is neither participant nor group member', async () => {
            const unauthorizedUserId = 'unauthorized123';

            await expect(service.getExpense(mockExpenseId, unauthorizedUserId)).rejects.toEqual(
                new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_EXPENSE_PARTICIPANT', 'You are not a participant in this expense'),
            );
        });

        it('should handle expense without receiptUrl', async () => {
            mockDoc.data.mockReturnValue({
                ...mockExpenseData,
                receiptUrl: undefined,
            });

            const result = await service.getExpense(mockExpenseId, mockUserId);

            expect(result.receiptUrl).toBeUndefined();
        });

        it('should throw INVALID_EXPENSE_DATA error when document structure is invalid', async () => {
            // Missing required field like groupId
            mockDoc.data.mockReturnValue({
                ...mockExpenseData,
                groupId: undefined,
            });

            await expect(service.getExpense(mockExpenseId, mockUserId)).rejects.toEqual(new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_EXPENSE_DATA', 'Expense data is corrupted'));
        });

        it('should handle expense with empty participants array', async () => {
            mockDoc.data.mockReturnValue({
                ...mockExpenseData,
                participants: [],
            });

            await expect(service.getExpense(mockExpenseId, mockUserId)).rejects.toEqual(new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_EXPENSE_DATA', 'Expense data is corrupted'));
        });
    });

    describe('listGroupExpenses', () => {
        const mockQuerySnapshot = {
            docs: [
                {
                    id: 'expense1',
                    data: () => ({
                        groupId: mockGroupId,
                        createdBy: mockUserId,
                        paidBy: mockUserId,
                        amount: 100,
                        currency: 'USD',
                        description: 'Expense 1',
                        category: 'Food',
                        date: mockTimestamp,
                        splitType: SplitTypes.EQUAL,
                        participants: [mockUserId, 'user456'],
                        splits: [
                            { userId: mockUserId, amount: 50 },
                            { userId: 'user456', amount: 50 },
                        ],
                        createdAt: mockTimestamp,
                        updatedAt: mockTimestamp,
                        deletedAt: null,
                        deletedBy: null,
                    }),
                },
                {
                    id: 'expense2',
                    data: () => ({
                        groupId: mockGroupId,
                        createdBy: 'user456',
                        paidBy: 'user456',
                        amount: 200,
                        currency: 'USD',
                        description: 'Expense 2',
                        category: 'Entertainment',
                        date: mockTimestamp,
                        splitType: SplitTypes.EQUAL,
                        participants: [mockUserId, 'user456'],
                        splits: [
                            { userId: mockUserId, amount: 100 },
                            { userId: 'user456', amount: 100 },
                        ],
                        createdAt: mockTimestamp,
                        updatedAt: mockTimestamp,
                        deletedAt: null,
                        deletedBy: null,
                    }),
                },
            ],
        };

        beforeEach(() => {
            // Mock the query chain
            const mockQuery = {
                where: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                orderBy: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                startAfter: vi.fn().mockReturnThis(),
                get: vi.fn().mockResolvedValue(mockQuerySnapshot),
            };

            mockExpensesCollection.where.mockReturnValue(mockQuery);
            mockExpensesCollection.select = mockQuery.select;
            mockExpensesCollection.orderBy = mockQuery.orderBy;
            mockExpensesCollection.limit = mockQuery.limit;
            mockExpensesCollection.startAfter = mockQuery.startAfter;
            mockExpensesCollection.get = mockQuery.get;

            // Mock verifyGroupMembership
            mockGroupHelpers.verifyGroupMembership.mockResolvedValue(undefined);
        });

        it('should successfully list group expenses', async () => {
            const result = await service.listGroupExpenses(mockGroupId, mockUserId);

            expect(result).toEqual({
                expenses: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'expense1',
                        description: 'Expense 1',
                        amount: 100,
                    }),
                    expect.objectContaining({
                        id: 'expense2',
                        description: 'Expense 2',
                        amount: 200,
                    }),
                ]),
                count: 2,
                hasMore: false,
                nextCursor: undefined,
            });
        });

        it('should handle pagination with limit', async () => {
            await service.listGroupExpenses(mockGroupId, mockUserId, { limit: 10 });

            expect(mockExpensesCollection.limit).toHaveBeenCalledWith(11); // limit + 1 for hasMore check
        });

        it('should handle cursor-based pagination', async () => {
            const cursor = Buffer.from(
                JSON.stringify({
                    date: '2024-01-01T00:00:00.000Z',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    id: 'lastExpenseId',
                }),
            ).toString('base64');

            await service.listGroupExpenses(mockGroupId, mockUserId, { cursor });

            expect(mockExpensesCollection.startAfter).toHaveBeenCalled();
        });

        it('should filter out deleted expenses by default', async () => {
            // Reset the mock to track calls properly
            const mockQuery = {
                where: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                orderBy: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                startAfter: vi.fn().mockReturnThis(),
                get: vi.fn().mockResolvedValue(mockQuerySnapshot),
            };

            mockExpensesCollection.where = vi.fn().mockReturnValue(mockQuery);

            await service.listGroupExpenses(mockGroupId, mockUserId);

            // Check that the where method was called with deletedAt filter
            const collectionWhereCalls = mockExpensesCollection.where.mock.calls;
            const queryWhereCalls = mockQuery.where.mock.calls;

            // First where should be on collection for groupId
            expect(collectionWhereCalls[0]).toEqual(['groupId', '==', mockGroupId]);
            // Second where should be on query for deletedAt
            expect(queryWhereCalls[0]).toEqual(['deletedAt', '==', null]);
        });

        it('should include deleted expenses when requested', async () => {
            await service.listGroupExpenses(mockGroupId, mockUserId, { includeDeleted: true });

            expect(mockExpensesCollection.where).not.toHaveBeenCalledWith('deletedAt', '==', null);
        });

        it('should throw error for invalid cursor', async () => {
            const invalidCursor = 'invalid-cursor-format';

            await expect(service.listGroupExpenses(mockGroupId, mockUserId, { cursor: invalidCursor })).rejects.toEqual(
                new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_CURSOR', 'Invalid cursor format'),
            );
        });

        it('should handle empty expense list', async () => {
            mockQuerySnapshot.docs = [];

            const result = await service.listGroupExpenses(mockGroupId, mockUserId);

            expect(result).toEqual({
                expenses: [],
                count: 0,
                hasMore: false,
                nextCursor: undefined,
            });
        });

        it('should generate nextCursor when there are more results', async () => {
            // Create a custom mock for this test with 3 expenses
            const mockQueryWithThreeDocs = {
                docs: [
                    {
                        id: 'expense1',
                        data: () => ({
                            ...mockExpenseData,
                            id: 'expense1',
                            description: 'Expense 1',
                            amount: 100,
                        }),
                    },
                    {
                        id: 'expense2',
                        data: () => ({
                            ...mockExpenseData,
                            id: 'expense2',
                            description: 'Expense 2',
                            amount: 200,
                        }),
                    },
                    {
                        id: 'expense3',
                        data: () => ({
                            ...mockExpenseData,
                            id: 'expense3',
                            description: 'Expense 3',
                            amount: 300,
                        }),
                    },
                ],
            };

            // Mock the query chain to return 3 docs when limit is 3 (service requests limit+1)
            const mockQuery: any = {
                where: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                orderBy: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                startAfter: vi.fn().mockReturnThis(),
                get: vi.fn().mockResolvedValue(mockQueryWithThreeDocs),
            };

            mockExpensesCollection.where = vi.fn().mockReturnValue(mockQuery);

            const result = await service.listGroupExpenses(mockGroupId, mockUserId, { limit: 2 });

            expect(result.expenses.length).toBe(2);
            expect(result.hasMore).toBe(true);
            expect(result.nextCursor).toBeDefined();
        });
    });

    describe('createExpense', () => {
        let mockTransaction: any;
        let mockNewDocRef: any;
        const mockNewExpenseId = 'newExpense123';

        const mockCreateExpenseData: CreateExpenseRequest = {
            groupId: mockGroupId,
            paidBy: mockUserId,
            amount: 150,
            currency: 'USD',
            description: 'New test expense',
            category: 'Food',
            date: '2024-01-01T00:00:00.000Z',
            splitType: SplitTypes.EQUAL,
            participants: [mockUserId, 'user456'],
            splits: [],
        };

        beforeEach(() => {
            // Mock document reference for new expense
            mockNewDocRef = {
                id: mockNewExpenseId,
                set: vi.fn(),
            };

            // Mock expenses collection doc() for new document
            mockExpensesCollection.doc = vi.fn(() => mockNewDocRef);

            // Mock transaction
            mockTransaction = {
                get: vi.fn().mockResolvedValue({
                    exists: true,
                    data: vi.fn(() => ({
                        data: {
                            name: 'Test Group',
                            description: 'Test Description',
                            createdBy: 'creator123',
                            members: {
                                [mockUserId]: { role: 'ADMIN', status: 'ACTIVE', joinedAt: mockTimestamp },
                                user456: { role: 'MEMBER', status: 'ACTIVE', joinedAt: mockTimestamp },
                            },
                            permissions: {
                                expenseEditing: 'ANYONE',
                            },
                        },
                        createdAt: mockTimestamp,
                        updatedAt: mockTimestamp,
                    })),
                }),
                set: vi.fn(),
            };

            // Mock firestoreDb.runTransaction
            mockFirestoreDb.runTransaction.mockImplementation(async (callback: any) => {
                return callback(mockTransaction);
            });

            // Mock group document
            mockGroupDoc = {
                exists: true,
                id: mockGroupId,
                data: vi.fn(() => ({
                    data: {
                        name: 'Test Group',
                        description: 'Test Description',
                        createdBy: 'creator123',
                        members: {
                            [mockUserId]: { role: 'ADMIN', status: 'ACTIVE', joinedAt: mockTimestamp },
                            user456: { role: 'MEMBER', status: 'ACTIVE', joinedAt: mockTimestamp },
                        },
                        permissions: {
                            expenseEditing: 'ANYONE',
                        },
                    },
                    createdAt: mockTimestamp,
                    updatedAt: mockTimestamp,
                })),
                get: vi.fn(),
            };

            mockGroupsCollection.doc = vi.fn(() => ({
                get: vi.fn().mockResolvedValue(mockGroupDoc),
            }));

            // Mock verifyGroupMembership
            mockGroupHelpers.verifyGroupMembership.mockResolvedValue(undefined);

            // Mock PermissionEngine
            mockPermissionEngine.checkPermission.mockReturnValue(true);

            // Mock createServerTimestamp
            vi.spyOn(dateHelpers, 'createServerTimestamp').mockReturnValue(mockTimestamp);
        });

        it('should successfully create an expense with equal splits', async () => {
            const result = await service.createExpense(mockUserId, mockCreateExpenseData);

            // Verify the result structure
            expect(result).toEqual(
                expect.objectContaining({
                    id: mockNewExpenseId,
                    groupId: mockGroupId,
                    createdBy: mockUserId,
                    paidBy: mockUserId,
                    amount: 150,
                    currency: 'USD',
                    description: 'New test expense',
                    category: 'Food',
                    splitType: SplitTypes.EQUAL,
                    participants: [mockUserId, 'user456'],
                    splits: [
                        { userId: mockUserId, amount: 75 },
                        { userId: 'user456', amount: 75 },
                    ],
                }),
            );

            // Verify group membership was checked
            expect(groupHelpers.verifyGroupMembership).toHaveBeenCalledWith(mockGroupId, mockUserId);

            // Verify permission was checked
            expect(PermissionEngine.checkPermission).toHaveBeenCalledWith(expect.objectContaining({ id: mockGroupId }), mockUserId, 'expenseEditing');

            // Verify transaction was used
            expect(firestoreDb.runTransaction).toHaveBeenCalled();
            expect(mockTransaction.set).toHaveBeenCalledWith(
                mockNewDocRef,
                expect.objectContaining({
                    id: mockNewExpenseId,
                    groupId: mockGroupId,
                    createdBy: mockUserId,
                    amount: 150,
                }),
            );
        });

        it('should successfully create expense with exact splits', async () => {
            const dataWithExactSplits: CreateExpenseRequest = {
                ...mockCreateExpenseData,
                splitType: SplitTypes.EXACT,
                splits: [
                    { userId: mockUserId, amount: 100 },
                    { userId: 'user456', amount: 50 },
                ],
            };

            const result = await service.createExpense(mockUserId, dataWithExactSplits);

            expect(result.splits).toEqual([
                { userId: mockUserId, amount: 100 },
                { userId: 'user456', amount: 50 },
            ]);
        });

        it('should successfully create expense with percentage splits', async () => {
            const dataWithPercentageSplits: CreateExpenseRequest = {
                ...mockCreateExpenseData,
                splitType: SplitTypes.PERCENTAGE,
                splits: [
                    { userId: mockUserId, amount: 0, percentage: 60 },
                    { userId: 'user456', amount: 0, percentage: 40 },
                ],
            };

            const result = await service.createExpense(mockUserId, dataWithPercentageSplits);

            expect(result.splits).toEqual([
                { userId: mockUserId, amount: 90, percentage: 60 },
                { userId: 'user456', amount: 60, percentage: 40 },
            ]);
        });

        it('should include receiptUrl when provided', async () => {
            const dataWithReceipt: CreateExpenseRequest = {
                ...mockCreateExpenseData,
                receiptUrl: 'https://example.com/receipt.jpg',
            };

            const result = await service.createExpense(mockUserId, dataWithReceipt);

            expect(result.receiptUrl).toBe('https://example.com/receipt.jpg');
        });

        it('should throw error when user is not a group member', async () => {
            mockGroupHelpers.verifyGroupMembership.mockRejectedValue(new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_GROUP_MEMBER', 'User is not a member of this group'));

            await expect(service.createExpense(mockUserId, mockCreateExpenseData)).rejects.toEqual(new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_GROUP_MEMBER', 'User is not a member of this group'));
        });

        it('should throw error when group does not exist', async () => {
            mockGroupDoc.exists = false;

            await expect(service.createExpense(mockUserId, mockCreateExpenseData)).rejects.toEqual(Errors.NOT_FOUND('Group'));
        });

        it('should throw error when user lacks permission to create expenses', async () => {
            mockPermissionEngine.checkPermission.mockReturnValue(false);

            await expect(service.createExpense(mockUserId, mockCreateExpenseData)).rejects.toEqual(
                new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to create expenses in this group'),
            );
        });

        it('should throw error when payer is not a group member', async () => {
            const dataWithInvalidPayer: CreateExpenseRequest = {
                ...mockCreateExpenseData,
                paidBy: 'notAMember123',
            };

            await expect(service.createExpense(mockUserId, dataWithInvalidPayer)).rejects.toEqual(new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PAYER', 'Payer must be a member of the group'));
        });

        it('should throw error when participant is not a group member', async () => {
            const dataWithInvalidParticipant: CreateExpenseRequest = {
                ...mockCreateExpenseData,
                participants: [mockUserId, 'notAMember456'],
            };

            await expect(service.createExpense(mockUserId, dataWithInvalidParticipant)).rejects.toEqual(
                new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PARTICIPANT', 'Participant notAMember456 is not a member of the group'),
            );
        });

        it('should throw error when group data is missing in transaction', async () => {
            mockTransaction.get.mockResolvedValue({
                exists: true,
                data: vi.fn(() => ({
                    // Missing 'data' property
                    createdAt: mockTimestamp,
                    updatedAt: mockTimestamp,
                })),
            });

            await expect(service.createExpense(mockUserId, mockCreateExpenseData)).rejects.toEqual(new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_GROUP', 'Group data is missing'));
        });

        it('should throw error when group does not exist in transaction', async () => {
            mockTransaction.get.mockResolvedValue({
                exists: false,
            });

            await expect(service.createExpense(mockUserId, mockCreateExpenseData)).rejects.toEqual(Errors.NOT_FOUND('Group'));
        });

        it('should handle missing group permissions structure', async () => {
            mockGroupDoc.data.mockReturnValue({
                data: {
                    name: 'Test Group',
                    members: {
                        [mockUserId]: { role: 'ADMIN', status: 'ACTIVE' },
                        user456: { role: 'MEMBER', status: 'ACTIVE' },
                    },
                    // Missing permissions
                },
                createdAt: mockTimestamp,
                updatedAt: mockTimestamp,
            });

            // PermissionEngine should throw when permissions are missing
            mockPermissionEngine.checkPermission.mockImplementation(() => {
                throw new Error('Group group123 is missing permissions configuration');
            });

            await expect(service.createExpense(mockUserId, mockCreateExpenseData)).rejects.toThrow('Group group123 is missing permissions configuration');
        });
    });

    describe('updateExpense', () => {
        const mockExpenseId = 'expense123';
        const mockUpdateData = {
            amount: 200,
            description: 'Updated dinner',
        };

        const mockExistingExpense = {
            id: mockExpenseId,
            groupId: 'group123',
            createdBy: mockUserId,
            paidBy: mockUserId,
            amount: 150,
            currency: 'USD',
            description: 'Dinner',
            category: 'Food',
            date: mockTimestamp,
            splitType: SplitTypes.EQUAL,
            participants: [mockUserId, 'user456'],
            splits: [
                { userId: mockUserId, amount: 75 },
                { userId: 'user456', amount: 75 },
            ],
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
            deletedAt: null,
            deletedBy: null,
        };

        const setupUpdateExpenseMock = (updatedData: any) => {
            const updatedExpense = {
                ...mockExistingExpense,
                ...updatedData,
                updatedAt: mockTimestamp,
            };

            mockExpenseDocRef.get
                .mockResolvedValueOnce({
                    exists: true,
                    id: mockExpenseId,
                    data: vi.fn(() => mockExistingExpense),
                })
                .mockResolvedValueOnce({
                    exists: true,
                    id: mockExpenseId,
                    data: vi.fn(() => updatedExpense),
                });
        };

        beforeEach(() => {
            // Reset PermissionEngine mock to allow edits by default
            mockPermissionEngine.checkPermission.mockReturnValue(true);

            // Setup existing expense fetch
            mockExpenseDocRef.get.mockResolvedValue({
                exists: true,
                id: mockExpenseId,
                data: vi.fn(() => mockExistingExpense),
            });

            // Setup transaction get for optimistic locking
            mockTransaction.get.mockResolvedValue({
                exists: true,
                data: vi.fn(() => mockExistingExpense),
            });
        });

        it('should successfully update expense amount with equal splits', async () => {
            setupUpdateExpenseMock({
                amount: 200,
                splits: [
                    { userId: mockUserId, amount: 100 },
                    { userId: 'user456', amount: 100 },
                ],
            });

            const result = await service.updateExpense(mockExpenseId, mockUserId, {
                amount: 200,
            });

            expect(result).toEqual(
                expect.objectContaining({
                    id: mockExpenseId,
                    amount: 200,
                    description: 'Dinner',
                    splits: [
                        { userId: mockUserId, amount: 100 },
                        { userId: 'user456', amount: 100 },
                    ],
                }),
            );

            expect(mockTransaction.update).toHaveBeenCalledWith(
                mockExpenseDocRef,
                expect.objectContaining({
                    amount: 200,
                    splits: [
                        { userId: mockUserId, amount: 100 },
                        { userId: 'user456', amount: 100 },
                    ],
                }),
            );

            expect(mockTransaction.set).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    ...mockExistingExpense,
                    modifiedBy: mockUserId,
                    changeType: 'update',
                    changes: ['amount'],
                }),
            );
        });

        it('should convert exact splits to equal when only amount changes', async () => {
            const expenseWithExactSplits = {
                ...mockExistingExpense,
                splitType: SplitTypes.EXACT,
                splits: [
                    { userId: mockUserId, amount: 100 },
                    { userId: 'user456', amount: 50 },
                ],
            };

            mockExpenseDocRef.get.mockResolvedValue({
                exists: true,
                id: mockExpenseId,
                data: vi.fn(() => expenseWithExactSplits),
            });

            mockTransaction.get.mockResolvedValue({
                exists: true,
                data: vi.fn(() => expenseWithExactSplits),
            });

            setupUpdateExpenseMock({
                amount: 300,
                splitType: SplitTypes.EQUAL,
                splits: [
                    { userId: mockUserId, amount: 150 },
                    { userId: 'user456', amount: 150 },
                ],
            });

            const result = await service.updateExpense(mockExpenseId, mockUserId, {
                amount: 300,
            });

            expect(result.splitType).toBe(SplitTypes.EQUAL);
            expect(result.splits).toEqual([
                { userId: mockUserId, amount: 150 },
                { userId: 'user456', amount: 150 },
            ]);
        });

        it('should update expense with percentage splits', async () => {
            setupUpdateExpenseMock({
                amount: 200,
                splitType: SplitTypes.PERCENTAGE,
                splits: [
                    { userId: mockUserId, amount: 140, percentage: 70 },
                    { userId: 'user456', amount: 60, percentage: 30 },
                ],
            });

            const result = await service.updateExpense(mockExpenseId, mockUserId, {
                amount: 200,
                splitType: SplitTypes.PERCENTAGE,
                splits: [
                    { userId: mockUserId, amount: 0, percentage: 70 },
                    { userId: 'user456', amount: 0, percentage: 30 },
                ],
            });

            expect(result.splitType).toBe(SplitTypes.PERCENTAGE);
            expect(result.splits).toEqual([
                { userId: mockUserId, amount: 140, percentage: 70 },
                { userId: 'user456', amount: 60, percentage: 30 },
            ]);
        });

        it('should update paidBy and validate member', async () => {
            setupUpdateExpenseMock({
                paidBy: 'user456',
            });

            const result = await service.updateExpense(mockExpenseId, mockUserId, {
                paidBy: 'user456',
            });

            expect(result.paidBy).toBe('user456');
            expect(mockTransaction.update).toHaveBeenCalledWith(
                mockExpenseDocRef,
                expect.objectContaining({
                    paidBy: 'user456',
                }),
            );
        });

        it('should throw error when updating paidBy to non-member', async () => {
            await expect(
                service.updateExpense(mockExpenseId, mockUserId, {
                    paidBy: 'nonMemberUser',
                }),
            ).rejects.toEqual(new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PAYER', 'Payer must be a member of the group'));
        });

        it('should update participants and recalculate splits', async () => {
            setupUpdateExpenseMock({
                participants: [mockUserId],
                splits: [{ userId: mockUserId, amount: 150 }],
            });

            const result = await service.updateExpense(mockExpenseId, mockUserId, {
                participants: [mockUserId],
            });

            expect(result.participants).toEqual([mockUserId]);
            expect(result.splits).toEqual([{ userId: mockUserId, amount: 150 }]);
        });

        it('should throw error when adding non-member as participant', async () => {
            await expect(
                service.updateExpense(mockExpenseId, mockUserId, {
                    participants: [mockUserId, 'nonMemberUser'],
                }),
            ).rejects.toEqual(new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PARTICIPANT', 'Participant nonMemberUser is not a member of the group'));
        });

        it('should handle date update', async () => {
            const newDate = '2024-03-15T12:00:00.000Z';
            setupUpdateExpenseMock({
                date: parseISOToTimestamp(newDate),
            });
            const result = await service.updateExpense(mockExpenseId, mockUserId, {
                date: newDate,
            });

            expect(result.date).toBe(newDate);
            expect(mockTransaction.update).toHaveBeenCalledWith(
                mockExpenseDocRef,
                expect.objectContaining({
                    date: expect.any(Object),
                }),
            );
        });

        it('should detect and reject concurrent updates', async () => {
            const differentTimestamp = { isEqual: vi.fn(() => false) };

            mockTransaction.get.mockResolvedValue({
                exists: true,
                data: vi.fn(() => ({
                    ...mockExistingExpense,
                    updatedAt: differentTimestamp,
                })),
            });

            await expect(service.updateExpense(mockExpenseId, mockUserId, mockUpdateData)).rejects.toEqual(
                new ApiError(HTTP_STATUS.CONFLICT, 'CONCURRENT_UPDATE', 'Expense was modified by another user. Please refresh and try again.'),
            );
        });

        it('should throw error when user lacks permission to edit expense', async () => {
            mockPermissionEngine.checkPermission.mockReturnValue(false);

            await expect(service.updateExpense(mockExpenseId, mockUserId, mockUpdateData)).rejects.toEqual(
                new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to edit this expense'),
            );
        });

        it('should throw error when expense not found', async () => {
            mockExpenseDocRef.get.mockResolvedValue({
                exists: false,
            });

            await expect(service.updateExpense(mockExpenseId, mockUserId, mockUpdateData)).rejects.toEqual(Errors.NOT_FOUND('Expense'));
        });

        it('should throw error when expense is soft-deleted', async () => {
            mockExpenseDocRef.get.mockResolvedValue({
                exists: true,
                id: mockExpenseId,
                data: vi.fn(() => ({
                    ...mockExistingExpense,
                    deletedAt: mockTimestamp,
                    deletedBy: 'someUser',
                })),
            });

            await expect(service.updateExpense(mockExpenseId, mockUserId, mockUpdateData)).rejects.toEqual(Errors.NOT_FOUND('Expense'));
        });

        it('should update multiple fields at once', async () => {
            const multipleUpdates = {
                amount: 250,
                description: 'Updated expense',
                category: 'Entertainment',
                paidBy: 'user456',
            };

            setupUpdateExpenseMock({
                ...multipleUpdates,
                splits: [
                    { userId: mockUserId, amount: 125 },
                    { userId: 'user456', amount: 125 },
                ],
            });

            const result = await service.updateExpense(mockExpenseId, mockUserId, multipleUpdates);

            expect(result).toEqual(
                expect.objectContaining({
                    amount: 250,
                    description: 'Updated expense',
                    category: 'Entertainment',
                    paidBy: 'user456',
                    splits: [
                        { userId: mockUserId, amount: 125 },
                        { userId: 'user456', amount: 125 },
                    ],
                }),
            );

            expect(mockTransaction.set).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    changeType: 'update',
                    changes: ['amount', 'description', 'category', 'paidBy'],
                }),
            );
        });
    });

    describe('deleteExpense', () => {
        const mockExpenseId = 'expense123';

        beforeEach(() => {
            // Reset all mocks before each test
            vi.clearAllMocks();

            // Set up default successful fetch
            mockDoc.exists = true;
            mockDoc.data.mockReturnValue(mockExpenseData);
            mockExpenseDocRef.get.mockResolvedValue(mockDoc);

            // Set up group doc
            mockGroupDoc.exists = true;
            mockGroupDoc.data.mockReturnValue(mockGroupData);

            // Set up collections
            mockExpensesCollection.doc.mockReturnValue(mockExpenseDocRef);
            mockGroupsCollection.doc.mockReturnValue({
                get: vi.fn().mockResolvedValue(mockGroupDoc),
            });

            // Set up Firestore DB mock
            (firestoreDb as any).collection.mockImplementation((name: string) => {
                if (name === FirestoreCollections.EXPENSES) {
                    return mockExpensesCollection;
                } else if (name === FirestoreCollections.GROUPS) {
                    return mockGroupsCollection;
                }
            });

            // Mock PermissionEngine to allow deletion by default
            mockPermissionEngine.checkPermission.mockReturnValue(true);
        });

        it('should delete an expense successfully when user has permission', async () => {
            // Set up transaction
            const mockTransactionDoc = {
                exists: true,
                data: vi.fn().mockReturnValue({
                    ...mockExpenseData,
                    updatedAt: mockTimestamp,
                }),
            };

            mockTransaction.get.mockResolvedValue(mockTransactionDoc);

            mockFirestoreDb.runTransaction.mockImplementation(async (callback: any) => {
                return callback(mockTransaction);
            });

            // Execute
            await service.deleteExpense(mockExpenseId, mockUserId);

            // Verify
            expect(mockExpensesCollection.doc).toHaveBeenCalledWith(mockExpenseId);
            expect(mockGroupsCollection.doc).toHaveBeenCalledWith(mockGroupId);
            expect(PermissionEngine.checkPermission).toHaveBeenCalledWith(
                expect.objectContaining({ id: mockGroupId }),
                mockUserId,
                'expenseDeletion',
                expect.objectContaining({ expense: expect.any(Object) }),
            );

            // Verify transaction operations
            expect(mockTransaction.get).toHaveBeenCalledTimes(2); // expense doc and group doc
            expect(mockTransaction.update).toHaveBeenCalledWith(
                mockExpenseDocRef,
                expect.objectContaining({
                    deletedAt: expect.any(Object),
                    deletedBy: mockUserId,
                    updatedAt: expect.any(Object),
                }),
            );
        });

        it('should throw NOT_FOUND error when expense does not exist', async () => {
            mockDoc.exists = false;
            mockExpenseDocRef.get.mockResolvedValue(mockDoc);

            await expect(service.deleteExpense(mockExpenseId, mockUserId)).rejects.toThrow('Expense not found');
        });

        it('should throw NOT_FOUND error when expense is already deleted', async () => {
            const deletedExpenseData = {
                ...mockExpenseData,
                deletedAt: mockTimestamp,
                deletedBy: 'someuser',
            };
            mockDoc.data.mockReturnValue(deletedExpenseData);
            mockExpenseDocRef.get.mockResolvedValue(mockDoc);

            await expect(service.deleteExpense(mockExpenseId, mockUserId)).rejects.toThrow('Expense not found');
        });

        it('should throw NOT_AUTHORIZED error when user lacks permission', async () => {
            mockPermissionEngine.checkPermission.mockReturnValue(false);

            await expect(service.deleteExpense(mockExpenseId, mockUserId)).rejects.toThrow('You do not have permission to delete this expense');
        });

        it('should throw NOT_FOUND error when group does not exist', async () => {
            mockGroupDoc.exists = false;

            await expect(service.deleteExpense(mockExpenseId, mockUserId)).rejects.toThrow('Group not found');
        });

        it('should throw CONCURRENT_UPDATE error on concurrent modifications', async () => {
            const originalTimestamp = mockTimestamp;
            const updatedTimestamp = Timestamp.fromDate(new Date('2024-01-02'));

            // Set up transaction to detect concurrent update
            const mockTransactionDoc = {
                exists: true,
                data: vi
                    .fn()
                    .mockReturnValueOnce({
                        ...mockExpenseData,
                        updatedAt: originalTimestamp,
                    })
                    .mockReturnValueOnce({
                        ...mockExpenseData,
                        updatedAt: updatedTimestamp, // Different timestamp on second read
                    }),
            };

            mockTransaction.get.mockResolvedValue(mockTransactionDoc);

            mockFirestoreDb.runTransaction.mockImplementation(async (callback: any) => {
                return callback(mockTransaction);
            });

            await expect(service.deleteExpense(mockExpenseId, mockUserId)).rejects.toThrow('Document was modified by another user');
        });

        it('should handle transaction errors properly', async () => {
            const transactionError = new Error('Transaction failed');

            mockFirestoreDb.runTransaction.mockRejectedValue(transactionError);

            await expect(service.deleteExpense(mockExpenseId, mockUserId)).rejects.toThrow('Transaction failed');
        });

        it('should delete expense by group member with expenseDeletion permission', async () => {
            const memberId = 'user456';

            // Set up as member with permission
            mockPermissionEngine.checkPermission.mockReturnValue(true);

            // Set up transaction
            const mockTransactionDoc = {
                exists: true,
                data: vi.fn().mockReturnValue({
                    ...mockExpenseData,
                    updatedAt: mockTimestamp,
                }),
            };

            mockTransaction.get.mockResolvedValue(mockTransactionDoc);

            mockFirestoreDb.runTransaction.mockImplementation(async (callback: any) => {
                return callback(mockTransaction);
            });

            // Execute
            await service.deleteExpense(mockExpenseId, memberId);

            // Verify permission check was made
            expect(PermissionEngine.checkPermission).toHaveBeenCalledWith(expect.any(Object), memberId, 'expenseDeletion', expect.objectContaining({ expense: expect.any(Object) }));

            // Verify the expense was soft deleted
            expect(mockTransaction.update).toHaveBeenCalledWith(
                mockExpenseDocRef,
                expect.objectContaining({
                    deletedAt: expect.any(Object),
                    deletedBy: memberId,
                    updatedAt: expect.any(Object),
                }),
            );
        });

        it('should throw error when expense is missing updatedAt timestamp', async () => {
            // Set up transaction with expense missing updatedAt
            const mockTransactionDoc = {
                exists: true,
                data: vi.fn().mockReturnValue({
                    ...mockExpenseData,
                    updatedAt: null,
                }),
            };

            mockTransaction.get.mockResolvedValue(mockTransactionDoc);

            mockFirestoreDb.runTransaction.mockImplementation(async (callback: any) => {
                return callback(mockTransaction);
            });

            await expect(service.deleteExpense(mockExpenseId, mockUserId)).rejects.toThrow('Expense is missing updatedAt timestamp');
        });
    });
});
