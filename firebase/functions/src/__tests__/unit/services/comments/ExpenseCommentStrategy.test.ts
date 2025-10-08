import { ExpenseDTOBuilder, GroupDTOBuilder } from '@splitifyd/test-support';
import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../../../constants';
import { ExpenseCommentStrategy } from '../../../../services/comments/ExpenseCommentStrategy';
import { ApiError } from '../../../../utils/errors';
import { StubFirestoreReader } from '../../mocks/firestore-stubs';

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
            const testExpense = new ExpenseDTOBuilder()
                .withId('test-expense')
                .withGroupId('test-group')
                .build();
            const testGroup = new GroupDTOBuilder()
                .withId('test-group')
                .build();

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
                ...new ExpenseDTOBuilder()
                    .withId('deleted-expense')
                    .withGroupId('test-group')
                    .build(),
                deletedAt: Timestamp.now(),
            };

            stubFirestoreReader.setDocument('expenses', 'test-expense', deletedExpense);

            await expect(strategy.verifyAccess('deleted-expense', 'user-id')).rejects.toThrow(ApiError);

            const error = (await strategy.verifyAccess('deleted-expense', 'user-id').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe('EXPENSE_NOT_FOUND');
        });

        it('should throw NOT_FOUND when expense group does not exist', async () => {
            const testExpense = new ExpenseDTOBuilder()
                .withId('test-expense')
                .withGroupId('nonexistent-group')
                .build();

            stubFirestoreReader.setDocument('expenses', 'test-expense', testExpense);
            // stubFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(strategy.verifyAccess('test-expense', 'user-id')).rejects.toThrow(ApiError);

            const error = (await strategy.verifyAccess('test-expense', 'user-id').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe('GROUP_NOT_FOUND');
            // expect(stubFirestoreReader.getGroup).toHaveBeenCalledWith('nonexistent-group');
        });

        it('should throw FORBIDDEN when user is not a member of expense group', async () => {
            const testExpense = new ExpenseDTOBuilder()
                .withId('test-expense')
                .withGroupId('test-group')
                .build();

            const testGroup = new GroupDTOBuilder()
                .withId('test-group')
                .build();

            stubFirestoreReader.setDocument('expenses', 'test-expense', testExpense);
            stubFirestoreReader.setDocument('groups', 'test-group', testGroup);
            stubGroupMemberService.isGroupMemberAsync.mockResolvedValue(false);

            await expect(strategy.verifyAccess('test-expense', 'unauthorized-user')).rejects.toThrow(ApiError);

            const error = (await strategy.verifyAccess('test-expense', 'unauthorized-user').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
            expect(error.code).toBe('ACCESS_DENIED');
        });
    });
});
