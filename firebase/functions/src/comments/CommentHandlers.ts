import { CommentDTO, CommentTargetType, CommentTargetTypes } from '@splitifyd/shared';
import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { getIdentityToolkitConfig } from '../client-config';
import { HTTP_STATUS } from '../constants';
import { getAuth, getFirestore } from '../firebase';
import { logger } from '../logger';
import { ComponentBuilder } from '../services/ComponentBuilder';
import { CommentService } from '../services/CommentService';
import { ApiError } from '../utils/errors';
import { validateCreateExpenseComment, validateCreateGroupComment } from './validation';
import {toGroupId} from "@splitifyd/shared";

export class CommentHandlers {
    constructor(private readonly commentService: CommentService) {
    }

    static createCommentHandlers(applicationBuilder = ComponentBuilder.createApplicationBuilder(getFirestore(), getAuth(), getIdentityToolkitConfig())) {
        const commentService = applicationBuilder.buildCommentService();
        return new CommentHandlers(commentService);
    }

    /**
     * Create a new comment
     */
    createComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = validateUserAuth(req);

            // Extract target type and ID from route parameters
            const targetType: CommentTargetType = req.path.includes('/groups/') ? CommentTargetTypes.GROUP : CommentTargetTypes.EXPENSE;
            const targetId = targetType === CommentTargetTypes.GROUP ? req.params.groupId : req.params.expenseId;

            if (!targetId) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_TARGET_ID', 'Target ID is required');
            }

            let comment: CommentDTO;
            if (targetType === CommentTargetTypes.GROUP) {
                const validatedRequest = validateCreateGroupComment(targetId, req.body);
                comment = await this.commentService.createGroupComment(validatedRequest.groupId, validatedRequest, userId);
            } else {
                const validatedRequest = validateCreateExpenseComment(targetId, req.body);
                comment = await this.commentService.createExpenseComment(validatedRequest.expenseId, validatedRequest, userId);
            }
            res.status(HTTP_STATUS.OK).json(comment);
        } catch (error) {
            logger.error('Failed to create comment', error, {
                userId: req.user?.uid,
                path: req.path,
            });
            throw error;
        }
    };

    /**
     * List comments for a group
     */
    listGroupComments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = validateUserAuth(req);
            const groupId = toGroupId(req.params.groupId);

            if (!groupId) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_GROUP_ID', 'Group ID is required');
            }

            const { cursor, limit = 8 } = req.query;

            const comments = await this.commentService.listComments(
                CommentTargetTypes.GROUP,
                groupId,
                userId,
                {
                    cursor: cursor as string,
                    limit: parseInt(limit as string, 10) || 8,
                },
            );

            res.status(HTTP_STATUS.OK).json(comments);
        } catch (error) {
            logger.error('Failed to list group comments', error, {
                userId: req.user?.uid,
                groupId: req.params.groupId,
                query: req.query,
            });
            throw error;
        }
    };

    /**
     * List comments for an expense
     */
    listExpenseComments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = validateUserAuth(req);
            const expenseId = req.params.expenseId;

            if (!expenseId) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_EXPENSE_ID', 'Expense ID is required');
            }

            const { cursor, limit = 8 } = req.query;

            const comments = await this.commentService.listComments(
                CommentTargetTypes.EXPENSE,
                expenseId,
                userId,
                {
                    cursor: cursor as string,
                    limit: parseInt(limit as string, 10) || 8,
                },
            );

            res.status(HTTP_STATUS.OK).json(comments);
        } catch (error) {
            logger.error('Failed to list expense comments', error, {
                userId: req.user?.uid,
                expenseId: req.params.expenseId,
                query: req.query,
            });
            throw error;
        }
    };
}
