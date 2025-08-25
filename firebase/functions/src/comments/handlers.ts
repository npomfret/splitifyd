import { Response } from 'express';
import * as admin from 'firebase-admin';
import { AuthenticatedRequest } from '../auth/middleware';
import { firestoreDb } from '../firebase';
import { validateUserAuth } from '../auth/utils';
import { Errors, ApiError } from '../utils/errors';
import { createServerTimestamp, timestampToISO } from '../utils/dateHelpers';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { validateCreateComment, validateListCommentsQuery } from './validation';
import { 
    FirestoreCollections, 
    CommentTargetTypes, 
    CommentTargetType,
    Comment,
    CommentApiResponse,
    CreateCommentResponse,
    ListCommentsResponse,
    ListCommentsApiResponse
} from '../shared/shared-types';
import { isGroupMember } from '../utils/groupHelpers';
import { transformGroupDocument } from '../groups/handlers';

/**
 * Type for comment data before it's saved to Firestore (without id)
 */
type CommentCreateData = Omit<Comment, 'id' | 'authorAvatar'> & {
    authorAvatar: string | null; // Firestore doesn't allow undefined, so we use null
};

/**
 * Get reference to comments subcollection based on target type
 */
const getCommentsCollection = (targetType: CommentTargetType, targetId: string, groupId?: string) => {
    if (targetType === CommentTargetTypes.GROUP) {
        return firestoreDb
            .collection(FirestoreCollections.GROUPS)
            .doc(targetId)
            .collection(FirestoreCollections.COMMENTS);
    } else if (targetType === CommentTargetTypes.EXPENSE) {
        return firestoreDb
            .collection(FirestoreCollections.EXPENSES)
            .doc(targetId)
            .collection(FirestoreCollections.COMMENTS);
    } else {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_TARGET_TYPE', 'Invalid target type');
    }
};

/**
 * Get reference to groups collection
 */
const getGroupsCollection = () => {
    return firestoreDb.collection(FirestoreCollections.GROUPS);
};

/**
 * Get reference to expenses collection
 */
const getExpensesCollection = () => {
    return firestoreDb.collection(FirestoreCollections.EXPENSES);
};

/**
 * Verify user has access to comment on the target entity
 */
