import { Response } from 'express';
import * as admin from 'firebase-admin';
import { AuthenticatedRequest } from '../auth/middleware';
import { db } from '../firebase';
import { validateUserAuth } from '../auth/utils';
import { Errors, ApiError } from '../utils/errors';
import { createServerTimestamp, parseISOToTimestamp, timestampToISO } from '../utils/dateHelpers';
import { logger, LoggerContext } from '../logger';
import { HTTP_STATUS } from '../constants';
import { validateCreateExpense, validateUpdateExpense, validateExpenseId, calculateSplits, Expense } from './validation';
import { FirestoreCollections, DELETED_AT_FIELD, SplitTypes } from '../shared/shared-types';
import { getUpdatedAtTimestamp, updateWithTimestamp } from '../utils/optimistic-locking';
import { _getGroupMembersData } from '../groups/memberHandlers';
import { isGroupOwner as checkIsGroupOwner } from '../utils/groupHelpers';
import { transformGroupDocument } from '../groups/handlers';

const getExpensesCollection = () => {
    return db.collection(FirestoreCollections.EXPENSES);
};

const getGroupsCollection = () => {
    return db.collection(FirestoreCollections.GROUPS);
};

const isGroupOwner = async (groupId: string, userId: string): Promise<boolean> => {
    const groupDoc = await getGroupsCollection().doc(groupId).get();
    if (!groupDoc.exists) {
        return false;
    }
    
    // Use the proper group document transformation from groups/handlers
    const group = transformGroupDocument(groupDoc);
    
    // Use the proper group ownership logic from utils/groupHelpers
    return checkIsGroupOwner(group, userId);
};

const verifyGroupMembership = async (groupId: string, userId: string): Promise<void> => {
    const groupDoc = await getGroupsCollection().doc(groupId).get();

    if (!groupDoc.exists) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
    }

    const groupData = groupDoc.data();

    // Check if this is a group document (has data.members)
    if (!groupData || !groupData.data || !groupData.data.name) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
    }

    // Check if user is a member (including owner)
    if (userId in groupData.data.members) {
        return;
    }

    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_GROUP_MEMBER', 'You are not a member of this group');
};

const fetchExpense = async (expenseId: string, userId: string): Promise<{ docRef: admin.firestore.DocumentReference; expense: Expense }> => {
    const docRef = getExpensesCollection().doc(expenseId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw Errors.NOT_FOUND('Expense');
    }

    const expense = doc.data() as Expense;

    // Check if the expense is soft-deleted
    if (expense.deletedAt) {
        throw Errors.NOT_FOUND('Expense');
    }

    // Single authorization check: fetch group once and verify access
    const groupDoc = await getGroupsCollection().doc(expense.groupId).get();

    if (!groupDoc.exists) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
    }

    const groupData = groupDoc.data();

    // Check if this is a group document (has data.name)
    if (!groupData || !groupData.data || !groupData.data.name) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
    }

    // Check if user is group owner (creator)
    const group = { id: expense.groupId, ...groupData.data };
    if (checkIsGroupOwner(group, userId)) {
        return { docRef, expense };
    }

    // Check if user is a participant in this expense
    if (!expense.participants || !expense.participants.includes(userId)) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_EXPENSE_PARTICIPANT', 'You are not a participant in this expense');
    }

    return { docRef, expense };
};

