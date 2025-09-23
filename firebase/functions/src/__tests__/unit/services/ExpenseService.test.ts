import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpenseService } from '../../../services/ExpenseService';
import { StubFirestoreReader, StubFirestoreWriter } from '../mocks/firestore-stubs';
import { GroupMemberService } from '../../../services/GroupMemberService';
import { UserService } from '../../../services/UserService2';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import { Timestamp } from 'firebase-admin/firestore';
import type { CreateExpenseRequest } from '@splitifyd/shared';

// Mock dependencies that aren't part of core business logic testing
vi.mock('../../../utils/dateHelpers', () => ({
    createOptimisticTimestamp: () => Timestamp.now(),
    parseISOToTimestamp: (date: string) => Timestamp.fromDate(new Date(date)),
    timestampToISO: (timestamp: any) => {
        if (timestamp?.toDate) {
            return timestamp.toDate().toISOString();
        }
        return new Date().toISOString();
    },
}));

vi.mock('../../../logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
    },
    LoggerContext: {
        setBusinessContext: vi.fn(),
    },
}));

vi.mock('../../../monitoring/measure', () => ({
    measureDb: vi.fn((name, fn) => fn()),
}));

vi.mock('../../../permissions/permission-engine-async', () => ({
    PermissionEngineAsync: {
        checkPermission: vi.fn().mockResolvedValue(true),
    },
}));

vi.mock('../../../expenses/validation', () => ({
    validateCreateExpense: vi.fn((data) => data),
    calculateSplits: vi.fn((amount, splitType, participants) =>
        participants.map((userId: string) => ({
            userId,
            amount: amount / participants.length,
        }))
    ),
}));

