import { CommentTargetType, CommentTargetTypes } from '@splitifyd/shared';
import type { IFirestoreReader } from '../firestore';
import { GroupMemberService } from '../GroupMemberService';
import { ExpenseCommentStrategy } from './ExpenseCommentStrategy';
import { GroupCommentStrategy } from './GroupCommentStrategy';
import { ICommentStrategy } from './ICommentStrategy';

/**
 * Factory for creating comment strategies based on target type
 *
 * This factory eliminates the need for type-dispatching conditionals by providing
 * the appropriate strategy implementation for each comment target type.
 */
export class CommentStrategyFactory {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly groupMemberService: GroupMemberService,
    ) {}

    /**
     * Get the appropriate comment strategy for the given target type
     *
     * @param targetType - The type of entity being commented on
     * @returns Strategy implementation for the target type
     * @throws Error if target type is not supported
     */
    getStrategy(targetType: CommentTargetType): ICommentStrategy {
        switch (targetType) {
            case CommentTargetTypes.GROUP:
                return new GroupCommentStrategy(this.firestoreReader, this.groupMemberService);

            case CommentTargetTypes.EXPENSE:
                return new ExpenseCommentStrategy(this.firestoreReader, this.groupMemberService);

            default:
                throw new Error(`Unsupported comment target type: ${targetType}`);
        }
    }
}