export const createExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);

    const expenseData = validateCreateExpense(req.body);

    await verifyGroupMembership(expenseData.groupId, userId);

    const groupDoc = await getGroupsCollection().doc(expenseData.groupId).get();
    const groupData = groupDoc.data();
    if (!groupData?.data?.members) {
        throw new Error(`Group ${expenseData.groupId} not found or missing member data`);
    }
    const memberIds = Object.keys(groupData.data.members);

    // Validate that paidBy is a group member
    if (!memberIds.includes(expenseData.paidBy)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PAYER', 'Payer must be a member of the group');
    }

    // Validate that all participants are group members
    for (const participantId of expenseData.participants) {
        if (!memberIds.includes(participantId)) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PARTICIPANT', `Participant ${participantId} is not a member of the group`);
        }
    }

    const now = createServerTimestamp();
    const docRef = getExpensesCollection().doc();

    const splits = calculateSplits(expenseData.amount, expenseData.splitType, expenseData.participants, expenseData.splits);

    const expense: Expense = {
        id: docRef.id,
        groupId: expenseData.groupId,
        createdBy: userId,
        paidBy: expenseData.paidBy,
        amount: expenseData.amount,
        currency: expenseData.currency,
        description: expenseData.description,
        category: expenseData.category,
        date: parseISOToTimestamp(expenseData.date) || createServerTimestamp(),
        splitType: expenseData.splitType,
        participants: expenseData.participants,
        splits,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        deletedBy: null,
    };

    // Only add receiptUrl if it's defined
    if (expenseData.receiptUrl !== undefined) {
        expense.receiptUrl = expenseData.receiptUrl;
    }

    try {
        // Use transaction to create expense and update group metadata atomically
        await db.runTransaction(async (transaction) => {
            const groupDocRef = getGroupsCollection().doc(expenseData.groupId);
            const groupDoc = await transaction.get(groupDocRef);

            if (!groupDoc.exists) {
                throw new Error(`Group ${expenseData.groupId} not found`);
            }

            const groupData = groupDoc.data();
            if (!groupData?.data) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_GROUP', 'Group data is missing');
            }

            // Create the expense
            transaction.set(docRef, expense);
        });

        // Set business context
        LoggerContext.setBusinessContext({ groupId: expenseData.groupId, expenseId: docRef.id });
        logger.info('expense-created', { id: docRef.id, groupId: expenseData.groupId });

        // Convert Firestore Timestamps to ISO strings for the response
        const responseExpense = {
            ...expense,
            date: timestampToISO(expense.date),
            createdAt: timestampToISO(expense.createdAt),
            updatedAt: timestampToISO(expense.updatedAt),
        };

        res.status(HTTP_STATUS.CREATED).json(responseExpense);
    } catch (error) {
        logger.error('Failed to create expense', error, {
            userId,
            groupId: expenseData.groupId,
        });
        throw error;
    }
};

export const getExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);

    const expenseId = validateExpenseId(req.query.id);

    const { expense } = await fetchExpense(expenseId, userId);

    res.json({
        id: expense.id,
        groupId: expense.groupId,
        createdBy: expense.createdBy,
        paidBy: expense.paidBy,
        amount: expense.amount,
        currency: expense.currency,
        description: expense.description,
        category: expense.category,
        date: timestampToISO(expense.date),
        splitType: expense.splitType,
        participants: expense.participants,
        splits: expense.splits,
        receiptUrl: expense.receiptUrl,
        createdAt: timestampToISO(expense.createdAt),
        updatedAt: timestampToISO(expense.updatedAt),
    });
};

