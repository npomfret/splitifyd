import { CommentTargetType, CommentTargetTypes } from '@splitifyd/shared';
import { ICommentStrategy } from './ICommentStrategy';
import { GroupCommentStrategy } from './GroupCommentStrategy';
import { ExpenseCommentStrategy } from './ExpenseCommentStrategy';
import type { IFirestoreReader } from '../firestore/IFirestoreReader';
import { GroupMemberService } from '../GroupMemberService';

/**
 * Factory for creating comment strategies based on target type
 * 
 * This factory eliminates the need for type-dispatching conditionals by providing
 * the appropriate strategy implementation for each comment target type.
 */
export class CommentStrategyFactory {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly groupMemberService: GroupMemberService
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

    /**
     * Static factory method for one-off strategy creation
     * 
     * @param targetType - The type of entity being commented on
     * @param firestoreReader - Firestore reader dependency
     * @param groupMemberService - Group member service dependency
     * @returns Strategy implementation for the target type
     */
    static createStrategy(
        targetType: CommentTargetType,
        firestoreReader: IFirestoreReader,
        groupMemberService: GroupMemberService
    ): ICommentStrategy {
        const factory = new CommentStrategyFactory(firestoreReader, groupMemberService);
        return factory.getStrategy(targetType);
    }
}