import { CreateExpenseRequestBuilder, ExpenseDTOBuilder, GroupDTOBuilder } from '@splitifyd/test-support';
import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it } from 'vitest';
import { Timestamp as FirestoreTimestamp } from '../../../firestore-wrapper';
import { HTTP_STATUS } from '../../../constants';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import { ExpenseService } from '../../../services/ExpenseService';
import { FirestoreReader } from '../../../services/firestore/FirestoreReader';
import { FirestoreWriter } from '../../../services/firestore/FirestoreWriter';
import { ApiError } from '../../../utils/errors';
import { StubAuthService, StubFirestoreDatabase } from '../mocks/firestore-stubs';

describe('ExpenseService - Consolidated Unit Tests', () => {
    let expenseService: ExpenseService;
    let db: StubFirestoreDatabase;
    let applicationBuilder: ApplicationBuilder;
    let stubAuthService: StubAuthService;

    beforeEach(() => {
        // Create stub database
        db = new StubFirestoreDatabase();
        stubAuthService = new StubAuthService();

        // Create reader and writer with stub database
        const firestoreReader = new FirestoreReader(db);
        const firestoreWriter = new FirestoreWriter(db);

        // Use ApplicationBuilder to create properly wired ExpenseService
        applicationBuilder = new ApplicationBuilder(firestoreReader, firestoreWriter, stubAuthService);
        expenseService = applicationBuilder.buildExpenseService();
    });

    describe('Data Transformation and Validation', () => {
        it('should transform expense document to response format correctly', async () => {
            // Arrange
            const expenseId = 'test-expense-id';
            const userId = 'test-user-id';
            const now = FirestoreTimestamp.now();

            const mockExpense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withGroupId('test-group-id')
                .withCreatedBy('creator-id')
                .withPaidBy('payer-id')
                .withAmount(100.5)
                .withCurrency('USD')
                .withDescription('Test expense')
                .withCategory('Food')
                .withSplitType('equal')
                .withParticipants([userId, 'other-user'])
                .withSplits([
                    { uid: userId, amount: 50.25 },
                    { uid: 'other-user', amount: 50.25 },
                ])
                .withReceiptUrl('https://example.com/receipt.jpg')
                .withCreatedAt(now)
                .withUpdatedAt(now)
                .build();

            // Seed the expense with Timestamp objects
            db.seedExpense(expenseId, mockExpense);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result).toEqual({
                id: expenseId,
                groupId: 'test-group-id',
                createdBy: 'creator-id',
                paidBy: 'payer-id',
                amount: 100.5,
                currency: 'USD',
                description: 'Test expense',
                category: 'Food',
                date: expect.any(String), // ISO string
                splitType: 'equal',
                participants: [userId, 'other-user'],
                splits: [
                    { uid: userId, amount: 50.25 },
                    { uid: 'other-user', amount: 50.25 },
                ],
                receiptUrl: 'https://example.com/receipt.jpg',
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
                deletedAt: null,
                deletedBy: null,
                isLocked: expect.any(Boolean), // Lock status computed based on group membership
            });
        });

        it('should handle expense without receipt URL', async () => {
            // Arrange
            const expenseId = 'test-expense-id';
            const userId = 'test-user-id';

            const mockExpense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withParticipants([userId])
                .withCreatedAt(FirestoreTimestamp.now())
                .withUpdatedAt(FirestoreTimestamp.now())
                .build();

            db.seedExpense(expenseId, mockExpense);

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

            const mockExpense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withParticipants([participantId])
                .withCreatedAt(FirestoreTimestamp.now())
                .withUpdatedAt(FirestoreTimestamp.now())
                .build();

            db.seedExpense(expenseId, mockExpense);

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

            const mockExpense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withParticipants([participant1, participant2])
                .withCreatedAt(FirestoreTimestamp.now())
                .withUpdatedAt(FirestoreTimestamp.now())
                .build();

            db.seedExpense(expenseId, mockExpense);

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

            const mockDeletedExpense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withParticipants([userId])
                .withDeletedAt(FirestoreTimestamp.now())
                .withCreatedAt(FirestoreTimestamp.now())
                .withUpdatedAt(FirestoreTimestamp.now())
                .build();

            db.seedExpense(expenseId,mockDeletedExpense);

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

            // Don't seed any data - expense doesn't exist

            // Act & Assert
            await expect(expenseService.getExpense(nonExistentId, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'NOT_FOUND',
                }),
            );
        });
    });

    describe('Edge Cases', () => {
        it('should handle decimal precision in amounts and splits correctly', async () => {
            // Arrange
            const expenseId = 'decimal-precision-expense';
            const userId = 'test-user-id';

            const mockExpense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withAmount(100.33)
                .withParticipants([userId])
                .withSplits([{ uid: userId, amount: 100.33 }])
                .withCreatedAt(FirestoreTimestamp.now())
                .withUpdatedAt(FirestoreTimestamp.now())
                .build();

            db.seedExpense(expenseId, mockExpense);

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
            const mockExpenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId('test-group')
                .withDescription('Negative amount test')
                .withAmount(-50) // Invalid negative amount
                .withCurrency('USD')
                .withCategory('Food')
                .withPaidBy('user1')
                .withParticipants(['user1'])
                .withSplitType('equal')
                .withSplits([{ uid: 'user1', amount: -50 }])
                .withDate(new Date().toISOString())
                .build();

            // Act & Assert - Real validation should reject negative amounts
            await expect(expenseService.createExpense('user1', mockExpenseRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                }),
            );
        });

        it('should validate currency format', async () => {
            // Arrange
            const mockExpenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId('test-group')
                .withDescription('Invalid currency test')
                .withAmount(100)
                .withCurrency('INVALID_CURRENCY') // Invalid currency code
                .withCategory('Food')
                .withPaidBy('user1')
                .withParticipants(['user1'])
                .withSplitType('equal')
                .withSplits([{ uid: 'user1', amount: 100 }])
                .withDate(new Date().toISOString())
                .build();

            // Act & Assert - Real validation should reject invalid currency
            await expect(expenseService.createExpense('user1', mockExpenseRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                }),
            );
        });
    });

    describe('Category and Metadata Handling', () => {
        it('should handle expense categories correctly', async () => {
            // Arrange
            const expenseId = 'categorized-expense';
            const userId = 'test-user-id';

            const mockExpense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withCategory('Food & Dining')
                .withParticipants([userId])
                .withCreatedAt(FirestoreTimestamp.now())
                .withUpdatedAt(FirestoreTimestamp.now())
                .build();

            db.seedExpense(expenseId, mockExpense);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.category).toBe('Food & Dining');
        });

        it('should preserve receipt URLs correctly', async () => {
            // Arrange
            const expenseId = 'receipt-expense';
            const userId = 'test-user-id';
            const receiptUrl = 'https://storage.example.com/receipts/receipt123.jpg';

            const mockExpense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withReceiptUrl(receiptUrl)
                .withParticipants([userId])
                .withCreatedAt(FirestoreTimestamp.now())
                .withUpdatedAt(FirestoreTimestamp.now())
                .build();

            db.seedExpense(expenseId, mockExpense);

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

            // Make the database throw an error by overriding collection method
            db.collection = () => {
                throw new Error('Database connection failed');
            };

            // Act & Assert
            await expect(expenseService.getExpense(expenseId, userId)).rejects.toThrow('Database connection failed');
        });
    });

    describe('Focused Access Control Scenarios', () => {
        it('should allow participants to access expense (focused)', async () => {
            // Arrange
            const participantId = 'participant-user';
            const expenseId = 'test-expense';

            const expenseData = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withDescription('Test expense')
                .withParticipants([participantId])
                .withCreatedAt(FirestoreTimestamp.now())
                .withUpdatedAt(FirestoreTimestamp.now())
                .build();

            db.seedExpense(expenseId,expenseData);

            // Act
            const result = await expenseService.getExpense(expenseId, participantId);

            // Assert
            expect(result).toBeDefined();
            expect(result.id).toBe(expenseId);
            expect(result.description).toBe('Test expense');
        });

        it('should deny access to non-participants (focused)', async () => {
            // Arrange
            const participantId = 'participant-user';
            const outsiderId = 'outsider-user';
            const expenseId = 'test-expense';

            const expenseData = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withParticipants([participantId])
                .withCreatedAt(FirestoreTimestamp.now())
                .withUpdatedAt(FirestoreTimestamp.now())
                .build();

            db.seedExpense(expenseId,expenseData);

            // Act & Assert
            await expect(expenseService.getExpense(expenseId, outsiderId)).rejects.toThrow(ApiError);
        });

        it('should handle soft-deleted expenses correctly (focused)', async () => {
            // Arrange
            const userId = 'test-user';
            const expenseId = 'deleted-expense';

            const deletedExpense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withParticipants([userId])
                .withDeletedAt(FirestoreTimestamp.now())
                .withCreatedAt(FirestoreTimestamp.now())
                .withUpdatedAt(FirestoreTimestamp.now())
                .build();

            db.seedExpense(expenseId,deletedExpense);

            // Act & Assert
            await expect(expenseService.getExpense(expenseId, userId)).rejects.toThrow();
        });
    });

    describe('Focused Data Transformation Scenarios', () => {
        it('should transform expense data correctly (focused)', async () => {
            // Arrange
            const userId = 'test-user';
            const expenseId = 'test-expense';
            const now = FirestoreTimestamp.now();

            const expenseData = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withGroupId('test-group')
                .withCreatedBy(userId)
                .withPaidBy(userId)
                .withAmount(100.5)
                .withCurrency('USD')
                .withDescription('Test expense')
                .withCategory('Food')
                .withSplitType('equal')
                .withParticipants([userId])
                .withSplits([{ uid: userId, amount: 100.5 }])
                .withReceiptUrl('https://example.com/receipt.jpg')
                .withCreatedAt(now)
                .withUpdatedAt(now)
                .build();

            db.seedExpense(expenseId,expenseData);

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
                splits: [{ uid: userId, amount: 100.5 }],
                receiptUrl: 'https://example.com/receipt.jpg',
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
                deletedAt: null,
                deletedBy: null,
                isLocked: expect.any(Boolean),
            });
        });

        it('should handle expense without receipt URL (focused)', async () => {
            // Arrange
            const userId = 'test-user';
            const expenseId = 'test-expense';

            const expenseData = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withParticipants([userId])
                .withCreatedAt(FirestoreTimestamp.now())
                .withUpdatedAt(FirestoreTimestamp.now())
                .build();

            db.seedExpense(expenseId,expenseData);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.receiptUrl).toBeUndefined();
        });
    });
});
