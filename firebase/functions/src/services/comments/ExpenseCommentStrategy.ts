import type { ExpenseId, UserId } from '@billsplit-wl/shared';
import { ErrorDetail, Errors } from '../../errors';
import type { IFirestoreReader } from '../firestore';
import { GroupMemberService } from '../GroupMemberService';
import { ICommentStrategy } from './ICommentStrategy';

/**
 * Strategy for handling comments on expense entities
 *
 * Expenses are commentable entities where:
 * - Access verification requires the expense to exist and user to be in the expense's group
 * - Group ID is resolved from the expense's groupId field
 * - Comments are stored in the expense's comments subcollection
 */
export class ExpenseCommentStrategy implements ICommentStrategy<ExpenseId> {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly groupMemberService: GroupMemberService,
    ) {}

    async verifyAccess(expenseId: ExpenseId, userId: UserId): Promise<void> {
        // Get the expense and verify it exists and is not deleted
        const expense = await this.firestoreReader.getExpense(expenseId);
        if (!expense || expense.deletedAt) {
            throw Errors.notFound('Expense', ErrorDetail.EXPENSE_NOT_FOUND);
        }

        // Verify the group exists
        const group = await this.firestoreReader.getGroup(expense.groupId);
        if (!group) {
            throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
        }

        // Verify user is a member of the group that the expense belongs to
        if (!(await this.groupMemberService.isGroupMemberAsync(group.id, userId))) {
            throw Errors.forbidden(ErrorDetail.NOT_GROUP_MEMBER);
        }
    }
}
