import { ICommentStrategy } from './ICommentStrategy';
import { ApiError } from '../../utils/errors';
import { HTTP_STATUS } from '../../constants';
import { FirestoreCollections } from '@splitifyd/shared';
import type { IFirestoreReader } from '../firestore';
import { GroupMemberService } from '../GroupMemberService';

/**
 * Strategy for handling comments on expense entities
 *
 * Expenses are commentable entities where:
 * - Access verification requires the expense to exist and user to be in the expense's group
 * - Group ID is resolved from the expense's groupId field
 * - Comments are stored in the expense's comments subcollection
 */
export class ExpenseCommentStrategy implements ICommentStrategy {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly groupMemberService: GroupMemberService,
    ) {}

    async verifyAccess(targetId: string, userId: string): Promise<void> {
        // Get the expense and verify it exists and is not deleted
        const expense = await this.firestoreReader.getExpense(targetId);
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

    async resolveGroupId(targetId: string): Promise<string> {
        // For expense comments, resolve the group ID from the expense
        const expense = await this.firestoreReader.getExpense(targetId);
        if (!expense || expense.deletedAt) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'EXPENSE_NOT_FOUND', 'Expense not found');
        }
        return expense.groupId;
    }

    getCollectionPath(targetId: string): string {
        return `${FirestoreCollections.EXPENSES}/${targetId}/${FirestoreCollections.COMMENTS}`;
    }
}