export const updateExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);

    const expenseId = validateExpenseId(req.query.id);

    const updateData = validateUpdateExpense(req.body);

    const { docRef, expense } = await fetchExpense(expenseId, userId);

    // Check if user is either the expense creator or the group owner
    const isOwner = await isGroupOwner(expense.groupId, userId);
    if (expense.createdBy !== userId && !isOwner) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'Only the expense creator or group owner can edit this expense');
    }

    // If updating paidBy or participants, validate they are group members
    if (updateData.paidBy || updateData.participants) {
        const groupDoc = await getGroupsCollection().doc(expense.groupId).get();
        const groupData = groupDoc.data();
        if (!groupData?.data?.members) {
            throw new Error(`Group ${expense.groupId} not found or missing member data`);
        }
        const memberIds = Object.keys(groupData.data.members);

        // Validate paidBy if it's being updated
        if (updateData.paidBy && !memberIds.includes(updateData.paidBy)) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PAYER', 'Payer must be a member of the group');
        }

        // Validate participants if they're being updated
        if (updateData.participants) {
            for (const participantId of updateData.participants) {
                if (!memberIds.includes(participantId)) {
                    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PARTICIPANT', `Participant ${participantId} is not a member of the group`);
                }
            }
        }
    }

    // Type note: This is intentionally `any` because we're building a dynamic update object
    // that gets transformed before being passed to Firestore
    const updates: any = {
        ...updateData,
        updatedAt: createServerTimestamp(),
    };

    if (updateData.date) {
        updates.date = parseISOToTimestamp(updateData.date) || createServerTimestamp();
    }

    if (updateData.splitType || updateData.participants || updateData.splits || updateData.amount) {
        const amount = updateData.amount !== undefined ? updateData.amount : expense.amount;
        const splitType = updateData.splitType !== undefined ? updateData.splitType : expense.splitType;
        const participants = updateData.participants !== undefined ? updateData.participants : expense.participants;

        // If only amount is updated and splitType is 'exact', we need to recalculate as equal splits
        // since the old exact splits won't match the new amount
        let finalSplitType = splitType;
        let splits = updateData.splits !== undefined ? updateData.splits : expense.splits;

        if (updateData.amount && !updateData.splitType && !updateData.participants && !updateData.splits) {
            if (splitType === SplitTypes.EXACT) {
                // When only amount changes on exact splits, convert to equal splits
                finalSplitType = SplitTypes.EQUAL;
                splits = [];
            }
        }

        updates.splits = calculateSplits(amount, finalSplitType, participants, splits);
    }

    try {
        // Create a snapshot of the current expense state for history
        const historyEntry = {
            ...expense,
            modifiedAt: createServerTimestamp(),
            modifiedBy: userId,
            changeType: 'update' as const,
            changes: Object.keys(updateData),
        };

        // If date is being updated, we need to update group metadata too
        if (updateData.date) {
            await db.runTransaction(async (transaction) => {
                // IMPORTANT: All reads must happen before any writes in Firestore transactions

                // Step 1: Do ALL reads first
                const expenseDoc = await transaction.get(docRef);
                if (!expenseDoc.exists) {
                    throw Errors.NOT_FOUND('Expense');
                }
                const originalExpenseTimestamp = getUpdatedAtTimestamp(expenseDoc.data());

                const groupDocRef = getGroupsCollection().doc(expense.groupId);
                const groupDoc = await transaction.get(groupDocRef);

                if (!groupDoc.exists) {
                    throw new Error(`Group ${expense.groupId} not found`);
                }

                // Step 2: Check for concurrent updates inline (no additional reads needed)
                // We already have the document data, just verify the timestamp
                const currentTimestamp = expenseDoc.data()?.updatedAt;
                if (!currentTimestamp || !currentTimestamp.isEqual(originalExpenseTimestamp)) {
                    throw Errors.CONCURRENT_UPDATE();
                }

                // Step 3: Now do ALL writes
                const historyRef = docRef.collection('history').doc();
                transaction.set(historyRef, historyEntry);

                // Update the expense (updateWithTimestamp no longer does reads)
                await updateWithTimestamp(transaction, docRef, updates, originalExpenseTimestamp);

                // Note: Group metadata will be updated by the balance aggregation trigger
            });
        } else {
            // No date change, update expense with history in transaction
            await db.runTransaction(async (transaction) => {
                // IMPORTANT: All reads must happen before any writes in Firestore transactions

                // Step 1: Do ALL reads first
                const expenseDoc = await transaction.get(docRef);
                if (!expenseDoc.exists) {
                    throw Errors.NOT_FOUND('Expense');
                }
                const originalExpenseTimestamp = getUpdatedAtTimestamp(expenseDoc.data());

                // Step 2: Check for concurrent updates inline (no additional reads needed)
                // We already have the document data, just verify the timestamp
                const currentTimestamp = expenseDoc.data()?.updatedAt;
                if (!currentTimestamp || !currentTimestamp.isEqual(originalExpenseTimestamp)) {
                    throw Errors.CONCURRENT_UPDATE();
                }

                // Step 3: Now do ALL writes
                const historyRef = docRef.collection('history').doc();
                transaction.set(historyRef, historyEntry);

                // Update the expense (updateWithTimestamp no longer does reads)
                await updateWithTimestamp(transaction, docRef, updates, originalExpenseTimestamp);
            });
        }

        LoggerContext.setBusinessContext({ expenseId });
        logger.info('expense-updated', { id: expenseId });

        // Fetch the updated expense to return the full object
        const updatedExpenseDoc = await docRef.get();
        const updatedExpense = {
            id: updatedExpenseDoc.id,
            ...updatedExpenseDoc.data(),
        } as Expense;

        res.json({
            id: updatedExpense.id,
            groupId: updatedExpense.groupId,
            createdBy: updatedExpense.createdBy,
            paidBy: updatedExpense.paidBy,
            amount: updatedExpense.amount,
            currency: updatedExpense.currency,
            category: updatedExpense.category,
            description: updatedExpense.description,
            date: timestampToISO(updatedExpense.date),
            splitType: updatedExpense.splitType,
            participants: updatedExpense.participants,
            splits: updatedExpense.splits,
            receiptUrl: updatedExpense.receiptUrl || undefined,
            createdAt: timestampToISO(updatedExpense.createdAt),
            updatedAt: timestampToISO(updatedExpense.updatedAt),
        });
    } catch (error) {
        logger.error('Failed to update expense', {
            expenseId,
            userId,
            error: error instanceof Error ? error : new Error('Unknown error'),
            updates: Object.keys(updateData),
        });
        throw error;
    }
};

