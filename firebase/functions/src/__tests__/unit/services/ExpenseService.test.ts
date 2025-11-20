import { StubStorage } from '@billsplit-wl/test-support';
import { toExpenseId, toGroupId, toCurrencyISOCode, USD } from '@billsplit-wl/shared';
import { convertToISOString, TenantFirestoreTestDatabase } from '@billsplit-wl/test-support';
import { CreateExpenseRequestBuilder, ExpenseDTOBuilder, ExpenseSplitBuilder, GroupMemberDocumentBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { ExpenseService } from '../../../services/ExpenseService';
import { StubAuthService } from '../mocks/StubAuthService';

describe('ExpenseService - Consolidated Unit Tests', () => {
    let expenseService: ExpenseService;
    let db: TenantFirestoreTestDatabase;

    beforeEach(() => {
        db = new TenantFirestoreTestDatabase();
        const stubAuth = new StubAuthService();
        const applicationBuilder = new ComponentBuilder(stubAuth, db, new StubStorage({ defaultBucketName: 'test-bucket' }));
        expenseService = applicationBuilder.buildExpenseService();
    });

    // Helper to seed group membership with minimal data
    const seedMembership = (groupId: string, userId: string) => {
        db.seedGroupMember(
            toGroupId(groupId),
            userId,
            new GroupMemberDocumentBuilder()
                .withUserId(userId as any)
                .withGroupId(toGroupId(groupId))
                .withGroupDisplayName(`User ${userId}`)
                .buildDocument(),
        );
    };

    describe('Data Transformation and Validation', () => {
        it('should transform expense document to response format correctly', async () => {
            // Arrange
            const expenseId = toExpenseId('test-expense-id');
            const userId = 'test-user-id';
            const now = convertToISOString(new Date());

            const mockExpense = new ExpenseDTOBuilder()
                .withExpenseId(expenseId)
                .withGroupId('test-group-id')
                .withCreatedBy('creator-id')
                .withPaidBy('payer-id')
                .withAmount(100.5, 'USD')
                .withDescription('Test expense')
                .withLabel('Food')
                .withSplitType('equal')
                .withParticipants([userId, 'other-user'])
                .withSplits(ExpenseSplitBuilder.exactSplit([{ uid: userId, amount: '50.25' }, { uid: 'other-user', amount: '50.25' }]).build())
                .withReceiptUrl('https://example.com/receipt.jpg')
                .withCreatedAt(now)
                .withUpdatedAt(now)
                .build();

            // Seed group and membership for access control
            db.seedGroup(toGroupId('test-group-id'), { name: 'Test Group' });
            seedMembership('test-group-id', userId);

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
                amount: '100.5',
                currency: USD,
                description: 'Test expense',
                label: 'Food',
                date: expect.any(String), // ISO string
                splitType: 'equal',
                participants: [userId, 'other-user'],
                splits: [
                    { uid: userId, amount: '50.25' },
                    { uid: 'other-user', amount: '50.25' },
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
            const expenseId = toExpenseId('test-expense-id');
            const userId = 'test-user-id';

            const mockExpense = new ExpenseDTOBuilder()
                .withExpenseId(expenseId)
                .withParticipants([userId])
                .withCreatedAt(convertToISOString(new Date()))
                .withUpdatedAt(convertToISOString(new Date()))
                .build();

            // Seed group and membership for access control
            db.seedGroup(mockExpense.groupId, { name: 'Test Group' });
            seedMembership(mockExpense.groupId, userId);

            db.seedExpense(expenseId, mockExpense);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.receiptUrl).toBeUndefined();
        });
    });

    describe('Access Control and Security', () => {
        it('should allow access for non-participants', async () => {
            // Arrange
            const expenseId = toExpenseId('test-expense-id');
            const participantId = 'participant-user';
            const nonParticipantId = 'non-participant-user';

            const mockExpense = new ExpenseDTOBuilder()
                .withExpenseId(expenseId)
                .withParticipants([participantId])
                .withCreatedAt(convertToISOString(new Date()))
                .withUpdatedAt(convertToISOString(new Date()))
                .build();

            db.seedGroup(mockExpense.groupId, { name: 'Test Group' });
            seedMembership(mockExpense.groupId, nonParticipantId);
            seedMembership(mockExpense.groupId, participantId);

            db.seedExpense(expenseId, mockExpense);

            // Act & Assert
            const expense = await expenseService.getExpense(expenseId, nonParticipantId);
            expect(expense.id).toBe(expenseId);
            expect(expense.participants).toEqual([participantId]);
        });

        it('should allow access for all participants', async () => {
            // Arrange
            const expenseId = toExpenseId('test-expense-id');
            const participant1 = 'participant-1';
            const participant2 = 'participant-2';

            const mockExpense = new ExpenseDTOBuilder()
                .withExpenseId(expenseId)
                .withParticipants([participant1, participant2])
                .withCreatedAt(convertToISOString(new Date()))
                .withUpdatedAt(convertToISOString(new Date()))
                .build();

            // Seed group and membership for access control
            db.seedGroup(mockExpense.groupId, { name: 'Test Group' });
            seedMembership(mockExpense.groupId, participant1);
            seedMembership(mockExpense.groupId, participant2);

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
            const expenseId = toExpenseId('deleted-expense-id');
            const userId = 'test-user-id';

            const mockDeletedExpense = new ExpenseDTOBuilder()
                .withExpenseId(expenseId)
                .withParticipants([userId])
                .withDeletedAt(convertToISOString(new Date()))
                .withCreatedAt(convertToISOString(new Date()))
                .withUpdatedAt(convertToISOString(new Date()))
                .build();

            db.seedExpense(expenseId, mockDeletedExpense);

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
            const nonExistentId = toExpenseId('non-existent-expense');
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
            const expenseId = toExpenseId('decimal-precision-expense');
            const userId = 'test-user-id';

            const mockExpense = new ExpenseDTOBuilder()
                .withExpenseId(expenseId)
                .withAmount(100.33, 'USD')
                .withParticipants([userId])
                .withSplits(ExpenseSplitBuilder.exactSplit([{ uid: userId, amount: '100.33' }]).build())
                .withCreatedAt(convertToISOString(new Date()))
                .withUpdatedAt(convertToISOString(new Date()))
                .build();

            // Seed group and membership for access control
            db.seedGroup(mockExpense.groupId, { name: 'Test Group' });
            seedMembership(mockExpense.groupId, userId);

            db.seedExpense(expenseId, mockExpense);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.amount).toBe('100.33');
            expect(result.splits[0].amount).toBe('100.33');
        });
    });

    describe('Validation Logic - Business Logic', () => {
        it('should require positive expense amount', async () => {
            // Arrange
            const mockExpenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId('test-group')
                .withDescription('Negative amount test')
                .withAmount(-50, 'USD') // Invalid negative amount                .withCurrency('USD')
                .withLabel('Food')
                .withPaidBy('user1')
                .withParticipants(['user1'])
                .withSplitType('equal')
                .withSplits(ExpenseSplitBuilder.exactSplit([{ uid: 'user1', amount: '-50' }]).build())
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
                .withAmount(100, 'INVALID_CURRENCY') // Invalid currency code
                .withLabel('Food')
                .withPaidBy('user1')
                .withParticipants(['user1'])
                .withSplitType('equal')
                .withSplits(ExpenseSplitBuilder.exactSplit([{ uid: 'user1', amount: '100' }]).build())
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

    describe('Label and Metadata Handling', () => {
        it('should handle expense labels correctly', async () => {
            // Arrange
            const expenseId = toExpenseId('categorized-expense');
            const userId = 'test-user-id';

            const mockExpense = new ExpenseDTOBuilder()
                .withExpenseId(expenseId)
                .withLabel('Food & Dining')
                .withParticipants([userId])
                .withCreatedAt(convertToISOString(new Date()))
                .withUpdatedAt(convertToISOString(new Date()))
                .build();

            // Seed group and membership for access control
            db.seedGroup(mockExpense.groupId, { name: 'Test Group' });
            seedMembership(mockExpense.groupId, userId);

            db.seedExpense(expenseId, mockExpense);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.label).toBe('Food & Dining');
        });

        it('should preserve receipt URLs correctly', async () => {
            // Arrange
            const expenseId = toExpenseId('receipt-expense');
            const userId = 'test-user-id';
            const receiptUrl = 'https://storage.example.com/receipts/receipt123.jpg';

            const mockExpense = new ExpenseDTOBuilder()
                .withExpenseId(expenseId)
                .withReceiptUrl(receiptUrl)
                .withParticipants([userId])
                .withCreatedAt(convertToISOString(new Date()))
                .withUpdatedAt(convertToISOString(new Date()))
                .build();

            // Seed group and membership for access control
            db.seedGroup(mockExpense.groupId, { name: 'Test Group' });
            seedMembership(mockExpense.groupId, userId);

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
            const expenseId = toExpenseId('failing-expense');
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
            const expenseId = toExpenseId('test-expense');

            const expenseData = new ExpenseDTOBuilder()
                .withExpenseId(expenseId)
                .withDescription('Test expense')
                .withParticipants([participantId])
                .withCreatedAt(convertToISOString(new Date()))
                .withUpdatedAt(convertToISOString(new Date()))
                .build();

            // Seed group and membership for access control
            db.seedGroup(expenseData.groupId, { name: 'Test Group' });
            seedMembership(expenseData.groupId, participantId);

            db.seedExpense(expenseId, expenseData);

            // Act
            const result = await expenseService.getExpense(expenseId, participantId);

            // Assert
            expect(result).toBeDefined();
            expect(result.id).toBe(expenseId);
            expect(result.description).toBe('Test expense');
        });

        it('should allow access to non-participants (focused)', async () => {
            // Arrange
            const participantId = 'participant-user';
            const outsiderId = 'outsider-user';
            const expenseId = toExpenseId('test-expense');

            const expenseData = new ExpenseDTOBuilder()
                .withExpenseId(expenseId)
                .withParticipants([participantId])
                .withCreatedAt(convertToISOString(new Date()))
                .withUpdatedAt(convertToISOString(new Date()))
                .build();

            // Seed group and membership for access control (outsider is still a group member)
            db.seedGroup(expenseData.groupId, { name: 'Test Group' });
            seedMembership(expenseData.groupId, outsiderId);
            seedMembership(expenseData.groupId, participantId);

            db.seedExpense(expenseId, expenseData);

            // Act
            const result = await expenseService.getExpense(expenseId, outsiderId);

            // Assert
            expect(result.id).toBe(expenseId);
            expect(result.participants).toEqual([participantId]);
        });

        it('should handle soft-deleted expenses correctly (focused)', async () => {
            // Arrange
            const userId = 'test-user';
            const expenseId = toExpenseId('deleted-expense');

            const deletedExpense = new ExpenseDTOBuilder()
                .withExpenseId(expenseId)
                .withParticipants([userId])
                .withDeletedAt(convertToISOString(new Date()))
                .withCreatedAt(convertToISOString(new Date()))
                .withUpdatedAt(convertToISOString(new Date()))
                .build();

            db.seedExpense(expenseId, deletedExpense);

            // Act & Assert
            await expect(expenseService.getExpense(expenseId, userId)).rejects.toThrow();
        });
    });

    describe('Focused Data Transformation Scenarios', () => {
        it('should transform expense data correctly (focused)', async () => {
            // Arrange
            const userId = 'test-user';
            const expenseId = toExpenseId('test-expense');
            const now = convertToISOString(new Date());

            const expenseData = new ExpenseDTOBuilder()
                .withExpenseId(expenseId)
                .withGroupId('test-group')
                .withCreatedBy(userId)
                .withPaidBy(userId)
                .withAmount(100.5, 'USD')
                .withDescription('Test expense')
                .withLabel('Food')
                .withSplitType('equal')
                .withParticipants([userId])
                .withSplits(ExpenseSplitBuilder.exactSplit([{ uid: userId, amount: '100.5' }]).build())
                .withReceiptUrl('https://example.com/receipt.jpg')
                .withCreatedAt(now)
                .withUpdatedAt(now)
                .build();

            // Seed group and membership for access control
            db.seedGroup(toGroupId('test-group'), { name: 'Test Group' });
            seedMembership('test-group', userId);

            db.seedExpense(expenseId, expenseData);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result).toEqual({
                id: expenseId,
                groupId: 'test-group',
                createdBy: userId,
                paidBy: userId,
                amount: '100.5',
                currency: USD,
                description: 'Test expense',
                label: 'Food',
                date: expect.any(String), // ISO string
                splitType: 'equal',
                participants: [userId],
                splits: [{ uid: userId, amount: '100.5' }],
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
            const expenseId = toExpenseId('test-expense');

            const expenseData = new ExpenseDTOBuilder()
                .withExpenseId(expenseId)
                .withParticipants([userId])
                .withCreatedAt(convertToISOString(new Date()))
                .withUpdatedAt(convertToISOString(new Date()))
                .build();

            // Seed group and membership for access control
            db.seedGroup(expenseData.groupId, { name: 'Test Group' });
            seedMembership(expenseData.groupId, userId);

            db.seedExpense(expenseId, expenseData);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.receiptUrl).toBeUndefined();
        });
    });
});
