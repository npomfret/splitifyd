import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpenseCommentStrategy } from '../../../../services/comments/ExpenseCommentStrategy';
import { StubFirestoreReader } from '../../mocks/firestore-stubs';
import { ApiError } from '../../../../utils/errors';
import { HTTP_STATUS } from '../../../../constants';
import { ExpenseBuilder, FirestoreGroupBuilder } from '@splitifyd/test-support';
import { FirestoreCollections } from '@splitifyd/shared';
import { Timestamp } from 'firebase-admin/firestore';

const createStubGroupMemberService = () => ({
    isGroupMemberAsync: vi.fn(),
    getGroupMember: vi.fn(),
    getAllGroupMembers: vi.fn(),
});

describe('ExpenseCommentStrategy', () => {
    let strategy: ExpenseCommentStrategy;
    let stubFirestoreReader: StubFirestoreReader;
    let stubGroupMemberService: ReturnType<typeof createStubGroupMemberService>;

    beforeEach(() => {
        stubFirestoreReader = new StubFirestoreReader();
        stubGroupMemberService = createStubGroupMemberService();
        strategy = new ExpenseCommentStrategy(stubFirestoreReader, stubGroupMemberService as any);
    });

    describe('verifyAccess', () => {
        it('should allow access when expense exists and user is group member', async () => {
            const testExpense = new ExpenseBuilder().withId('test-expense').withGroupId('test-group').build();
            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();

            // Simple stub data setup
            stubFirestoreReader.setDocument('expenses', 'test-expense', testExpense);
            stubFirestoreReader.setDocument('groups', 'test-group', testGroup);
            stubGroupMemberService.isGroupMemberAsync.mockResolvedValue(true);

            await expect(strategy.verifyAccess('test-expense', 'user-id')).resolves.not.toThrow();
        });

        it('should throw NOT_FOUND when expense does not exist', async () => {
            // No need to set up anything - stub returns null by default for non-existent documents

            await expect(strategy.verifyAccess('nonexistent-expense', 'user-id')).rejects.toThrow(ApiError);

            const error = (await strategy.verifyAccess('nonexistent-expense', 'user-id').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe('EXPENSE_NOT_FOUND');
        });

        it('should throw NOT_FOUND when expense is soft deleted', async () => {
            const deletedExpense = {
                ...new ExpenseBuilder().withId('deleted-expense').withGroupId('test-group').build(),
                deletedAt: Timestamp.now(),
            };

            stubFirestoreReader.setDocument('expenses', 'test-expense',deletedExpense);

            await expect(strategy.verifyAccess('deleted-expense', 'user-id')).rejects.toThrow(ApiError);

            const error = (await strategy.verifyAccess('deleted-expense', 'user-id').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe('EXPENSE_NOT_FOUND');
        });

        it('should throw NOT_FOUND when expense group does not exist', async () => {
            const testExpense = new ExpenseBuilder().withId('test-expense').withGroupId('nonexistent-group').build();

            stubFirestoreReader.setDocument('expenses', 'test-expense',testExpense);
            // stubFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(strategy.verifyAccess('test-expense', 'user-id')).rejects.toThrow(ApiError);

            const error = (await strategy.verifyAccess('test-expense', 'user-id').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe('GROUP_NOT_FOUND');
            // expect(stubFirestoreReader.getGroup).toHaveBeenCalledWith('nonexistent-group');
        });

        it('should throw FORBIDDEN when user is not a member of expense group', async () => {
            const testExpense = new ExpenseBuilder().withId('test-expense').withGroupId('test-group').build();

            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();

            stubFirestoreReader.setDocument('expenses', 'test-expense', testExpense);
            stubFirestoreReader.setDocument('groups', 'test-group', testGroup);
            stubGroupMemberService.isGroupMemberAsync.mockResolvedValue(false);

            await expect(strategy.verifyAccess('test-expense', 'unauthorized-user')).rejects.toThrow(ApiError);

            const error = (await strategy.verifyAccess('test-expense', 'unauthorized-user').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
            expect(error.code).toBe('ACCESS_DENIED');
        });
    });

    describe('resolveGroupId', () => {
        it('should return the expense groupId', async () => {
            const testExpense = new ExpenseBuilder().withId('test-expense').withGroupId('resolved-group-123').build();

            stubFirestoreReader.setDocument('expenses', 'test-expense',testExpense);

            const result = await strategy.resolveGroupId('test-expense');

            expect(result).toBe('resolved-group-123');
            // expect(stubFirestoreReader.getExpense).toHaveBeenCalledWith('test-expense');
        });

        it('should throw NOT_FOUND when expense does not exist', async () => {
            stubFirestoreReader.setDocument('expenses', 'test-expense',null);

            await expect(strategy.resolveGroupId('nonexistent-expense')).rejects.toThrow(ApiError);

            const error = (await strategy.resolveGroupId('nonexistent-expense').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe('EXPENSE_NOT_FOUND');
        });

        it('should throw NOT_FOUND when expense is soft deleted', async () => {
            const deletedExpense = {
                ...new ExpenseBuilder().withId('deleted-expense').withGroupId('test-group').build(),
                deletedAt: Timestamp.now(),
            };

            stubFirestoreReader.setDocument('expenses', 'test-expense',deletedExpense);

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