export const deleteExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);

    const expenseId = validateExpenseId(req.query.id);

    const { docRef, expense } = await fetchExpense(expenseId, userId);

    // Check if user is either the expense creator or the group owner
    const isOwner = await isGroupOwner(expense.groupId, userId);
    if (expense.createdBy !== userId && !isOwner) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'Only the expense creator or group owner can delete this expense');
    }

    try {
        // Use transaction to delete expense and update group metadata atomically
        await db.runTransaction(async (transaction) => {
            // IMPORTANT: All reads must happen before any writes in Firestore transactions

            // Step 1: Do ALL reads first
            const expenseDoc = await transaction.get(docRef);
            if (!expenseDoc.exists) {
                throw Errors.NOT_FOUND('Expense');
            }
            const originalExpenseTimestamp = getUpdatedAtTimestamp(expenseDoc.data());

            const groupDocRef = getGroupsCollection().doc(expense.groupId);
            const groupDoc = await transaction.get(groupDocRef);

            if (!groupDoc.exists) {
                throw new Error(`Group ${expense.groupId} not found`);
            }

            // Step 2: Check for concurrent updates inline (no additional reads needed)
            const currentTimestamp = expenseDoc.data()?.updatedAt;
            if (!currentTimestamp || !currentTimestamp.isEqual(originalExpenseTimestamp)) {
                throw Errors.CONCURRENT_UPDATE();
            }

            // Step 3: Now do ALL writes
            // Soft delete the expense (updateWithTimestamp no longer does reads)
            await updateWithTimestamp(
                transaction,
                docRef,
                {
                    [DELETED_AT_FIELD]: createServerTimestamp(),
                    deletedBy: userId,
                },
                originalExpenseTimestamp,
            );

            const groupData = groupDoc.data();
            if (!groupData?.data) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_GROUP', 'Group data is missing');
            }

            // Note: Group metadata will be updated by the balance aggregation trigger
        });

        LoggerContext.setBusinessContext({ expenseId });
        logger.info('expense-deleted', { id: expenseId });

        res.json({
            message: 'Expense deleted successfully',
        });
    } catch (error) {
        logger.error('Failed to delete expense', error, {
            expenseId,
            userId,
        });
        throw error;
    }
};

/**
 * Internal function to get group expenses data
 * Used by both the HTTP handler and consolidated endpoints
 */
