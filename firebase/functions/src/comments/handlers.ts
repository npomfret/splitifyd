import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { ApiError } from '../utils/errors';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { validateCreateComment } from './validation';
import { CommentTargetTypes, CommentTargetType, CreateCommentResponse, ListCommentsResponse } from '@splitifyd/shared';
import { getAppBuilder } from '../index';

/**
 * Create a new comment
 */
export const createComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = validateUserAuth(req);

        // Extract target type and ID from route parameters
        const targetType: CommentTargetType = req.path.includes('/groups/') ? CommentTargetTypes.GROUP : CommentTargetTypes.EXPENSE;
        const targetId = targetType === CommentTargetTypes.GROUP ? req.params.groupId : req.params.expenseId;

        if (!targetId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_TARGET_ID', 'Target ID is required');
        }

        // Validate request body
        const validatedRequest = validateCreateComment({
            ...req.body,
            targetType,
            targetId,
        });

        const responseData = await getAppBuilder().buildCommentService().createComment(targetType, targetId, validatedRequest, userId);

        const response: CreateCommentResponse = {
            success: true,
            data: responseData,
        };

        logger.info('Comment created successfully', {
            commentId: responseData.id,
            targetType,
            targetId,
            authorId: userId,
        });

        res.json(response);
    } catch (error) {
        logger.error('Failed to create comment', error, {
            userId: req.user?.uid,
            path: req.path,
            body: req.body,
        });
        throw error;
    }
};

/**
 * List comments for a group
 */
export const listGroupComments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = validateUserAuth(req);
        const groupId = req.params.groupId;

        if (!groupId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_GROUP_ID', 'Group ID is required');
        }

        const { cursor, limit = 20 } = req.query;

        const responseData = await getAppBuilder().buildCommentService().listComments(
            CommentTargetTypes.GROUP,
            groupId,
            userId,
            {
                cursor: cursor as string,
                limit: parseInt(limit as string, 10) || 20,
            }
        );

        const response: { success: boolean; data: ListCommentsResponse } = {
            success: true,
            data: responseData,
        };

        logger.info('Group comments retrieved successfully', {
            groupId,
            userId,
            commentCount: responseData.comments.length,
            hasMore: responseData.hasMore,
        });

        res.json(response);
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
export const listExpenseComments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = validateUserAuth(req);
        const expenseId = req.params.expenseId;

        if (!expenseId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_EXPENSE_ID', 'Expense ID is required');
        }

        const { cursor, limit = 20 } = req.query;

        const responseData = await getAppBuilder().buildCommentService().listComments(
            CommentTargetTypes.EXPENSE,
            expenseId,
            userId,
            {
                cursor: cursor as string,
                limit: parseInt(limit as string, 10) || 20,
            }
        );

        const response: { success: boolean; data: ListCommentsResponse } = {
            success: true,
            data: responseData,
        };

        logger.info('Expense comments retrieved successfully', {
            expenseId,
            userId,
            commentCount: responseData.comments.length,
            hasMore: responseData.hasMore,
        });

        res.json(response);
    } catch (error) {
        logger.error('Failed to list expense comments', error, {
            userId: req.user?.uid,
            expenseId: req.params.expenseId,
            query: req.query,
        });
        throw error;
    }
};
