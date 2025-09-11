import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { ApiError } from '../utils/errors';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { validateCreateComment } from './validation';
import { CommentTargetTypes, CommentTargetType, CreateCommentResponse } from '@splitifyd/shared';
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
