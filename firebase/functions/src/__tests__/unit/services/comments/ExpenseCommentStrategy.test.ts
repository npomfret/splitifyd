import { toGroupId } from '@splitifyd/shared';
import { SplitifydFirestoreTestDatabase } from '@splitifyd/test-support';
import { ExpenseDTOBuilder, GroupDTOBuilder, GroupMemberDocumentBuilder } from '@splitifyd/test-support';
import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../../constants';
import { ActivityFeedService } from '../../../../services/ActivityFeedService';
import { ExpenseCommentStrategy } from '../../../../services/comments/ExpenseCommentStrategy';
import { FirestoreReader } from '../../../../services/firestore';
import { FirestoreWriter } from '../../../../services/firestore';
import { GroupMemberService } from '../../../../services/GroupMemberService';
import { ApiError } from '../../../../utils/errors';

describe('ExpenseCommentStrategy', () => {
    let strategy: ExpenseCommentStrategy;
    let db: SplitifydFirestoreTestDatabase;

    const toFirestoreExpenseDocument = (expense: ReturnType<ExpenseDTOBuilder['build']>) => {
        const { isLocked: _ignored, ...firestoreExpense } = expense;
        return firestoreExpense;
    };

    beforeEach(() => {
        // Create stub database
        db = new SplitifydFirestoreTestDatabase();

        // Create real services using stub database
        const firestoreReader = new FirestoreReader(db);
        const firestoreWriter = new FirestoreWriter(db);
        const activityFeedService = new ActivityFeedService(firestoreReader, firestoreWriter);
        const groupMemberService = new GroupMemberService(firestoreReader, firestoreWriter, activityFeedService);

        // Create ExpenseCommentStrategy with real services
        strategy = new ExpenseCommentStrategy(firestoreReader, groupMemberService);
    });

    describe('verifyAccess', () => {
        it('should allow access when expense exists and user is group member', async () => {
            // Arrange
            const expenseId = 'test-expense';
            const groupId = toGroupId('test-group');
            const userId = 'user-id';

            const testExpense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withGroupId(groupId)
                .build();

            const testGroup = new GroupDTOBuilder()
                .withId(groupId)
                .build();

            // Seed data using SplitifydFirestoreTestDatabase
            db.seedExpense(expenseId, toFirestoreExpenseDocument(testExpense));
            db.seedGroup(groupId, testGroup);

            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .asMember()
                .buildDocument();
            db.seedGroupMember(groupId, userId, memberDoc);

            // Act & Assert
            await expect(strategy.verifyAccess(expenseId, userId)).resolves.not.toThrow();
        });

        it('should throw NOT_FOUND when expense does not exist', async () => {
            // Arrange - No expense seeded, database is empty

            // Act
            const error = (await strategy
                .verifyAccess('nonexistent-expense', 'user-id')
                .catch((e: ApiError) => e)) as ApiError;

            // Assert
            expect(error).toBeInstanceOf(ApiError);
            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe('EXPENSE_NOT_FOUND');
        });

        it('should throw NOT_FOUND when expense is soft deleted', async () => {
            // Arrange
            const expenseId = 'deleted-expense';
            const groupId = 'test-group';
            const userId = 'user-id';

            const deletedExpense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withGroupId(groupId)
                .build();

            // Add deletedAt timestamp to mark as deleted
            const deletedExpenseWithTimestamp = {
                ...toFirestoreExpenseDocument(deletedExpense),
                deletedAt: Timestamp.now(),
            };

            db.seedExpense(expenseId, deletedExpenseWithTimestamp);

            // Act
            const error = (await strategy.verifyAccess(expenseId, userId).catch((e: ApiError) => e)) as ApiError;

            // Assert
            expect(error).toBeInstanceOf(ApiError);
            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe('EXPENSE_NOT_FOUND');
        });

        it('should throw NOT_FOUND when expense group does not exist', async () => {
            // Arrange
            const expenseId = 'test-expense';
            const groupId = 'nonexistent-group';
            const userId = 'user-id';

            const testExpense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withGroupId(groupId)
                .build();

            // Seed only expense, not the group
            db.seedExpense(expenseId, toFirestoreExpenseDocument(testExpense));

            // Act
            const error = (await strategy.verifyAccess(expenseId, userId).catch((e: ApiError) => e)) as ApiError;

            // Assert
            expect(error).toBeInstanceOf(ApiError);
            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe('GROUP_NOT_FOUND');
        });

        it('should throw FORBIDDEN when user is not a member of expense group', async () => {
            // Arrange
            const expenseId = 'test-expense';
            const groupId = toGroupId('test-group');
            const userId = 'unauthorized-user';

            const testExpense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withGroupId(groupId)
                .build();

            const testGroup = new GroupDTOBuilder()
                .withId(groupId)
                .build();

            db.seedExpense(expenseId, toFirestoreExpenseDocument(testExpense));
            db.seedGroup(groupId, testGroup);
            // Don't seed group membership - user is not a member

            // Act
            const error = (await strategy.verifyAccess(expenseId, userId).catch((e: ApiError) => e)) as ApiError;

            // Assert
            expect(error).toBeInstanceOf(ApiError);
            expect(error.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
            expect(error.code).toBe('ACCESS_DENIED');
        });
    });
});