export const _getGroupExpensesData = async (
    groupId: string, 
    options: {
        limit?: number;
        cursor?: string;
        includeDeleted?: boolean;
    } = {}
): Promise<{
    expenses: any[];
    count: number;
    hasMore: boolean;
    nextCursor?: string;
}> => {
    const limit = Math.min(options.limit || 20, 100);
    const cursor = options.cursor;
    const includeDeleted = options.includeDeleted || false;

    let query = getExpensesCollection()
        .where('groupId', '==', groupId)
        .select(
            'groupId',
            'createdBy',
            'paidBy',
            'amount',
            'currency',
            'description',
            'category',
            'date',
            'splitType',
            'participants',
            'splits',
            'receiptUrl',
            'createdAt',
            'updatedAt',
            'deletedAt',
            'deletedBy',
        )
        .orderBy('date', 'desc')
        .orderBy('createdAt', 'desc')
        .limit(limit + 1);

    // Filter out deleted expenses by default
    if (!includeDeleted) {
        query = query.where(DELETED_AT_FIELD, '==', null);
    }

    if (cursor) {
        try {
            const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
            const cursorData = JSON.parse(decodedCursor);

            if (cursorData.date && cursorData.createdAt) {
                query = query.startAfter(parseISOToTimestamp(cursorData.date) || createServerTimestamp(), parseISOToTimestamp(cursorData.createdAt) || createServerTimestamp());
            }
        } catch (error) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_CURSOR', 'Invalid cursor format');
        }
    }

    const snapshot = await query.get();

    const hasMore = snapshot.docs.length > limit;
    const expenses = snapshot.docs.slice(0, limit).map((doc) => {
        const data = doc.data() as Expense;
        return {
            id: doc.id,
            groupId: data.groupId,
            createdBy: data.createdBy,
            paidBy: data.paidBy,
            amount: data.amount,
            currency: data.currency,
            description: data.description,
            category: data.category,
            date: timestampToISO(data.date),
            splitType: data.splitType,
            participants: data.participants,
            splits: data.splits,
            receiptUrl: data.receiptUrl,
            createdAt: timestampToISO(data.createdAt),
            updatedAt: timestampToISO(data.updatedAt),
            deletedAt: data.deletedAt ? timestampToISO(data.deletedAt) : null,
            deletedBy: data.deletedBy || null,
        };
    });

    let nextCursor: string | undefined;
    if (hasMore && expenses.length > 0) {
        const lastDoc = snapshot.docs[limit - 1];
        const lastDocData = lastDoc.data() as Expense;
        const cursorData = {
            date: timestampToISO(lastDocData.date),
            createdAt: timestampToISO(lastDocData.createdAt),
            id: lastDoc.id,
        };
        nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }

    return {
        expenses,
        count: expenses.length,
        hasMore,
        nextCursor,
    };
};

export const listGroupExpenses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);

    const groupId = req.query.groupId as string;
    if (!groupId) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
    }

    await verifyGroupMembership(groupId, userId);

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const cursor = req.query.cursor as string;
    const includeDeleted = req.query.includeDeleted === 'true';

    // Use extracted function to get expenses data
    const result = await _getGroupExpensesData(groupId, {
        limit,
        cursor,
        includeDeleted
    });

    res.json(result);
};

