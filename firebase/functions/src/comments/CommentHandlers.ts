import { CommentDTO } from '@billsplit-wl/shared';
import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { HTTP_STATUS } from '../constants';
import { Errors } from '../errors';
import { logger } from '../logger';
import { CommentService } from '../services/CommentService';
import { validateCommentId, validateCreateExpenseComment, validateCreateGroupComment, validateExpenseId, validateGroupId, validateListCommentsQuery } from './validation';

export class CommentHandlers {
    constructor(private readonly commentService: CommentService) {
    }

    /**
     * Create a new comment
     */
    createComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = validateUserAuth(req);

            // Extract target type and ID from route parameters
            const routeTargetsGroup = req.path.includes('/groups/');
            const targetId = routeTargetsGroup ? req.params.groupId : req.params.expenseId;

            if (!targetId) {
                throw Errors.validationError('targetId', 'INVALID_TARGET_ID');
            }

            let comment: CommentDTO;
            if (routeTargetsGroup) {
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
            const groupId = validateGroupId(req.params.groupId);
            const { cursor, limit } = validateListCommentsQuery(req.query);

            const comments = await this.commentService.listGroupComments(
                groupId,
                userId,
                {
                    cursor,
                    limit,
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
            const expenseId = validateExpenseId(req.params.expenseId);
            const { cursor, limit } = validateListCommentsQuery(req.query);

            const comments = await this.commentService.listExpenseComments(
                expenseId,
                userId,
                {
                    cursor,
                    limit,
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

    /**
     * Delete a group comment
     */
    deleteGroupComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = validateUserAuth(req);
            const groupId = validateGroupId(req.params.groupId);
            const commentId = validateCommentId(req.params.commentId);

            await this.commentService.deleteGroupComment(groupId, commentId, userId);

            res.status(HTTP_STATUS.NO_CONTENT).send();
        } catch (error) {
            logger.error('Failed to delete group comment', error, {
                userId: req.user?.uid,
                groupId: req.params.groupId,
                commentId: req.params.commentId,
            });
            throw error;
        }
    };

    /**
     * Delete an expense comment
     */
    deleteExpenseComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = validateUserAuth(req);
            const expenseId = validateExpenseId(req.params.expenseId);
            const commentId = validateCommentId(req.params.commentId);

            await this.commentService.deleteExpenseComment(expenseId, commentId, userId);

            res.status(HTTP_STATUS.NO_CONTENT).send();
        } catch (error) {
            logger.error('Failed to delete expense comment', error, {
                userId: req.user?.uid,
                expenseId: req.params.expenseId,
                commentId: req.params.commentId,
            });
            throw error;
        }
    };
}
