import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { ExpenseService } from '../../../services/ExpenseService';
import { StubFirestoreReader, StubFirestoreWriter } from '../mocks/firestore-stubs';
import { GroupMemberService } from '../../../services/GroupMemberService';
import { UserService } from '../../../services/UserService2';
import { ApiError } from '../../../utils/errors';

// Mock dependencies
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

describe('ExpenseService - Focused Unit Tests', () => {
    let expenseService: ExpenseService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;
    let mockGroupMemberService: GroupMemberService;
    let mockUserService: UserService;

    beforeEach(() => {
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();

        mockGroupMemberService = {
            getAllGroupMembers: vi.fn().mockResolvedValue([]),
            getGroupMember: vi.fn(),
            isGroupMemberAsync: vi.fn().mockResolvedValue(true),
        } as any;

        mockUserService = {
            getUserProfile: vi.fn(),
            getUserProfiles: vi.fn().mockResolvedValue([]),
        } as any;

        expenseService = new ExpenseService(stubReader, stubWriter, mockGroupMemberService, mockUserService);
    });

    describe('Expense Access Control', () => {
        it('should allow participants to access expense', async () => {
            // Arrange
            const participantId = 'participant-user';
            const expenseId = 'test-expense';

            const expenseData = {
                id: expenseId,
                groupId: 'test-group',
                createdBy: participantId,
                paidBy: participantId,
                amount: 100,
                currency: 'USD',
                description: 'Test expense',
                category: 'Food',
                date: Timestamp.now(),
                splitType: 'equal',
                participants: [participantId],
                splits: [{ userId: participantId, amount: 100 }],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: null,
                deletedBy: null,
            };

            stubReader.setDocument('expenses', expenseId, expenseData);

            // Act
            const result = await expenseService.getExpense(expenseId, participantId);

            // Assert
            expect(result).toBeDefined();
            expect(result.id).toBe(expenseId);
            expect(result.description).toBe('Test expense');
        });

        it('should deny access to non-participants', async () => {
            // Arrange
            const participantId = 'participant-user';
            const outsiderId = 'outsider-user';
            const expenseId = 'test-expense';

            const expenseData = {
                id: expenseId,
                groupId: 'test-group',
                createdBy: participantId,
                paidBy: participantId,
                amount: 100,
                currency: 'USD',
                description: 'Private expense',
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

            stubReader.setDocument('expenses', expenseId, expenseData);

            // Act & Assert
            await expect(expenseService.getExpense(expenseId, outsiderId)).rejects.toThrow(ApiError);
        });

        it('should handle soft-deleted expenses correctly', async () => {
            // Arrange
            const userId = 'test-user';
            const expenseId = 'deleted-expense';

            const deletedExpense = {
                id: expenseId,
                groupId: 'test-group',
                createdBy: userId,
                paidBy: userId,
                amount: 100,
                currency: 'USD',
                description: 'Deleted expense',
                category: 'Food',
                date: Timestamp.now(),
                splitType: 'equal',
                participants: [userId],
                splits: [{ userId, amount: 100 }],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: Timestamp.now(), // Soft deleted
                deletedBy: userId,
            };

            stubReader.setDocument('expenses', expenseId, deletedExpense);

            // Act & Assert
            await expect(expenseService.getExpense(expenseId, userId)).rejects.toThrow();
        });
    });

    describe('Data Transformation', () => {
        it('should transform expense data correctly', async () => {
            // Arrange
            const userId = 'test-user';
            const expenseId = 'test-expense';
            const now = Timestamp.now();

            const expenseData = {
                id: expenseId,
                groupId: 'test-group',
                createdBy: userId,
                paidBy: userId,
                amount: 100.5,
                currency: 'USD',
                description: 'Test expense',
                category: 'Food',
                date: now,
                splitType: 'equal',
                participants: [userId],
                splits: [{ userId, amount: 100.5 }],
                receiptUrl: 'https://example.com/receipt.jpg',
                createdAt: now,
                updatedAt: now,
                deletedAt: null,
                deletedBy: null,
            };

            stubReader.setDocument('expenses', expenseId, expenseData);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result).toEqual({
                id: expenseId,
                groupId: 'test-group',
                createdBy: userId,
                paidBy: userId,
                amount: 100.5,
                currency: 'USD',
                description: 'Test expense',
                category: 'Food',
                date: expect.any(String), // ISO string
                splitType: 'equal',
                participants: [userId],
                splits: [{ userId, amount: 100.5 }],
                receiptUrl: 'https://example.com/receipt.jpg',
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
                deletedAt: null,
                deletedBy: null,
            });
        });

        it('should handle expense without receipt URL', async () => {
            // Arrange
            const userId = 'test-user';
            const expenseId = 'test-expense';

            const expenseData = {
                id: expenseId,
                groupId: 'test-group',
                createdBy: userId,
                paidBy: userId,
                amount: 100,
                currency: 'USD',
                description: 'Test expense',
                category: 'Food',
                date: Timestamp.now(),
                splitType: 'equal',
                participants: [userId],
                splits: [{ userId, amount: 100 }],
                // No receiptUrl
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: null,
                deletedBy: null,
            };

            stubReader.setDocument('expenses', expenseId, expenseData);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.receiptUrl).toBeUndefined();
        });
    });
});