const verifyCommentAccess = async (
    targetType: CommentTargetType, 
    targetId: string, 
    userId: string,
    groupId?: string
): Promise<void> => {
    if (targetType === CommentTargetTypes.GROUP) {
        // For group comments, verify user is a group member
        const groupDoc = await getGroupsCollection().doc(targetId).get();
        if (!groupDoc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = transformGroupDocument(groupDoc);
        if (!isGroupMember(group, userId)) {
            throw Errors.FORBIDDEN();
        }
    } else if (targetType === CommentTargetTypes.EXPENSE) {
        // For expense comments, verify expense exists and user is in the group
        if (!groupId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required for expense comments');
        }

        const expenseDoc = await getExpensesCollection().doc(targetId).get();
        if (!expenseDoc.exists) {
            throw Errors.NOT_FOUND('Expense');
        }

        const expense = expenseDoc.data();
        if (!expense || expense.deletedAt) {
            throw Errors.NOT_FOUND('Expense');
        }

        // Verify user is a member of the group that the expense belongs to
        const groupDoc = await getGroupsCollection().doc(groupId).get();
        if (!groupDoc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = transformGroupDocument(groupDoc);
        if (!isGroupMember(group, userId)) {
            throw Errors.FORBIDDEN();
        }

        // Verify the expense actually belongs to this group
        if (expense.groupId !== groupId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'EXPENSE_GROUP_MISMATCH', 'Expense does not belong to the specified group');
        }
    }
};

/**
 * Transform Firestore comment document to Comment interface
 */
const transformCommentDocument = (doc: admin.firestore.DocumentSnapshot): Comment => {
    const data = doc.data();
    if (!data) {
        throw new Error('Comment document has no data');
    }

    return {
        id: doc.id,
        authorId: data.authorId,
        authorName: data.authorName,
        authorAvatar: data.authorAvatar,
        text: data.text,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};

/**
 * Create a new comment
 */
export const createComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        validateUserAuth(req);
        
        // Extract target type and ID from route parameters
        const targetType: CommentTargetType = req.path.includes('/groups/') ? CommentTargetTypes.GROUP : CommentTargetTypes.EXPENSE;
        const targetId = targetType === CommentTargetTypes.GROUP ? req.params.groupId : req.params.expenseId;
        
        if (!targetId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_TARGET_ID', 'Target ID is required');
        }

        // For expense comments, we need to get the groupId from the expense
        let groupId: string | undefined;
        if (targetType === CommentTargetTypes.EXPENSE) {
            const expenseDoc = await getExpensesCollection().doc(targetId).get();
            if (!expenseDoc.exists) {
                throw Errors.NOT_FOUND('Expense');
            }
            const expense = expenseDoc.data();
            if (!expense || expense.deletedAt) {
                throw Errors.NOT_FOUND('Expense');
            }
            groupId = expense.groupId;
        }

        // Validate request body
        const validatedRequest = validateCreateComment({
            ...req.body,
            targetType,
            targetId,
            groupId,
        });

        // Verify user has access to comment on this target
        await verifyCommentAccess(targetType, targetId, req.user!.uid, groupId);

        // Get user display name for the comment
        const userRecord = await admin.auth().getUser(req.user!.uid);
        const authorName = userRecord.displayName || userRecord.email?.split('@')[0] || 'Anonymous';

        // Prepare comment data
        const now = createServerTimestamp();
        const commentData: CommentCreateData = {
            authorId: req.user!.uid,
            authorName,
            authorAvatar: userRecord.photoURL || null,
            text: validatedRequest.text,
            createdAt: now,
            updatedAt: now,
        };

        // Create the comment document
        const commentsCollection = getCommentsCollection(targetType, targetId, groupId);
        const commentDocRef = await commentsCollection.add(commentData);

        // Fetch the created comment to return it
        const createdCommentDoc = await commentDocRef.get();
        const createdComment = transformCommentDocument(createdCommentDoc);

        // Convert timestamps to ISO strings for the API response
        const responseData: CommentApiResponse = {
            ...createdComment,
            createdAt: timestampToISO(createdComment.createdAt as admin.firestore.Timestamp),
            updatedAt: timestampToISO(createdComment.updatedAt as admin.firestore.Timestamp),
        };

        const response: CreateCommentResponse = {
            success: true,
            data: responseData,
        };

        logger.info('Comment created successfully', {
            commentId: createdComment.id,
            targetType,
            targetId,
            authorId: req.user!.uid,
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
        validateUserAuth(req);

        // Extract target type and ID from route parameters
        const targetType: CommentTargetType = req.path.includes('/groups/') ? CommentTargetTypes.GROUP : CommentTargetTypes.EXPENSE;
        const targetId = targetType === CommentTargetTypes.GROUP ? req.params.groupId : req.params.expenseId;
        
        if (!targetId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_TARGET_ID', 'Target ID is required');
        }

        // Validate query parameters
        const { cursor, limit } = validateListCommentsQuery(req.query);

        // For expense comments, we need the group ID to verify access
        let groupId: string | undefined;
        if (targetType === CommentTargetTypes.EXPENSE) {
            const expenseDoc = await getExpensesCollection().doc(targetId).get();
            if (!expenseDoc.exists) {
                throw Errors.NOT_FOUND('Expense');
            }
            const expense = expenseDoc.data();
            if (!expense || expense.deletedAt) {
                throw Errors.NOT_FOUND('Expense');
            }
            groupId = expense.groupId;
        }

        // Verify user has access to view comments on this target
        await verifyCommentAccess(targetType, targetId, req.user!.uid, groupId);

        // Build the query
        const commentsCollection = getCommentsCollection(targetType, targetId, groupId);
        let query: admin.firestore.Query = commentsCollection
            .orderBy('createdAt', 'desc')
            .limit(limit + 1); // Fetch one extra to check if there are more

        // Apply cursor-based pagination if provided
        if (cursor) {
            try {
                const cursorDoc = await commentsCollection.doc(cursor).get();
                if (cursorDoc.exists) {
                    query = query.startAfter(cursorDoc);
                }
            } catch (error) {
                logger.info('Invalid cursor provided', { cursor, error: error });
                // Continue without cursor if it's invalid
            }
        }

        // Execute the query
        const snapshot = await query.get();
        const docs = snapshot.docs;

        // Determine if there are more comments
        const hasMore = docs.length > limit;
        const commentsToReturn = hasMore ? docs.slice(0, limit) : docs;

        // Transform documents to Comment API response objects
        const comments: CommentApiResponse[] = commentsToReturn.map(doc => {
            const comment = transformCommentDocument(doc);
            return {
                ...comment,
                createdAt: timestampToISO(comment.createdAt as admin.firestore.Timestamp),
                updatedAt: timestampToISO(comment.updatedAt as admin.firestore.Timestamp),
            };
        });

        // Prepare response
        const responseData: ListCommentsResponse = {
            comments,
            hasMore,
            nextCursor: hasMore && commentsToReturn.length > 0 ? commentsToReturn[commentsToReturn.length - 1].id : undefined,
        };

        const response: ListCommentsApiResponse = {
            success: true,
            data: responseData,
        };

        logger.info('Comments listed successfully', {
            targetType,
            targetId,
            count: comments.length,
            hasMore,
            userId: req.user!.uid,
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