export const listUserExpenses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const cursor = req.query.cursor as string;
    const includeDeleted = req.query.includeDeleted === 'true';

    let query = getExpensesCollection()
        .where('participants', 'array-contains', userId)
        .select(
            'groupId',
            'createdBy',
            'paidBy',
            'amount',
            'currency',
            'description',
            'category',
            'date',
            'splitType',
            'participants',
            'splits',
            'receiptUrl',
            'createdAt',
            'updatedAt',
            'deletedAt',
            'deletedBy',
        )
        .orderBy('date', 'desc')
        .orderBy('createdAt', 'desc')
        .limit(limit + 1);

    // Filter out deleted expenses by default
    if (!includeDeleted) {
        query = query.where(DELETED_AT_FIELD, '==', null);
    }

    if (cursor) {
        try {
            const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
            const cursorData = JSON.parse(decodedCursor);

            if (cursorData.date && cursorData.createdAt) {
                query = query.startAfter(parseISOToTimestamp(cursorData.date) || createServerTimestamp(), parseISOToTimestamp(cursorData.createdAt) || createServerTimestamp());
            }
        } catch (error) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_CURSOR', 'Invalid cursor format');
        }
    }

    const snapshot = await query.get();

    const hasMore = snapshot.docs.length > limit;
    const expenses = snapshot.docs.slice(0, limit).map((doc) => {
        const data = doc.data() as Expense;
        return {
            id: doc.id,
            groupId: data.groupId,
            createdBy: data.createdBy,
            paidBy: data.paidBy,
            amount: data.amount,
            currency: data.currency,
            description: data.description,
            category: data.category,
            date: timestampToISO(data.date),
            splitType: data.splitType,
            participants: data.participants,
            splits: data.splits,
            receiptUrl: data.receiptUrl,
            createdAt: timestampToISO(data.createdAt),
            updatedAt: timestampToISO(data.updatedAt),
            deletedAt: data.deletedAt ? timestampToISO(data.deletedAt) : null,
            deletedBy: data.deletedBy || null,
        };
    });

    let nextCursor: string | undefined;
    if (hasMore && expenses.length > 0) {
        const lastDoc = snapshot.docs[limit - 1];
        const lastDocData = lastDoc.data() as Expense;
        const cursorData = {
            date: timestampToISO(lastDocData.date),
            createdAt: timestampToISO(lastDocData.createdAt),
            id: lastDoc.id,
        };
        nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }

    res.json({
        expenses,
        count: expenses.length,
        hasMore,
        nextCursor,
    });
};

export const getExpenseHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const expenseId = validateExpenseId(req.query.id);

    // Verify user has access to this expense
    await fetchExpense(expenseId, userId);

    const historySnapshot = await getExpensesCollection().doc(expenseId).collection('history').orderBy('modifiedAt', 'desc').limit(20).get();

    const history = historySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
            id: doc.id,
            modifiedAt: timestampToISO(data.modifiedAt),
            modifiedBy: data.modifiedBy,
            changeType: data.changeType,
            changes: data.changes,
            previousAmount: data.amount,
            previousDescription: data.description,
            previousCategory: data.category,
            previousDate: data.date ? timestampToISO(data.date) : undefined,
            previousSplits: data.splits,
        };
    });

    res.json({
        history,
        count: history.length,
    });
};

/**
 * Get consolidated expense details (expense + group + members)
 * Eliminates race conditions by providing all needed data in one request
 */
export const getExpenseFullDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const expenseId = validateExpenseId(req.params.id);

    try {
        // Reuse existing tested functions for each data type
        const { expense } = await fetchExpense(expenseId, userId);
        
        // Get group document (access already verified by fetchExpense)
        const groupDoc = await getGroupsCollection().doc(expense.groupId).get();
        if (!groupDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }
        
        const groupData = groupDoc.data();
        if (!groupData?.data?.name) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Invalid group data');
        }
        
        // Transform group data using same pattern as groups handler
        const group = {
            id: groupDoc.id,
            name: groupData.data.name,
            description: groupData.data.description || '',
            createdBy: groupData.data.createdBy,
            members: groupData.data.members,
            createdAt: groupData.createdAt.toDate().toISOString(),
            updatedAt: groupData.updatedAt.toDate().toISOString(),
        };
        
        // Use extracted internal functions to eliminate duplication
        const membersData = await _getGroupMembersData(expense.groupId, groupData.data.members!);

        // Format expense response using existing patterns
        const expenseResponse = {
            id: expense.id,
            groupId: expense.groupId,
            createdBy: expense.createdBy,
            paidBy: expense.paidBy,
            amount: expense.amount,
            currency: expense.currency,
            description: expense.description,
            category: expense.category,
            date: timestampToISO(expense.date),
            splitType: expense.splitType,
            participants: expense.participants,
            splits: expense.splits,
            receiptUrl: expense.receiptUrl,
            createdAt: timestampToISO(expense.createdAt),
            updatedAt: timestampToISO(expense.updatedAt),
        };

        // Construct response using existing patterns
        const response = {
            expense: expenseResponse,
            group,
            members: membersData,
        };

        res.json(response);
    } catch (error) {
        logger.error('Error in getExpenseFullDetails', error, {
            expenseId,
            userId,
        });
        throw error;
    }
};
