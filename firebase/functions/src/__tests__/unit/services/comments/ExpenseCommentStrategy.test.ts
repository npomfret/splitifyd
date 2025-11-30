import { toExpenseId, toGroupId } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../../constants';
import { ErrorCode } from '../../../../errors/ErrorCode';
import { ExpenseCommentStrategy } from '../../../../services/comments/ExpenseCommentStrategy';
import { ApiError } from '../../../../errors';
import { AppDriver } from '../../AppDriver';

describe('ExpenseCommentStrategy', () => {
    let strategy: ExpenseCommentStrategy;
    let appDriver: AppDriver;

    beforeEach(() => {
        // Create AppDriver which sets up all real services
        appDriver = new AppDriver();
        strategy = new ExpenseCommentStrategy(appDriver.componentBuilder.buildFirestoreReader(), appDriver.componentBuilder.buildGroupMemberService());
    });

    describe('verifyAccess', () => {
        it('should allow access when expense exists and user is group member', async () => {
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

            // Act & Assert
            await expect(strategy.verifyAccess(expenseId, userId)).resolves.not.toThrow();
        });

        it('should throw NOT_FOUND when expense does not exist', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            // Act
            const error = (await strategy
                .verifyAccess(toExpenseId('nonexistent-expense'), userId)
                .catch((e: ApiError) => e)) as ApiError;

            // Assert
            expect(error).toBeInstanceOf(ApiError);
            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe(ErrorCode.NOT_FOUND);
        });

        it('should throw NOT_FOUND when expense is soft deleted', async () => {
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

            // Act
            const error = (await strategy.verifyAccess(expenseId, userId).catch((e: ApiError) => e)) as ApiError;

            // Assert
            expect(error).toBeInstanceOf(ApiError);
            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe(ErrorCode.NOT_FOUND);
        });

        it('should throw FORBIDDEN when user is not a member of expense group', async () => {
            // Arrange
            const owner = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const ownerId = owner.user.uid;

            const nonMember = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const nonMemberId = nonMember.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), ownerId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(ownerId)
                    .withParticipants([ownerId])
                    .build(),
                ownerId,
            );
            const expenseId = toExpenseId(expense.id);

            // Act
            const error = (await strategy.verifyAccess(expenseId, nonMemberId).catch((e: ApiError) => e)) as ApiError;

            // Assert
            expect(error).toBeInstanceOf(ApiError);
            expect(error.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
            expect(error.code).toBe(ErrorCode.FORBIDDEN);
        });
    });
});
