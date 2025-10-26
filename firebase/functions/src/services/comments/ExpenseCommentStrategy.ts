import { HTTP_STATUS } from '../../constants';
import { ApiError } from '../../utils/errors';
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
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'EXPENSE_NOT_FOUND', 'Expense not found');
        }

        // Verify the group exists
        const group = await this.firestoreReader.getGroup(expense.groupId);
        if (!group) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        // Verify user is a member of the group that the expense belongs to
        if (!(await this.groupMemberService.isGroupMemberAsync(group.id, userId))) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'ACCESS_DENIED', 'User is not a member of this group');
        }
    }
}
import type {ExpenseId, UserId} from '@splitifyd/shared';
