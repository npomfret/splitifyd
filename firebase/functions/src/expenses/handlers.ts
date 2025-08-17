import { Response } from 'express';
import * as admin from 'firebase-admin';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { Errors, ApiError } from '../utils/errors';
import { createServerTimestamp, parseISOToTimestamp, timestampToISO } from '../utils/dateHelpers';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { validateCreateExpense, validateUpdateExpense, validateExpenseId, calculateSplits, Expense } from './validation';
import { GroupData } from '../types/group-types';
import { FirestoreCollections, DELETED_AT_FIELD, SplitTypes } from '../shared/shared-types';
import { getUpdatedAtTimestamp, updateWithTimestamp } from '../utils/optimistic-locking';

const getExpensesCollection = () => {
    return admin.firestore().collection(FirestoreCollections.EXPENSES);
};

const getGroupsCollection = () => {
    return admin.firestore().collection(FirestoreCollections.GROUPS);
};

const isGroupOwner = async (groupId: string, userId: string): Promise<boolean> => {
    const groupDoc = await getGroupsCollection().doc(groupId).get();
    if (!groupDoc.exists) {
        return false;
    }
    const groupData = groupDoc.data();
    return groupData?.userId === userId;
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

    // Check if user is the group owner (creator)
    if (groupData.userId === userId) {
        return;
    }

    // Check if user is a member of the group
    const groupDataTyped = groupData.data as GroupData;

    // Check memberIds array
    if (groupDataTyped.memberIds!.includes(userId)) {
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
    if (groupData.userId === userId) {
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

    logger.info('Creating expense', { userId, body: req.body });

    const expenseData = validateCreateExpense(req.body);

    logger.info('Expense data validated', { userId, expenseData });

    await verifyGroupMembership(expenseData.groupId, userId);

    const groupDoc = await getGroupsCollection().doc(expenseData.groupId).get();
    const groupData = groupDoc.data();
    if (!groupData?.data?.memberIds) {
        throw new Error(`Group ${expenseData.groupId} not found or missing member data`);
    }
    const memberIds = groupData.data.memberIds;

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
        memberIds,
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
        await admin.firestore().runTransaction(async (transaction) => {
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

            logger.info('Transaction: Creating expense', {
                expenseId: docRef.id,
                groupId: expenseData.groupId,
            });
        });

        logger.info('Expense created', {
            expenseId: docRef.id,
            groupId: expenseData.groupId,
            amount: expenseData.amount,
            userId,
        });

        // Convert Firestore Timestamps to ISO strings for the response
        const responseExpense = {
            ...expense,
            date: timestampToISO(expense.date),
            createdAt: timestampToISO(expense.createdAt),
            updatedAt: timestampToISO(expense.updatedAt),
        };

        res.status(HTTP_STATUS.CREATED).json(responseExpense);
    } catch (error) {
        logger.error('Failed to create expense', {
            userId,
            error: error instanceof Error ? error : new Error('Unknown error'),
            expenseData,
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
            await admin.firestore().runTransaction(async (transaction) => {
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
                    logger.warn('Concurrent update detected', {
                        expenseId: docRef.id,
                        originalTimestamp: originalExpenseTimestamp.toDate().toISOString(),
                        currentTimestamp: currentTimestamp?.toDate().toISOString(),
                    });
                    throw Errors.CONCURRENT_UPDATE();
                }

                // Step 3: Now do ALL writes
                const historyRef = docRef.collection('history').doc();
                transaction.set(historyRef, historyEntry);

                // Update the expense (updateWithTimestamp no longer does reads)
                await updateWithTimestamp(transaction, docRef, updates, originalExpenseTimestamp);

                // Note: Group metadata will be updated by the balance aggregation trigger

                logger.info('Transaction: Updating expense with history', {
                    expenseId,
                    groupId: expense.groupId,
                    historyId: historyRef.id,
                });
            });
        } else {
            // No date change, update expense with history in transaction
            await admin.firestore().runTransaction(async (transaction) => {
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
                    logger.warn('Concurrent update detected', {
                        expenseId: docRef.id,
                        originalTimestamp: originalExpenseTimestamp.toDate().toISOString(),
                        currentTimestamp: currentTimestamp?.toDate().toISOString(),
                    });
                    throw Errors.CONCURRENT_UPDATE();
                }

                // Step 3: Now do ALL writes
                const historyRef = docRef.collection('history').doc();
                transaction.set(historyRef, historyEntry);

                // Update the expense (updateWithTimestamp no longer does reads)
                await updateWithTimestamp(transaction, docRef, updates, originalExpenseTimestamp);

                logger.info('Transaction: Updating expense with history', {
                    expenseId,
                    historyId: historyRef.id,
                });
            });
        }

        logger.info('Expense updated with history', {
            expenseId,
            userId,
            updates: Object.keys(updateData),
        });

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
        await admin.firestore().runTransaction(async (transaction) => {
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
                logger.warn('Concurrent update detected', {
                    expenseId: docRef.id,
                    originalTimestamp: originalExpenseTimestamp.toDate().toISOString(),
                    currentTimestamp: currentTimestamp?.toDate().toISOString(),
                });
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

            logger.info('Transaction: Soft deleting expense', {
                expenseId,
                groupId: expense.groupId,
                deletedBy: userId,
            });
        });

        logger.info('Expense soft deleted', {
            expenseId,
            groupId: expense.groupId,
            userId,
            deletedBy: userId,
        });

        res.json({
            message: 'Expense deleted successfully',
        });
    } catch (error) {
        logger.error('Failed to delete expense', {
            expenseId,
            userId,
            error: error instanceof Error ? error : new Error('Unknown error'),
        });
        throw error;
    }
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
            'memberIds',
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

export const listUserExpenses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const cursor = req.query.cursor as string;
    const includeDeleted = req.query.includeDeleted === 'true';

    let query = getExpensesCollection()
        .where('memberIds', 'array-contains', userId)
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
            'memberIds',
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
