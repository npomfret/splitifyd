import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { ApiError } from '../utils/errors';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { validateCreateComment, validateListCommentsQuery } from './validation';
import { CommentTargetTypes, CommentTargetType, CreateCommentResponse, ListCommentsApiResponse } from '@splitifyd/shared';
import { getCommentService } from '../services/serviceRegistration';

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

        const responseData = await getCommentService().createComment(targetType, targetId, validatedRequest, userId);

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
 * List comments for a target (group or expense)
 */
export const listComments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = validateUserAuth(req);

        // Extract target type and ID from route parameters
        const targetType: CommentTargetType = req.path.includes('/groups/') ? CommentTargetTypes.GROUP : CommentTargetTypes.EXPENSE;
        const targetId = targetType === CommentTargetTypes.GROUP ? req.params.groupId : req.params.expenseId;

        if (!targetId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_TARGET_ID', 'Target ID is required');
        }

        // Validate query parameters
        const { cursor, limit } = validateListCommentsQuery(req.query);

        const responseData = await getCommentService().listComments(targetType, targetId, userId, {
            limit,
            cursor,
        });

        const response: ListCommentsApiResponse = {
            success: true,
            data: responseData,
        };

        logger.info('Comments listed successfully', {
            targetType,
            targetId,
            count: responseData.comments.length,
            hasMore: responseData.hasMore,
            userId,
        });

        res.json(response);
    } catch (error) {
        logger.error('Failed to list comments', error, {
            userId: req.user?.uid,
            path: req.path,
            query: req.query,
        });
        throw error;
    }
};