describe('ExpenseService - Unit Tests', () => {
    let expenseService: ExpenseService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;
    let mockGroupMemberService: GroupMemberService;
    let mockUserService: UserService;

    // Helper to set expense data in stub
    const setExpenseData = (expenseId: string, expenseData: any) => {
        stubReader.setDocument('expenses', expenseId, expenseData);
    };

    beforeEach(() => {
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();

        // Create mock services
        mockGroupMemberService = {
            getAllGroupMembers: vi.fn(),
        } as any;

        mockUserService = {} as any;

        expenseService = new ExpenseService(
            stubReader,
            stubWriter,
            mockGroupMemberService,
            mockUserService,
        );
    });

    describe('Data Transformation and Validation', () => {
        it('should transform expense document to response format correctly', async () => {
            // Arrange
            const expenseId = 'test-expense-id';
            const userId = 'test-user-id';
            const now = Timestamp.now();

            const mockExpense = {
                id: expenseId,
                groupId: 'test-group-id',
                createdBy: 'creator-id',
                paidBy: 'payer-id',
                amount: 100.50,
                currency: 'USD',
                description: 'Test expense',
                category: 'Food',
                date: now,
                splitType: 'equal',
                participants: [userId, 'other-user'],
                splits: [
                    { userId: userId, amount: 50.25 },
                    { userId: 'other-user', amount: 50.25 },
                ],
                receiptUrl: 'https://example.com/receipt.jpg',
                createdAt: now,
                updatedAt: now,
                deletedAt: null,
                deletedBy: null,
            };

            // Mock the expense data
            setExpenseData(expenseId, mockExpense);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result).toEqual({
                id: expenseId,
                groupId: 'test-group-id',
                createdBy: 'creator-id',
                paidBy: 'payer-id',
                amount: 100.50,
                currency: 'USD',
                description: 'Test expense',
                category: 'Food',
                date: expect.any(String), // ISO string
                splitType: 'equal',
                participants: [userId, 'other-user'],
                splits: [
                    { userId: userId, amount: 50.25 },
                    { userId: 'other-user', amount: 50.25 },
                ],
                receiptUrl: 'https://example.com/receipt.jpg',
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
                deletedAt: null,
                deletedBy: null,
            });
        });

        it('should handle expense without receipt URL', async () => {
            // Arrange
            const expenseId = 'test-expense-id';
            const userId = 'test-user-id';

            const mockExpense = {
                id: expenseId,
                groupId: 'test-group-id',
                createdBy: 'creator-id',
                paidBy: 'payer-id',
                amount: 100,
                currency: 'USD',
                description: 'Test expense',
                category: 'Food',
                date: Timestamp.now(),
                splitType: 'equal',
                participants: [userId],
                splits: [{ userId: userId, amount: 100 }],
                // No receiptUrl
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: null,
                deletedBy: null,
            };

            setExpenseData(expenseId, mockExpense);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.receiptUrl).toBeUndefined();
        });
    });

    describe('Access Control and Security', () => {
        it('should reject access for non-participants', async () => {
            // Arrange
            const expenseId = 'test-expense-id';
            const participantId = 'participant-user';
            const nonParticipantId = 'non-participant-user';

            const mockExpense = {
                id: expenseId,
                groupId: 'test-group-id',
                createdBy: 'creator-id',
                paidBy: participantId,
                amount: 100,
                currency: 'USD',
                description: 'Test expense',
                category: 'Food',
                date: Timestamp.now(),
                splitType: 'equal',
                participants: [participantId], // Only one participant
                splits: [{ userId: participantId, amount: 100 }],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: null,
                deletedBy: null,
            };

            setExpenseData(expenseId, mockExpense);

            // Act & Assert
            await expect(expenseService.getExpense(expenseId, nonParticipantId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                    code: 'NOT_EXPENSE_PARTICIPANT',
                }),
            );
        });

        it('should allow access for all participants', async () => {
            // Arrange
            const expenseId = 'test-expense-id';
            const participant1 = 'participant-1';
            const participant2 = 'participant-2';

            const mockExpense = {
                id: expenseId,
                groupId: 'test-group-id',
                createdBy: participant1,
                paidBy: participant1,
                amount: 100,
                currency: 'USD',
                description: 'Test expense',
                category: 'Food',
                date: Timestamp.now(),
                splitType: 'equal',
                participants: [participant1, participant2],
                splits: [
                    { userId: participant1, amount: 50 },
                    { userId: participant2, amount: 50 },
                ],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: null,
                deletedBy: null,
            };

            setExpenseData(expenseId, mockExpense);

            // Act - Both participants should be able to access
            const result1 = await expenseService.getExpense(expenseId, participant1);
            const result2 = await expenseService.getExpense(expenseId, participant2);

            // Assert
            expect(result1.id).toBe(expenseId);
            expect(result2.id).toBe(expenseId);
            expect(result1.participants).toEqual([participant1, participant2]);
            expect(result2.participants).toEqual([participant1, participant2]);
        });

        it('should reject access to soft-deleted expenses', async () => {
            // Arrange
            const expenseId = 'deleted-expense-id';
            const userId = 'test-user-id';

            const mockDeletedExpense = {
                id: expenseId,
                groupId: 'test-group-id',
                createdBy: userId,
                paidBy: userId,
                amount: 100,
                currency: 'USD',
                description: 'Deleted expense',
                category: 'Food',
                date: Timestamp.now(),
                splitType: 'equal',
                participants: [userId],
                splits: [{ userId: userId, amount: 100 }],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: Timestamp.now(), // Soft deleted
                deletedBy: userId,
            };

            setExpenseData(expenseId, mockDeletedExpense);

            // Act & Assert
            await expect(expenseService.getExpense(expenseId, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'NOT_FOUND',
                }),
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle non-existent expense gracefully', async () => {
            // Arrange
            const nonExistentId = 'non-existent-expense';
            const userId = 'test-user-id';

            // stubReader returns null for non-existent expenses by default

            // Act & Assert
            await expect(expenseService.getExpense(nonExistentId, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'NOT_FOUND',
                }),
            );
        });

        it('should handle expense data gracefully when optional fields are missing', async () => {
            // Arrange
            const expenseId = 'minimal-expense-id';
            const userId = 'test-user-id';

            // Set minimal data (the service handles undefined gracefully)
            const minimalExpense = {
                id: expenseId,
                groupId: 'test-group-id',
                participants: [userId],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: null,
            };

            setExpenseData(expenseId, minimalExpense);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert - Service handles missing fields gracefully
            expect(result.id).toBe(expenseId);
            expect(result.groupId).toBe('test-group-id');
            expect(result.participants).toEqual([userId]);
            expect(result.amount).toBeUndefined();
            expect(result.description).toBeUndefined();
        });
    });

    describe('Edge Cases', () => {
        it('should handle expenses with empty participants array', async () => {
            // Arrange
            const expenseId = 'empty-participants-expense';
            const userId = 'test-user-id';

            const mockExpense = {
                id: expenseId,
                groupId: 'test-group-id',
                createdBy: userId,
                paidBy: userId,
                amount: 100,
                currency: 'USD',
                description: 'Empty participants expense',
                category: 'Food',
                date: Timestamp.now(),
                splitType: 'equal',
                participants: [], // Empty participants
                splits: [],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: null,
                deletedBy: null,
            };

            setExpenseData(expenseId, mockExpense);

            // Act & Assert
            await expect(expenseService.getExpense(expenseId, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                    code: 'NOT_EXPENSE_PARTICIPANT',
                }),
            );
        });

        it('should handle expenses with null participants', async () => {
            // Arrange
            const expenseId = 'null-participants-expense';
            const userId = 'test-user-id';

            const mockExpense = {
                id: expenseId,
                groupId: 'test-group-id',
                createdBy: userId,
                paidBy: userId,
                amount: 100,
                currency: 'USD',
                description: 'Null participants expense',
                category: 'Food',
                date: Timestamp.now(),
                splitType: 'equal',
                participants: null, // Null participants
                splits: [],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: null,
                deletedBy: null,
            };

            setExpenseData(expenseId, mockExpense);

            // Act & Assert
            await expect(expenseService.getExpense(expenseId, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                    code: 'NOT_EXPENSE_PARTICIPANT',
                }),
            );
        });

        it('should handle decimal precision in amounts and splits correctly', async () => {
            // Arrange
            const expenseId = 'decimal-precision-expense';
            const userId = 'test-user-id';

            const mockExpense = {
                id: expenseId,
                groupId: 'test-group-id',
                createdBy: userId,
                paidBy: userId,
                amount: 100.33, // Decimal amount
                currency: 'USD',
                description: 'Decimal precision test',
                category: 'Food',
                date: Timestamp.now(),
                splitType: 'equal',
                participants: [userId],
                splits: [{ userId: userId, amount: 100.33 }],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: null,
                deletedBy: null,
            };

            setExpenseData(expenseId, mockExpense);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.amount).toBe(100.33);
            expect(result.splits[0].amount).toBe(100.33);
        });
    });

    describe('Validation Logic - Business Logic', () => {
        it('should require positive expense amount', async () => {
            // Arrange
            const { validateCreateExpense } = await import('../../../expenses/validation');

            const mockExpenseRequest: CreateExpenseRequest = {
                groupId: 'test-group',
                description: 'Negative amount test',
                amount: -50, // Invalid negative amount
                currency: 'USD',
                category: 'Food',
                paidBy: 'user1',
                participants: ['user1'],
                splitType: 'equal',
                date: new Date().toISOString(),
            };

            // Mock validation to reject negative amounts
            (validateCreateExpense as any).mockImplementation(() => {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_AMOUNT', 'Amount must be positive');
            });

            // Act & Assert
            await expect(expenseService.createExpense('user1', mockExpenseRequest))
                .rejects.toThrow(expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                }));
        });

        it('should validate currency format', async () => {
            // Arrange
            const { validateCreateExpense } = await import('../../../expenses/validation');

            const mockExpenseRequest: CreateExpenseRequest = {
                groupId: 'test-group',
                description: 'Invalid currency test',
                amount: 100,
                currency: 'INVALID_CURRENCY', // Invalid currency code
                category: 'Food',
                paidBy: 'user1',
                participants: ['user1'],
                splitType: 'equal',
                date: new Date().toISOString(),
            };

            // Mock validation to reject invalid currency
            (validateCreateExpense as any).mockImplementation(() => {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_CURRENCY', 'Invalid currency code');
            });

            // Act & Assert
            await expect(expenseService.createExpense('user1', mockExpenseRequest))
                .rejects.toThrow(expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                }));
        });
    });

    describe('Category and Metadata Handling', () => {
        it('should handle expense categories correctly', async () => {
            // Arrange
            const expenseId = 'categorized-expense';
            const userId = 'test-user-id';

            const mockExpense = {
                id: expenseId,
                groupId: 'test-group-id',
                createdBy: userId,
                paidBy: userId,
                amount: 100,
                currency: 'USD',
                description: 'Restaurant dinner',
                category: 'Food & Dining', // Specific category
                date: Timestamp.now(),
                splitType: 'equal',
                participants: [userId],
                splits: [{ userId, amount: 100 }],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: null,
                deletedBy: null,
            };

            setExpenseData(expenseId, mockExpense);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.category).toBe('Food & Dining');
        });

        it('should handle expenses without categories', async () => {
            // Arrange
            const expenseId = 'uncategorized-expense';
            const userId = 'test-user-id';

            const mockExpense = {
                id: expenseId,
                groupId: 'test-group-id',
                createdBy: userId,
                paidBy: userId,
                amount: 100,
                currency: 'USD',
                description: 'Uncategorized expense',
                // category intentionally omitted
                date: Timestamp.now(),
                splitType: 'equal',
                participants: [userId],
                splits: [{ userId, amount: 100 }],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: null,
                deletedBy: null,
            };

            setExpenseData(expenseId, mockExpense);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.category).toBeUndefined();
        });

        it('should preserve receipt URLs correctly', async () => {
            // Arrange
            const expenseId = 'receipt-expense';
            const userId = 'test-user-id';
            const receiptUrl = 'https://storage.example.com/receipts/receipt123.jpg';

            const mockExpense = {
                id: expenseId,
                groupId: 'test-group-id',
                createdBy: userId,
                paidBy: userId,
                amount: 100,
                currency: 'USD',
                description: 'Expense with receipt',
                category: 'Business',
                receiptUrl: receiptUrl,
                date: Timestamp.now(),
                splitType: 'equal',
                participants: [userId],
                splits: [{ userId, amount: 100 }],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: null,
                deletedBy: null,
            };

            setExpenseData(expenseId, mockExpense);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.receiptUrl).toBe(receiptUrl);
        });
    });

    describe('Database Error Handling', () => {
        it('should handle database read failures gracefully', async () => {
            // Arrange
            const expenseId = 'failing-expense';
            const userId = 'test-user-id';

            // Mock the reader to throw an error
            stubReader.getExpense = vi.fn().mockRejectedValue(
                new Error('Database connection failed')
            );

            // Act & Assert
            await expect(expenseService.getExpense(expenseId, userId))
                .rejects.toThrow('Database connection failed');
        });
    });
});