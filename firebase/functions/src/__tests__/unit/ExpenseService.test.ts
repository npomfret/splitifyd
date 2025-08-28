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
jest.mock('../../firebase');
jest.mock('../../logger');
jest.mock('../../utils/groupHelpers');
jest.mock('../../groups/handlers');
jest.mock('../../permissions');

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
            { userId: 'user456', amount: 50 }
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
                'user456': { role: 'MEMBER', joinedAt: mockTimestamp }
            }
        }
    };

    let mockExpenseDocRef: any;
    let mockTransaction: any;

    beforeEach(() => {
        // Create mock document references
        mockDoc = {
            exists: true,
            id: mockExpenseId,
            data: jest.fn(() => mockExpenseData),
            get: jest.fn(),
        };

        mockGroupDoc = {
            exists: true,
            id: mockGroupId,
            data: jest.fn(() => mockGroupData),
            get: jest.fn(),
        };

        // Create mock expense document reference
        mockExpenseDocRef = {
            get: jest.fn().mockResolvedValue(mockDoc),
            collection: jest.fn(() => ({
                doc: jest.fn(() => ({}))
            }))
        };

        // Create mock transaction
        mockTransaction = {
            get: jest.fn().mockResolvedValue(mockDoc),
            set: jest.fn(),
            update: jest.fn(),
        };

        // Create mock collections
        mockExpensesCollection = {
            doc: jest.fn(() => mockExpenseDocRef),
            where: jest.fn(),
            select: jest.fn(),
            orderBy: jest.fn(),
            limit: jest.fn(),
            startAfter: jest.fn(),
            get: jest.fn(),
        };

        mockGroupsCollection = {
            doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue(mockGroupDoc),
            })),
        };

        // Mock Firestore database
        (firestoreDb.collection as jest.Mock).mockImplementation((collection: string) => {
            if (collection === FirestoreCollections.EXPENSES) {
                return mockExpensesCollection;
            }
            if (collection === FirestoreCollections.GROUPS) {
                return mockGroupsCollection;
            }
            return null;
        });

        // Mock runTransaction
        (firestoreDb.runTransaction as jest.Mock).mockImplementation(async (callback) => {
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
                    { userId: 'user456', amount: 50 }
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
            await expect(service.getExpense(mockExpenseId, nonParticipantUserId))
                .rejects.toEqual(new ApiError(
                    HTTP_STATUS.FORBIDDEN, 
                    'NOT_EXPENSE_PARTICIPANT', 
                    'You are not a participant in this expense'
                ));
        });

        it('should throw NOT_FOUND error when expense does not exist', async () => {
            mockDoc.exists = false;

            await expect(service.getExpense(mockExpenseId, mockUserId))
                .rejects.toEqual(Errors.NOT_FOUND('Expense'));

            expect(mockExpensesCollection.doc).toHaveBeenCalledWith(mockExpenseId);
        });

        it('should throw NOT_FOUND error when expense is soft-deleted', async () => {
            mockDoc.data.mockReturnValue({
                ...mockExpenseData,
                deletedAt: mockTimestamp,
                deletedBy: 'someUserId',
            });

            await expect(service.getExpense(mockExpenseId, mockUserId))
                .rejects.toEqual(Errors.NOT_FOUND('Expense'));
        });

        it('should throw FORBIDDEN error when user is neither participant nor group member', async () => {
            const unauthorizedUserId = 'unauthorized123';

            await expect(service.getExpense(mockExpenseId, unauthorizedUserId))
                .rejects.toEqual(new ApiError(
                    HTTP_STATUS.FORBIDDEN, 
                    'NOT_EXPENSE_PARTICIPANT', 
                    'You are not a participant in this expense'
                ));
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

            await expect(service.getExpense(mockExpenseId, mockUserId))
                .rejects.toEqual(new ApiError(
                    HTTP_STATUS.INTERNAL_ERROR, 
                    'INVALID_EXPENSE_DATA', 
                    'Expense data is corrupted'
                ));
        });

        it('should handle expense with empty participants array', async () => {
            mockDoc.data.mockReturnValue({
                ...mockExpenseData,
                participants: [],
            });

            await expect(service.getExpense(mockExpenseId, mockUserId))
                .rejects.toEqual(new ApiError(
                    HTTP_STATUS.INTERNAL_ERROR, 
                    'INVALID_EXPENSE_DATA', 
                    'Expense data is corrupted'
                ));
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
                            { userId: 'user456', amount: 50 }
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
                            { userId: 'user456', amount: 100 }
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
                where: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                startAfter: jest.fn().mockReturnThis(),
                get: jest.fn().mockResolvedValue(mockQuerySnapshot),
            };

            mockExpensesCollection.where.mockReturnValue(mockQuery);
            mockExpensesCollection.select = mockQuery.select;
            mockExpensesCollection.orderBy = mockQuery.orderBy;
            mockExpensesCollection.limit = mockQuery.limit;
            mockExpensesCollection.startAfter = mockQuery.startAfter;
            mockExpensesCollection.get = mockQuery.get;

            // Mock verifyGroupMembership
            (groupHelpers.verifyGroupMembership as jest.Mock).mockResolvedValue(undefined);
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
            const cursor = Buffer.from(JSON.stringify({
                date: '2024-01-01T00:00:00.000Z',
                createdAt: '2024-01-01T00:00:00.000Z',
                id: 'lastExpenseId'
            })).toString('base64');

            await service.listGroupExpenses(mockGroupId, mockUserId, { cursor });

            expect(mockExpensesCollection.startAfter).toHaveBeenCalled();
        });

        it('should filter out deleted expenses by default', async () => {
            // Reset the mock to track calls properly
            const mockQuery = {
                where: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                startAfter: jest.fn().mockReturnThis(),
                get: jest.fn().mockResolvedValue(mockQuerySnapshot),
            };

            mockExpensesCollection.where = jest.fn().mockReturnValue(mockQuery);
            
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

            await expect(service.listGroupExpenses(mockGroupId, mockUserId, { cursor: invalidCursor }))
                .rejects.toEqual(new ApiError(
                    HTTP_STATUS.BAD_REQUEST,
                    'INVALID_CURSOR',
                    'Invalid cursor format'
                ));
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
                    }
                ]
            };

            // Mock the query chain to return 3 docs when limit is 3 (service requests limit+1)
            const mockQuery: any = {
                where: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                startAfter: jest.fn().mockReturnThis(),
                get: jest.fn().mockResolvedValue(mockQueryWithThreeDocs),
            };

            mockExpensesCollection.where = jest.fn().mockReturnValue(mockQuery);

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
            splits: []
        };

        beforeEach(() => {
            // Mock document reference for new expense
            mockNewDocRef = {
                id: mockNewExpenseId,
                set: jest.fn(),
            };

            // Mock expenses collection doc() for new document
            mockExpensesCollection.doc = jest.fn(() => mockNewDocRef);

            // Mock transaction
            mockTransaction = {
                get: jest.fn().mockResolvedValue({
                    exists: true,
                    data: jest.fn(() => ({
                        data: {
                            name: 'Test Group',
                            description: 'Test Description',
                            createdBy: 'creator123',
                            members: {
                                [mockUserId]: { role: 'ADMIN', status: 'ACTIVE', joinedAt: mockTimestamp },
                                'user456': { role: 'MEMBER', status: 'ACTIVE', joinedAt: mockTimestamp }
                            },
                            permissions: {
                                expenseEditing: 'ANYONE'
                            }
                        },
                        createdAt: mockTimestamp,
                        updatedAt: mockTimestamp
                    }))
                }),
                set: jest.fn(),
            };

            // Mock firestoreDb.runTransaction
            (firestoreDb.runTransaction as jest.Mock).mockImplementation(async (callback) => {
                return callback(mockTransaction);
            });

            // Mock group document
            mockGroupDoc = {
                exists: true,
                id: mockGroupId,
                data: jest.fn(() => ({
                    data: {
                        name: 'Test Group',
                        description: 'Test Description',
                        createdBy: 'creator123',
                        members: {
                            [mockUserId]: { role: 'ADMIN', status: 'ACTIVE', joinedAt: mockTimestamp },
                            'user456': { role: 'MEMBER', status: 'ACTIVE', joinedAt: mockTimestamp }
                        },
                        permissions: {
                            expenseEditing: 'ANYONE'
                        }
                    },
                    createdAt: mockTimestamp,
                    updatedAt: mockTimestamp
                })),
                get: jest.fn(),
            };

            mockGroupsCollection.doc = jest.fn(() => ({
                get: jest.fn().mockResolvedValue(mockGroupDoc),
            }));

            // Mock verifyGroupMembership
            (groupHelpers.verifyGroupMembership as jest.Mock).mockResolvedValue(undefined);

            // Mock PermissionEngine
            (PermissionEngine.checkPermission as jest.Mock).mockReturnValue(true);

            // Mock createServerTimestamp
            jest.spyOn(dateHelpers, 'createServerTimestamp')
                .mockReturnValue(mockTimestamp);
        });

        it('should successfully create an expense with equal splits', async () => {
            const result = await service.createExpense(mockUserId, mockCreateExpenseData);

            // Verify the result structure
            expect(result).toEqual(expect.objectContaining({
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
                    { userId: 'user456', amount: 75 }
                ]
            }));

            // Verify group membership was checked
            expect(groupHelpers.verifyGroupMembership)
                .toHaveBeenCalledWith(mockGroupId, mockUserId);

            // Verify permission was checked
            expect(PermissionEngine.checkPermission).toHaveBeenCalledWith(
                expect.objectContaining({ id: mockGroupId }),
                mockUserId,
                'expenseEditing'
            );

            // Verify transaction was used
            expect(firestoreDb.runTransaction).toHaveBeenCalled();
            expect(mockTransaction.set).toHaveBeenCalledWith(
                mockNewDocRef,
                expect.objectContaining({
                    id: mockNewExpenseId,
                    groupId: mockGroupId,
                    createdBy: mockUserId,
                    amount: 150
                })
            );
        });

        it('should successfully create expense with exact splits', async () => {
            const dataWithExactSplits: CreateExpenseRequest = {
                ...mockCreateExpenseData,
                splitType: SplitTypes.EXACT,
                splits: [
                    { userId: mockUserId, amount: 100 },
                    { userId: 'user456', amount: 50 }
                ]
            };

            const result = await service.createExpense(mockUserId, dataWithExactSplits);

            expect(result.splits).toEqual([
                { userId: mockUserId, amount: 100 },
                { userId: 'user456', amount: 50 }
            ]);
        });

        it('should successfully create expense with percentage splits', async () => {
            const dataWithPercentageSplits: CreateExpenseRequest = {
                ...mockCreateExpenseData,
                splitType: SplitTypes.PERCENTAGE,
                splits: [
                    { userId: mockUserId, amount: 0, percentage: 60 },
                    { userId: 'user456', amount: 0, percentage: 40 }
                ]
            };

            const result = await service.createExpense(mockUserId, dataWithPercentageSplits);

            expect(result.splits).toEqual([
                { userId: mockUserId, amount: 90, percentage: 60 },
                { userId: 'user456', amount: 60, percentage: 40 }
            ]);
        });

        it('should include receiptUrl when provided', async () => {
            const dataWithReceipt: CreateExpenseRequest = {
                ...mockCreateExpenseData,
                receiptUrl: 'https://example.com/receipt.jpg'
            };

            const result = await service.createExpense(mockUserId, dataWithReceipt);

            expect(result.receiptUrl).toBe('https://example.com/receipt.jpg');
        });

        it('should throw error when user is not a group member', async () => {
            (groupHelpers.verifyGroupMembership as jest.Mock).mockRejectedValue(
                new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_GROUP_MEMBER', 'User is not a member of this group')
            );

            await expect(service.createExpense(mockUserId, mockCreateExpenseData))
                .rejects.toEqual(new ApiError(
                    HTTP_STATUS.FORBIDDEN,
                    'NOT_GROUP_MEMBER',
                    'User is not a member of this group'
                ));
        });

        it('should throw error when group does not exist', async () => {
            mockGroupDoc.exists = false;

            await expect(service.createExpense(mockUserId, mockCreateExpenseData))
                .rejects.toEqual(Errors.NOT_FOUND('Group'));
        });

        it('should throw error when user lacks permission to create expenses', async () => {
            (PermissionEngine.checkPermission as jest.Mock).mockReturnValue(false);

            await expect(service.createExpense(mockUserId, mockCreateExpenseData))
                .rejects.toEqual(new ApiError(
                    HTTP_STATUS.FORBIDDEN,
                    'NOT_AUTHORIZED',
                    'You do not have permission to create expenses in this group'
                ));
        });

        it('should throw error when payer is not a group member', async () => {
            const dataWithInvalidPayer: CreateExpenseRequest = {
                ...mockCreateExpenseData,
                paidBy: 'notAMember123'
            };

            await expect(service.createExpense(mockUserId, dataWithInvalidPayer))
                .rejects.toEqual(new ApiError(
                    HTTP_STATUS.BAD_REQUEST,
                    'INVALID_PAYER',
                    'Payer must be a member of the group'
                ));
        });

        it('should throw error when participant is not a group member', async () => {
            const dataWithInvalidParticipant: CreateExpenseRequest = {
                ...mockCreateExpenseData,
                participants: [mockUserId, 'notAMember456']
            };

            await expect(service.createExpense(mockUserId, dataWithInvalidParticipant))
                .rejects.toEqual(new ApiError(
                    HTTP_STATUS.BAD_REQUEST,
                    'INVALID_PARTICIPANT',
                    'Participant notAMember456 is not a member of the group'
                ));
        });

        it('should throw error when group data is missing in transaction', async () => {
            mockTransaction.get.mockResolvedValue({
                exists: true,
                data: jest.fn(() => ({ 
                    // Missing 'data' property
                    createdAt: mockTimestamp,
                    updatedAt: mockTimestamp
                }))
            });

            await expect(service.createExpense(mockUserId, mockCreateExpenseData))
                .rejects.toEqual(new ApiError(
                    HTTP_STATUS.NOT_FOUND,
                    'INVALID_GROUP',
                    'Group data is missing'
                ));
        });

        it('should throw error when group does not exist in transaction', async () => {
            mockTransaction.get.mockResolvedValue({
                exists: false
            });

            await expect(service.createExpense(mockUserId, mockCreateExpenseData))
                .rejects.toEqual(Errors.NOT_FOUND('Group'));
        });

        it('should handle missing group permissions structure', async () => {
            mockGroupDoc.data.mockReturnValue({
                data: {
                    name: 'Test Group',
                    members: {
                        [mockUserId]: { role: 'ADMIN', status: 'ACTIVE' },
                        'user456': { role: 'MEMBER', status: 'ACTIVE' }
                    },
                    // Missing permissions
                },
                createdAt: mockTimestamp,
                updatedAt: mockTimestamp
            });

            // PermissionEngine should throw when permissions are missing
            (PermissionEngine.checkPermission as jest.Mock).mockImplementation(() => {
                throw new Error('Group group123 is missing permissions configuration');
            });

            await expect(service.createExpense(mockUserId, mockCreateExpenseData))
                .rejects.toThrow('Group group123 is missing permissions configuration');
        });
    });

    describe('updateExpense', () => {
        const mockExpenseId = 'expense123';
        const mockUpdateData = {
            amount: 200,
            description: 'Updated dinner'
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
                { userId: 'user456', amount: 75 }
            ],
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
            deletedAt: null,
            deletedBy: null
        };

        const setupUpdateExpenseMock = (updatedData: any) => {
            const updatedExpense = {
                ...mockExistingExpense,
                ...updatedData,
                updatedAt: mockTimestamp
            };
            
            mockExpenseDocRef.get
                .mockResolvedValueOnce({
                    exists: true,
                    id: mockExpenseId,
                    data: jest.fn(() => mockExistingExpense)
                })
                .mockResolvedValueOnce({
                    exists: true,
                    id: mockExpenseId,
                    data: jest.fn(() => updatedExpense)
                });
        };

        beforeEach(() => {
            // Reset PermissionEngine mock to allow edits by default
            (PermissionEngine.checkPermission as jest.Mock).mockReturnValue(true);

            // Setup existing expense fetch  
            mockExpenseDocRef.get.mockResolvedValue({
                exists: true,
                id: mockExpenseId,
                data: jest.fn(() => mockExistingExpense)
            });

            // Setup transaction get for optimistic locking
            mockTransaction.get.mockResolvedValue({
                exists: true,
                data: jest.fn(() => mockExistingExpense)
            });
        });

        it('should successfully update expense amount with equal splits', async () => {
            setupUpdateExpenseMock({
                amount: 200,
                splits: [
                    { userId: mockUserId, amount: 100 },
                    { userId: 'user456', amount: 100 }
                ]
            });

            const result = await service.updateExpense(mockExpenseId, mockUserId, {
                amount: 200
            });

            expect(result).toEqual(expect.objectContaining({
                id: mockExpenseId,
                amount: 200,
                description: 'Dinner',
                splits: [
                    { userId: mockUserId, amount: 100 },
                    { userId: 'user456', amount: 100 }
                ]
            }));

            expect(mockTransaction.update).toHaveBeenCalledWith(
                mockExpenseDocRef,
                expect.objectContaining({
                    amount: 200,
                    splits: [
                        { userId: mockUserId, amount: 100 },
                        { userId: 'user456', amount: 100 }
                    ]
                })
            );

            expect(mockTransaction.set).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    ...mockExistingExpense,
                    modifiedBy: mockUserId,
                    changeType: 'update',
                    changes: ['amount']
                })
            );
        });

        it('should convert exact splits to equal when only amount changes', async () => {
            const expenseWithExactSplits = {
                ...mockExistingExpense,
                splitType: SplitTypes.EXACT,
                splits: [
                    { userId: mockUserId, amount: 100 },
                    { userId: 'user456', amount: 50 }
                ]
            };

            mockExpenseDocRef.get.mockResolvedValue({
                exists: true,
                id: mockExpenseId,
                data: jest.fn(() => expenseWithExactSplits)
            });

            mockTransaction.get.mockResolvedValue({
                exists: true,
                data: jest.fn(() => expenseWithExactSplits)
            });

            setupUpdateExpenseMock({
                amount: 300,
                splitType: SplitTypes.EQUAL,
                splits: [
                    { userId: mockUserId, amount: 150 },
                    { userId: 'user456', amount: 150 }
                ]
            });

            const result = await service.updateExpense(mockExpenseId, mockUserId, {
                amount: 300
            });

            expect(result.splitType).toBe(SplitTypes.EQUAL);
            expect(result.splits).toEqual([
                { userId: mockUserId, amount: 150 },
                { userId: 'user456', amount: 150 }
            ]);
        });

        it('should update expense with percentage splits', async () => {
            setupUpdateExpenseMock({
                amount: 200,
                splitType: SplitTypes.PERCENTAGE,
                splits: [
                    { userId: mockUserId, amount: 140, percentage: 70 },
                    { userId: 'user456', amount: 60, percentage: 30 }
                ]
            });

            const result = await service.updateExpense(mockExpenseId, mockUserId, {
                amount: 200,
                splitType: SplitTypes.PERCENTAGE,
                splits: [
                    { userId: mockUserId, amount: 0, percentage: 70 },
                    { userId: 'user456', amount: 0, percentage: 30 }
                ]
            });

            expect(result.splitType).toBe(SplitTypes.PERCENTAGE);
            expect(result.splits).toEqual([
                { userId: mockUserId, amount: 140, percentage: 70 },
                { userId: 'user456', amount: 60, percentage: 30 }
            ]);
        });

        it('should update paidBy and validate member', async () => {
            setupUpdateExpenseMock({
                paidBy: 'user456'
            });

            const result = await service.updateExpense(mockExpenseId, mockUserId, {
                paidBy: 'user456'
            });

            expect(result.paidBy).toBe('user456');
            expect(mockTransaction.update).toHaveBeenCalledWith(
                mockExpenseDocRef,
                expect.objectContaining({
                    paidBy: 'user456'
                })
            );
        });

        it('should throw error when updating paidBy to non-member', async () => {
            await expect(service.updateExpense(mockExpenseId, mockUserId, {
                paidBy: 'nonMemberUser'
            })).rejects.toEqual(new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'INVALID_PAYER',
                'Payer must be a member of the group'
            ));
        });

        it('should update participants and recalculate splits', async () => {
            setupUpdateExpenseMock({
                participants: [mockUserId],
                splits: [
                    { userId: mockUserId, amount: 150 }
                ]
            });

            const result = await service.updateExpense(mockExpenseId, mockUserId, {
                participants: [mockUserId]
            });

            expect(result.participants).toEqual([mockUserId]);
            expect(result.splits).toEqual([
                { userId: mockUserId, amount: 150 }
            ]);
        });

        it('should throw error when adding non-member as participant', async () => {
            await expect(service.updateExpense(mockExpenseId, mockUserId, {
                participants: [mockUserId, 'nonMemberUser']
            })).rejects.toEqual(new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'INVALID_PARTICIPANT',
                'Participant nonMemberUser is not a member of the group'
            ));
        });

        it('should handle date update', async () => {
            const newDate = '2024-03-15T12:00:00.000Z';
            setupUpdateExpenseMock({
                date: parseISOToTimestamp(newDate)
            });
            const result = await service.updateExpense(mockExpenseId, mockUserId, {
                date: newDate
            });

            expect(result.date).toBe(newDate);
            expect(mockTransaction.update).toHaveBeenCalledWith(
                mockExpenseDocRef,
                expect.objectContaining({
                    date: expect.any(Object)
                })
            );
        });

        it('should detect and reject concurrent updates', async () => {
            const differentTimestamp = { isEqual: jest.fn(() => false) };
            
            mockTransaction.get.mockResolvedValue({
                exists: true,
                data: jest.fn(() => ({
                    ...mockExistingExpense,
                    updatedAt: differentTimestamp
                }))
            });

            await expect(service.updateExpense(mockExpenseId, mockUserId, mockUpdateData))
                .rejects.toEqual(new ApiError(
                    HTTP_STATUS.CONFLICT,
                    'CONCURRENT_UPDATE',
                    'Expense was modified by another user. Please refresh and try again.'
                ));
        });

        it('should throw error when user lacks permission to edit expense', async () => {
            (PermissionEngine.checkPermission as jest.Mock).mockReturnValue(false);

            await expect(service.updateExpense(mockExpenseId, mockUserId, mockUpdateData))
                .rejects.toEqual(new ApiError(
                    HTTP_STATUS.FORBIDDEN,
                    'NOT_AUTHORIZED',
                    'You do not have permission to edit this expense'
                ));
        });

        it('should throw error when expense not found', async () => {
            mockExpenseDocRef.get.mockResolvedValue({
                exists: false
            });

            await expect(service.updateExpense(mockExpenseId, mockUserId, mockUpdateData))
                .rejects.toEqual(Errors.NOT_FOUND('Expense'));
        });

        it('should throw error when expense is soft-deleted', async () => {
            mockExpenseDocRef.get.mockResolvedValue({
                exists: true,
                id: mockExpenseId,
                data: jest.fn(() => ({
                    ...mockExistingExpense,
                    deletedAt: mockTimestamp,
                    deletedBy: 'someUser'
                }))
            });

            await expect(service.updateExpense(mockExpenseId, mockUserId, mockUpdateData))
                .rejects.toEqual(Errors.NOT_FOUND('Expense'));
        });

        it('should update multiple fields at once', async () => {
            const multipleUpdates = {
                amount: 250,
                description: 'Updated expense',
                category: 'Entertainment',
                paidBy: 'user456'
            };

            setupUpdateExpenseMock({
                ...multipleUpdates,
                splits: [
                    { userId: mockUserId, amount: 125 },
                    { userId: 'user456', amount: 125 }
                ]
            });

            const result = await service.updateExpense(mockExpenseId, mockUserId, multipleUpdates);

            expect(result).toEqual(expect.objectContaining({
                amount: 250,
                description: 'Updated expense',
                category: 'Entertainment',
                paidBy: 'user456',
                splits: [
                    { userId: mockUserId, amount: 125 },
                    { userId: 'user456', amount: 125 }
                ]
            }));

            expect(mockTransaction.set).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    changeType: 'update',
                    changes: ['amount', 'description', 'category', 'paidBy']
                })
            );
        });
    });
});