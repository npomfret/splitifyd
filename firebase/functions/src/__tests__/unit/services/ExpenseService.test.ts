import { toExpenseId, toExpenseLabel, toGroupId, USD } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, ExpenseSplitBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ExpenseService } from '../../../services/ExpenseService';
import { AppDriver } from '../AppDriver';

describe('ExpenseService - Consolidated Unit Tests', () => {
    let expenseService: ExpenseService;
    let appDriver: AppDriver;

    beforeEach(() => {
        // Create AppDriver which sets up all real services
        appDriver = new AppDriver();
        expenseService = appDriver.componentBuilder.buildExpenseService();
    });

    describe('Data Transformation and Validation', () => {
        it('should transform expense document to response format correctly', async () => {
            // Arrange
            const user1 = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user1.user.uid;

            const user2 = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const otherUserId = user2.user.uid;

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
                    .withSplits(
                        ExpenseSplitBuilder
                            .exactSplit([
                                { uid: userId, amount: '50.25' },
                                { uid: otherUserId, amount: '50.25' },
                            ])
                            .build(),
                    )
                    .withReceiptUrl('https://example.com/receipt.jpg')
                    .build(),
                userId,
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
                labels: ['Food'],
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
                supersededBy: null,
                isLocked: expect.any(Boolean), // Lock status computed based on group membership
                // userReactions is undefined when no reactions exist (denormalized on parent doc)
            });
        });

        it('should handle expense without receipt URL', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .build(),
                userId,
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
            const participantId = participant.user.uid;

            const nonParticipant = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const nonParticipantId = nonParticipant.user.uid;

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
                participantId,
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
            const participant1 = user1.user.uid;

            const user2 = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const participant2 = user2.user.uid;

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
                participant1,
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
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .build(),
                userId,
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
            const userId = user.user.uid;
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
            const userId = user.user.uid;

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
                userId,
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
            const userId = user.user.uid;

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
            const userId = user.user.uid;

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
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .withLabel('Food & Dining')
                    .build(),
                userId,
            );
            const expenseId = toExpenseId(expense.id);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.labels).toContain('Food & Dining');
        });

        it('should preserve receipt URLs correctly', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;
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
                userId,
            );
            const expenseId = toExpenseId(expense.id);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.receiptUrl).toBe(receiptUrl);
        });
    });

    describe('Focused Access Control Scenarios', () => {
        it('should allow participants to access expense (focused)', async () => {
            // Arrange
            const participant = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const participantId = participant.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), participantId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(participantId)
                    .withParticipants([participantId])
                    .withDescription('Test expense')
                    .build(),
                participantId,
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
            const participantId = participant.user.uid;

            const outsider = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const outsiderId = outsider.user.uid;

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
                participantId,
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
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .build(),
                userId,
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
            const userId = user.user.uid;

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
                userId,
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
                labels: ['Food'],
                date: expect.any(String), // ISO string
                splitType: 'equal',
                participants: [userId],
                splits: [{ uid: userId, amount: '100.5' }],
                receiptUrl: 'https://example.com/receipt.jpg',
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
                deletedAt: null,
                deletedBy: null,
                supersededBy: null,
                isLocked: expect.any(Boolean),
                // userReactions is undefined when no reactions exist (denormalized on parent doc)
            });
        });

        it('should handle expense without receipt URL (focused)', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .build(),
                userId,
            );
            const expenseId = toExpenseId(expense.id);

            // Act
            const result = await expenseService.getExpense(expenseId, userId);

            // Assert
            expect(result.receiptUrl).toBeUndefined();
        });
    });

    describe('recentlyUsedLabels Transactional Updates', () => {
        it('should update group recentlyUsedLabels when creating expense with labels', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            // Act - create expense with labels
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .withLabels(['Groceries', 'Food'])
                    .build(),
                userId,
            );

            // Assert - group should have recentlyUsedLabels updated
            const updatedGroup = await appDriver.getGroup(groupId, userId);
            expect(updatedGroup.recentlyUsedLabels).toBeDefined();
            expect(updatedGroup.recentlyUsedLabels![toExpenseLabel('Groceries')]).toBeDefined();
            expect(updatedGroup.recentlyUsedLabels![toExpenseLabel('Food')]).toBeDefined();
        });

        it('should update group recentlyUsedLabels when updating expense with new labels', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .withLabels(['OldLabel'])
                    .build(),
                userId,
            );

            // Act - update expense with different labels
            await appDriver.updateExpense(
                toExpenseId(expense.id),
                { labels: ['NewLabel', 'AnotherLabel'] } as any,
                userId,
            );

            // Assert - group should have all labels in recentlyUsedLabels
            const updatedGroup = await appDriver.getGroup(groupId, userId);
            expect(updatedGroup.recentlyUsedLabels).toBeDefined();
            expect(updatedGroup.recentlyUsedLabels![toExpenseLabel('OldLabel')]).toBeDefined();
            expect(updatedGroup.recentlyUsedLabels![toExpenseLabel('NewLabel')]).toBeDefined();
            expect(updatedGroup.recentlyUsedLabels![toExpenseLabel('AnotherLabel')]).toBeDefined();
        });

        it('should not update recentlyUsedLabels when expense has no labels', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            // Act - create expense with empty labels
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .withLabels([])
                    .build(),
                userId,
            );

            // Assert - group should not have recentlyUsedLabels or it should be empty
            const updatedGroup = await appDriver.getGroup(groupId, userId);
            const labelCount = updatedGroup.recentlyUsedLabels
                ? Object.keys(updatedGroup.recentlyUsedLabels).length
                : 0;
            expect(labelCount).toBe(0);
        });

        it('should update timestamp for existing label when reused', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            // Create first expense with label
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .withLabels(['ReusedLabel'])
                    .build(),
                userId,
            );

            const groupAfterFirst = await appDriver.getGroup(groupId, userId);
            const firstTimestamp = groupAfterFirst.recentlyUsedLabels![toExpenseLabel('ReusedLabel')];

            // Small delay to ensure timestamp difference
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Act - create second expense with same label
            await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .withLabels(['ReusedLabel'])
                    .build(),
                userId,
            );

            // Assert - timestamp should be updated (more recent)
            const groupAfterSecond = await appDriver.getGroup(groupId, userId);
            const secondTimestamp = groupAfterSecond.recentlyUsedLabels![toExpenseLabel('ReusedLabel')];
            expect(secondTimestamp >= firstTimestamp).toBe(true);
        });

        it('should prune recentlyUsedLabels to 50 entries when limit exceeded', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            // Create expenses with unique labels to fill up the map
            // Each expense can have up to 3 labels, so we need ~17 expenses to exceed 50
            for (let i = 0; i < 18; i++) {
                await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withPaidBy(userId)
                        .withParticipants([userId])
                        .withLabels([`Label${i * 3}`, `Label${i * 3 + 1}`, `Label${i * 3 + 2}`])
                        .build(),
                    userId,
                );
            }

            // Assert - should have at most 50 labels
            const updatedGroup = await appDriver.getGroup(groupId, userId);
            const labelCount = updatedGroup.recentlyUsedLabels
                ? Object.keys(updatedGroup.recentlyUsedLabels).length
                : 0;
            expect(labelCount).toBeLessThanOrEqual(50);
            expect(labelCount).toBeGreaterThan(0);
        });
    });
});
