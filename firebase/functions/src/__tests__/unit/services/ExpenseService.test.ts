import { toExpenseId, toGroupId, USD, toUserId } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, ExpenseSplitBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { StubCloudTasksClient } from '@billsplit-wl/firebase-simulator';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { ExpenseService } from '../../../services/ExpenseService';
import { AppDriver } from '../AppDriver';
import { StubAuthService } from '../mocks/StubAuthService';


describe('ExpenseService - Consolidated Unit Tests', () => {
    let expenseService: ExpenseService;
    let appDriver: AppDriver;

    beforeEach(() => {
        // Create AppDriver which sets up all real services
        appDriver = new AppDriver();

        // Use ComponentBuilder to create the service with proper dependencies
        const stubAuth = new StubAuthService();
        const componentBuilder = new ComponentBuilder(stubAuth, appDriver.database, appDriver.storageStub, new StubCloudTasksClient());
        expenseService = componentBuilder.buildExpenseService();
    });

    describe('Data Transformation and Validation', () => {
        it('should transform expense document to response format correctly', async () => {
            // Arrange
            const user1 = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user1.user.uid);

            const user2 = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const otherUserId = toUserId(user2.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            // Add second user to group
            await appDriver.addMembersToGroup(groupId, userId, [otherUserId]);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId, otherUserId])
                    .withAmount(100.5, 'USD')
                    .withDescription('Test expense')
                    .withLabel('Food')
                    .withSplitType('equal')
                    .withSplits(ExpenseSplitBuilder.exactSplit([
                        { uid: userId, amount: '50.25' },
                        { uid: otherUserId, amount: '50.25' }
                    ]).build())
                    .withReceiptUrl('https://example.com/receipt.jpg')
                    .build(),
                userId
            );
            const expenseId = toExpenseId(expense.id);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result).toEqual({
                id: expenseId,
                groupId: groupId,
                createdBy: userId,
                paidBy: userId,
                amount: '100.5',
                currency: USD,
                description: 'Test expense',
                label: 'Food',
                date: expect.any(String), // ISO string
                splitType: 'equal',
                participants: [userId, otherUserId],
                splits: [
                    { uid: userId, amount: '50.25' },
                    { uid: otherUserId, amount: '50.25' },
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
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .build(),
                userId
            );
            const expenseId = toExpenseId(expense.id);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.receiptUrl).toBeUndefined();
        });
    });

    describe('Access Control and Security', () => {
        it('should allow access for non-participants', async () => {
            // Arrange
            const participant = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const participantId = toUserId(participant.user.uid);

            const nonParticipant = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const nonParticipantId = toUserId(nonParticipant.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), participantId);
            const groupId = toGroupId(group.id);

            // Add non-participant to the group
            await appDriver.addMembersToGroup(groupId, participantId, [nonParticipantId]);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(participantId)
                    .withParticipants([participantId])
                    .build(),
                participantId
            );
            const expenseId = toExpenseId(expense.id);

            // Act & Assert
            const result = await expenseService.getExpense(expenseId, nonParticipantId);
            expect(result.id).toBe(expenseId);
            expect(result.participants).toEqual([participantId]);
        });

        it('should allow access for all participants', async () => {
            // Arrange
            const user1 = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const participant1 = toUserId(user1.user.uid);

            const user2 = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const participant2 = toUserId(user2.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), participant1);
            const groupId = toGroupId(group.id);

            // Add second participant to group
            await appDriver.addMembersToGroup(groupId, participant1, [participant2]);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(participant1)
                    .withParticipants([participant1, participant2])
                    .build(),
                participant1
            );
            const expenseId = toExpenseId(expense.id);

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
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .build(),
                userId
            );
            const expenseId = toExpenseId(expense.id);

            // Delete the expense (soft delete)
            await appDriver.deleteExpense(expenseId, userId);

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
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);
            const nonExistentId = toExpenseId('non-existent-expense');

            // Act & Assert - expense doesn't exist
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
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .withAmount(100.33, 'USD')
                    .withSplitType('exact')
                    .withSplits(ExpenseSplitBuilder.exactSplit([{ uid: userId, amount: '100.33' }]).build())
                    .build(),
                userId
            );
            const expenseId = toExpenseId(expense.id);

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
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const mockExpenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withDescription('Negative amount test')
                .withAmount(-50, 'USD') // Invalid negative amount
                .withLabel('Food')
                .withPaidBy(userId)
                .withParticipants([userId])
                .withSplitType('equal')
                .withSplits(ExpenseSplitBuilder.exactSplit([{ uid: userId, amount: '-50' }]).build())
                .withDate(new Date().toISOString())
                .build();

            // Act & Assert - Real validation should reject negative amounts
            await expect(expenseService.createExpense(userId, mockExpenseRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                }),
            );
        });

        it('should validate currency format', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const mockExpenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withDescription('Invalid currency test')
                .withAmount(100, 'INVALID_CURRENCY') // Invalid currency code
                .withLabel('Food')
                .withPaidBy(userId)
                .withParticipants([userId])
                .withSplitType('equal')
                .withSplits(ExpenseSplitBuilder.exactSplit([{ uid: userId, amount: '100' }]).build())
                .withDate(new Date().toISOString())
                .build();

            // Act & Assert - Real validation should reject invalid currency
            await expect(expenseService.createExpense(userId, mockExpenseRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                }),
            );
        });
    });

    describe('Label and Metadata Handling', () => {
        it('should handle expense labels correctly', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .withLabel('Food & Dining')
                    .build(),
                userId
            );
            const expenseId = toExpenseId(expense.id);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.label).toBe('Food & Dining');
        });

        it('should preserve receipt URLs correctly', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);
            const receiptUrl = 'https://storage.example.com/receipts/receipt123.jpg';

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .withReceiptUrl(receiptUrl)
                    .build(),
                userId
            );
            const expenseId = toExpenseId(expense.id);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.receiptUrl).toBe(receiptUrl);
        });
    });

    describe('Database Error Handling', () => {
        it('should handle database read failures gracefully', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);
            const expenseId = toExpenseId('failing-expense');

            // Make the database throw an error by overriding collection method
            const db = appDriver.database;
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
            const participant = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const participantId = toUserId(participant.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), participantId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(participantId)
                    .withParticipants([participantId])
                    .withDescription('Test expense')
                    .build(),
                participantId
            );
            const expenseId = toExpenseId(expense.id);

            // Act
            const result = await expenseService.getExpense(expenseId, participantId);

            // Assert
            expect(result).toBeDefined();
            expect(result.id).toBe(expenseId);
            expect(result.description).toBe('Test expense');
        });

        it('should allow access to non-participants (focused)', async () => {
            // Arrange
            const participant = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const participantId = toUserId(participant.user.uid);

            const outsider = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const outsiderId = toUserId(outsider.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), participantId);
            const groupId = toGroupId(group.id);

            // Add outsider to group (they're a member but not a participant in the expense)
            await appDriver.addMembersToGroup(groupId, participantId, [outsiderId]);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(participantId)
                    .withParticipants([participantId])
                    .build(),
                participantId
            );
            const expenseId = toExpenseId(expense.id);

            // Act
            const result = await expenseService.getExpense(expenseId, outsiderId);

            // Assert
            expect(result.id).toBe(expenseId);
            expect(result.participants).toEqual([participantId]);
        });

        it('should handle soft-deleted expenses correctly (focused)', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .build(),
                userId
            );
            const expenseId = toExpenseId(expense.id);

            // Delete the expense
            await appDriver.deleteExpense(expenseId, userId);

            // Act & Assert
            await expect(expenseService.getExpense(expenseId, userId)).rejects.toThrow();
        });
    });

    describe('Focused Data Transformation Scenarios', () => {
        it('should transform expense data correctly (focused)', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .withAmount(100.5, 'USD')
                    .withDescription('Test expense')
                    .withLabel('Food')
                    .withSplitType('equal')
                    .withSplits(ExpenseSplitBuilder.exactSplit([{ uid: userId, amount: '100.5' }]).build())
                    .withReceiptUrl('https://example.com/receipt.jpg')
                    .build(),
                userId
            );
            const expenseId = toExpenseId(expense.id);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result).toEqual({
                id: expenseId,
                groupId: groupId,
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
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = toUserId(user.user.uid);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .build(),
                userId
            );
            const expenseId = toExpenseId(expense.id);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.receiptUrl).toBeUndefined();
        });
    });
});
