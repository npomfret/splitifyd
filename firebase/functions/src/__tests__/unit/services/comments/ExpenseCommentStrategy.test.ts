import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpenseCommentStrategy } from '../../../../services/comments/ExpenseCommentStrategy';
import { MockFirestoreReader } from '../../../test-utils/MockFirestoreReader';
import { ApiError } from '../../../../utils/errors';
import { HTTP_STATUS } from '../../../../constants';
import { FirestoreExpenseBuilder, FirestoreGroupBuilder } from '@splitifyd/test-support';
import { FirestoreCollections } from '@splitifyd/shared';
import { Timestamp } from 'firebase-admin/firestore';

const createMockGroupMemberService = () => ({
    isGroupMemberAsync: vi.fn(),
    getGroupMember: vi.fn(),
    getAllGroupMembers: vi.fn(),
});

describe('ExpenseCommentStrategy', () => {
    let strategy: ExpenseCommentStrategy;
    let mockFirestoreReader: MockFirestoreReader;
    let mockGroupMemberService: ReturnType<typeof createMockGroupMemberService>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockFirestoreReader = new MockFirestoreReader();
        mockGroupMemberService = createMockGroupMemberService();
        strategy = new ExpenseCommentStrategy(mockFirestoreReader, mockGroupMemberService as any);
    });

    describe('verifyAccess', () => {
        it('should allow access when expense exists and user is group member', async () => {
            const testExpense = new FirestoreExpenseBuilder().withId('test-expense').withGroupId('test-group').build();

            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();

            mockFirestoreReader.getExpense.mockResolvedValue(testExpense);
            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(true);

            await expect(strategy.verifyAccess('test-expense', 'user-id')).resolves.not.toThrow();

            expect(mockFirestoreReader.getExpense).toHaveBeenCalledWith('test-expense');
            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('test-group');
            expect(mockGroupMemberService.isGroupMemberAsync).toHaveBeenCalledWith('test-group', 'user-id');
        });

        it('should throw NOT_FOUND when expense does not exist', async () => {
            mockFirestoreReader.getExpense.mockResolvedValue(null);

            await expect(strategy.verifyAccess('nonexistent-expense', 'user-id')).rejects.toThrow(ApiError);

            const error = (await strategy.verifyAccess('nonexistent-expense', 'user-id').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe('EXPENSE_NOT_FOUND');
            expect(mockFirestoreReader.getExpense).toHaveBeenCalledWith('nonexistent-expense');
        });

        it('should throw NOT_FOUND when expense is soft deleted', async () => {
            const deletedExpense = {
                ...new FirestoreExpenseBuilder().withId('deleted-expense').withGroupId('test-group').build(),
                deletedAt: Timestamp.now(),
            };

            mockFirestoreReader.getExpense.mockResolvedValue(deletedExpense);

            await expect(strategy.verifyAccess('deleted-expense', 'user-id')).rejects.toThrow(ApiError);

            const error = (await strategy.verifyAccess('deleted-expense', 'user-id').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe('EXPENSE_NOT_FOUND');
        });

        it('should throw NOT_FOUND when expense group does not exist', async () => {
            const testExpense = new FirestoreExpenseBuilder().withId('test-expense').withGroupId('nonexistent-group').build();

            mockFirestoreReader.getExpense.mockResolvedValue(testExpense);
            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(strategy.verifyAccess('test-expense', 'user-id')).rejects.toThrow(ApiError);

            const error = (await strategy.verifyAccess('test-expense', 'user-id').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe('GROUP_NOT_FOUND');
            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('nonexistent-group');
        });

        it('should throw FORBIDDEN when user is not a member of expense group', async () => {
            const testExpense = new FirestoreExpenseBuilder().withId('test-expense').withGroupId('test-group').build();

            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();

            mockFirestoreReader.getExpense.mockResolvedValue(testExpense);
            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(false);

            await expect(strategy.verifyAccess('test-expense', 'unauthorized-user')).rejects.toThrow(ApiError);

            const error = (await strategy.verifyAccess('test-expense', 'unauthorized-user').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
            expect(error.code).toBe('ACCESS_DENIED');
        });
    });

    describe('resolveGroupId', () => {
        it('should return the expense groupId', async () => {
            const testExpense = new FirestoreExpenseBuilder().withId('test-expense').withGroupId('resolved-group-123').build();

            mockFirestoreReader.getExpense.mockResolvedValue(testExpense);

            const result = await strategy.resolveGroupId('test-expense');

            expect(result).toBe('resolved-group-123');
            expect(mockFirestoreReader.getExpense).toHaveBeenCalledWith('test-expense');
        });

        it('should throw NOT_FOUND when expense does not exist', async () => {
            mockFirestoreReader.getExpense.mockResolvedValue(null);

            await expect(strategy.resolveGroupId('nonexistent-expense')).rejects.toThrow(ApiError);

            const error = (await strategy.resolveGroupId('nonexistent-expense').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe('EXPENSE_NOT_FOUND');
        });

        it('should throw NOT_FOUND when expense is soft deleted', async () => {
            const deletedExpense = {
                ...new FirestoreExpenseBuilder().withId('deleted-expense').withGroupId('test-group').build(),
                deletedAt: Timestamp.now(),
            };

            mockFirestoreReader.getExpense.mockResolvedValue(deletedExpense);

            await expect(strategy.resolveGroupId('deleted-expense')).rejects.toThrow(ApiError);

            const error = (await strategy.resolveGroupId('deleted-expense').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe('EXPENSE_NOT_FOUND');
        });
    });

    describe('getCollectionPath', () => {
        it('should generate correct Firestore collection path for expense comments', () => {
            const expenseId = 'expense-456';

            const path = strategy.getCollectionPath(expenseId);

            expect(path).toBe(`${FirestoreCollections.EXPENSES}/${expenseId}/${FirestoreCollections.COMMENTS}`);
            expect(path).toBe(`expenses/${expenseId}/comments`);
        });

        it('should handle different expense IDs correctly', () => {
            const expenseIds = ['expense-1', 'expense-abc', 'expense-with-special-chars'];

            expenseIds.forEach((expenseId) => {
                const path = strategy.getCollectionPath(expenseId);
                expect(path).toBe(`expenses/${expenseId}/comments`);
            });
        });
    });
});
