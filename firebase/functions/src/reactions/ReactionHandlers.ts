import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import type { ReactionService } from '../services/ReactionService';
import {
    validateToggleExpenseCommentReaction,
    validateToggleExpenseReaction,
    validateToggleGroupCommentReaction,
    validateToggleSettlementReaction,
} from './validation';

export class ReactionHandlers {
    constructor(private readonly reactionService: ReactionService) {}

    /**
     * Toggle a reaction on an expense
     * POST /expenses/:expenseId/reactions
     */
    toggleExpenseReaction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = validateUserAuth(req);
            const { expenseId, emoji } = validateToggleExpenseReaction(req.params.expenseId, req.body);

            const result = await this.reactionService.toggleExpenseReaction(expenseId, emoji, userId);
            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            logger.error('Failed to toggle expense reaction', error, {
                userId: req.user?.uid,
                expenseId: req.params.expenseId,
            });
            throw error;
        }
    };

    /**
     * Toggle a reaction on a group comment
     * POST /groups/:groupId/comments/:commentId/reactions
     */
    toggleGroupCommentReaction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = validateUserAuth(req);
            const { groupId, commentId, emoji } = validateToggleGroupCommentReaction(
                req.params.groupId,
                req.params.commentId,
                req.body,
            );

            const result = await this.reactionService.toggleGroupCommentReaction(groupId, commentId, emoji, userId);
            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            logger.error('Failed to toggle group comment reaction', error, {
                userId: req.user?.uid,
                groupId: req.params.groupId,
                commentId: req.params.commentId,
            });
            throw error;
        }
    };

    /**
     * Toggle a reaction on an expense comment
     * POST /expenses/:expenseId/comments/:commentId/reactions
     */
    toggleExpenseCommentReaction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = validateUserAuth(req);
            const { expenseId, commentId, emoji } = validateToggleExpenseCommentReaction(
                req.params.expenseId,
                req.params.commentId,
                req.body,
            );

            const result = await this.reactionService.toggleExpenseCommentReaction(expenseId, commentId, emoji, userId);
            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            logger.error('Failed to toggle expense comment reaction', error, {
                userId: req.user?.uid,
                expenseId: req.params.expenseId,
                commentId: req.params.commentId,
            });
            throw error;
        }
    };

    /**
     * Toggle a reaction on a settlement
     * POST /settlements/:settlementId/reactions
     */
    toggleSettlementReaction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = validateUserAuth(req);
            const { settlementId, emoji } = validateToggleSettlementReaction(req.params.settlementId, req.body);

            const result = await this.reactionService.toggleSettlementReaction(settlementId, emoji, userId);
            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            logger.error('Failed to toggle settlement reaction', error, {
                userId: req.user?.uid,
                settlementId: req.params.settlementId,
            });
            throw error;
        }
    };
}
