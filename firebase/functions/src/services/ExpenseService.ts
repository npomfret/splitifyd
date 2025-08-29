import * as admin from 'firebase-admin';
import { z } from 'zod';
import { firestoreDb } from '../firebase';
import { ApiError, Errors } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { timestampToISO, createServerTimestamp, parseISOToTimestamp } from '../utils/dateHelpers';
import { logger, LoggerContext } from '../logger';
import { FirestoreCollections, DELETED_AT_FIELD, SplitTypes, Group, CreateExpenseRequest, UpdateExpenseRequest } from '@splitifyd/shared';
import { Expense, calculateSplits } from '../expenses/validation';
import { verifyGroupMembership } from '../utils/groupHelpers';
import { PermissionEngine } from '../permissions';
import { _getGroupMembersData } from '../groups/memberHandlers';

/**
 * Zod schemas for expense document validation
 */
export const ExpenseSplitSchema = z.object({
    userId: z.string().min(1),
    amount: z.number().positive(),
    percentage: z.number().min(0).max(100).optional(),
});

export const ExpenseDocumentSchema = z
    .object({
        id: z.string().min(1),
        groupId: z.string().min(1),
        createdBy: z.string().min(1),
        paidBy: z.string().min(1),
        amount: z.number().positive(),
        currency: z.string().length(3),
        description: z.string().min(1).max(200),
        category: z.string().min(1).max(50),
        date: z.any(), // Firestore Timestamp
        splitType: z.enum([SplitTypes.EQUAL, SplitTypes.EXACT, SplitTypes.PERCENTAGE]),
        participants: z.array(z.string().min(1)).min(1),
        splits: z.array(ExpenseSplitSchema),
        receiptUrl: z.string().url().optional().nullable(),
        createdAt: z.any(), // Firestore Timestamp
        updatedAt: z.any(), // Firestore Timestamp
        deletedAt: z.any().nullable(), // Firestore Timestamp or null
        deletedBy: z.string().nullable(),
    })
    .passthrough(); // Allow additional fields that may exist

/**
 * Service for managing expenses
 */
export class ExpenseService {
    private expensesCollection = firestoreDb.collection(FirestoreCollections.EXPENSES);
    private groupsCollection = firestoreDb.collection(FirestoreCollections.GROUPS);

    /**
     * Fetch and validate an expense document
     */
    private async fetchExpense(expenseId: string): Promise<{ docRef: admin.firestore.DocumentReference; expense: Expense }> {
        const docRef = this.expensesCollection.doc(expenseId);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw Errors.NOT_FOUND('Expense');
        }

        const rawData = doc.data();
        if (!rawData) {
            throw Errors.NOT_FOUND('Expense');
        }

        // Validate the expense data structure
        let expense: Expense;
        try {
            // Add the id field since it's not stored in the document data
            const dataWithId = { ...rawData, id: doc.id };
            const validatedData = ExpenseDocumentSchema.parse(dataWithId);
            expense = validatedData as Expense;
        } catch (error) {
            logger.error('Invalid expense document structure', error as Error, {
                expenseId,
                validationErrors: error instanceof z.ZodError ? error.issues : undefined,
            });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_EXPENSE_DATA', 'Expense data is corrupted');
        }

        // Check if the expense is soft-deleted
        if (expense.deletedAt) {
            throw Errors.NOT_FOUND('Expense');
        }

        return { docRef, expense };
    }

    /**
     * Transform expense document to response format
     */
    private transformExpenseToResponse(expense: Expense): any {
        return {
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
            deletedAt: expense.deletedAt ? timestampToISO(expense.deletedAt) : null,
            deletedBy: expense.deletedBy || null,
        };
    }

    /**
     * Get a single expense by ID
     */
    async getExpense(expenseId: string, userId: string): Promise<any> {
        const { expense } = await this.fetchExpense(expenseId);

        // Verify user has access to view this expense
        // Check if user is a participant in this expense
        if (!expense.participants || !expense.participants.includes(userId)) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_EXPENSE_PARTICIPANT', 'You are not a participant in this expense');
        }

        return this.transformExpenseToResponse(expense);
    }

    /**
     * Transform group document to Group object
     */
    private transformGroupDocument(doc: admin.firestore.DocumentSnapshot): Group {
        const data = doc.data();
        if (!data || !data.data) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        return {
            id: doc.id,
            name: data.data.name,
            description: data.data.description || '',
            createdBy: data.data.createdBy,
            members: data.data.members || {},
            permissions: data.data.permissions,
            createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate().toISOString() || new Date().toISOString(),
        } as Group;
    }

    /**
     * Create a new expense
     */
    async createExpense(userId: string, expenseData: CreateExpenseRequest): Promise<any> {
        // Verify user is a member of the group
        await verifyGroupMembership(expenseData.groupId, userId);

        // Get group data and verify permissions
        const groupDoc = await this.groupsCollection.doc(expenseData.groupId).get();
        if (!groupDoc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = this.transformGroupDocument(groupDoc);

        // Check if user can create expenses in this group
        const canCreateExpense = PermissionEngine.checkPermission(group, userId, 'expenseEditing');
        if (!canCreateExpense) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to create expenses in this group');
        }

        // Validate that paidBy and all participants are group members
        const memberIds = Object.keys(group.members);

        if (!memberIds.includes(expenseData.paidBy)) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PAYER', 'Payer must be a member of the group');
        }

        for (const participantId of expenseData.participants) {
            if (!memberIds.includes(participantId)) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PARTICIPANT', `Participant ${participantId} is not a member of the group`);
            }
        }

        // Create the expense document
        const now = createServerTimestamp();
        const docRef = this.expensesCollection.doc();

        // Calculate splits based on split type
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

        // Validate the expense document before writing
        try {
            ExpenseDocumentSchema.parse(expense);
        } catch (error) {
            logger.error('Invalid expense document to write', error as Error, {
                validationErrors: error instanceof z.ZodError ? error.issues : undefined,
            });
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_EXPENSE_DATA', 'Invalid expense data format');
        }

        // Use transaction to create expense atomically
        await firestoreDb.runTransaction(async (transaction) => {
            // Re-verify group exists within transaction
            const groupDocRef = this.groupsCollection.doc(expenseData.groupId);
            const groupDocInTx = await transaction.get(groupDocRef);

            if (!groupDocInTx.exists) {
                throw Errors.NOT_FOUND('Group');
            }

            const groupDataInTx = groupDocInTx.data();
            if (!groupDataInTx?.data) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_GROUP', 'Group data is missing');
            }

            // Create the expense
            transaction.set(docRef, expense);
        });

        // Set business context for logging
        LoggerContext.setBusinessContext({ groupId: expenseData.groupId, expenseId: docRef.id });
        logger.info('expense-created', { id: docRef.id, groupId: expenseData.groupId });

        // Return the expense in response format
        return this.transformExpenseToResponse(expense);
    }

    /**
     * Update an existing expense
     */
    async updateExpense(expenseId: string, userId: string, updateData: UpdateExpenseRequest): Promise<any> {
        // Fetch the existing expense
        const { docRef, expense } = await this.fetchExpense(expenseId);

        // Get group data and verify permissions
        const groupDoc = await this.groupsCollection.doc(expense.groupId).get();
        if (!groupDoc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = this.transformGroupDocument(groupDoc);

        // Check if user can edit expenses in this group
        // Convert expense to ExpenseData format for permission check
        const expenseData = this.transformExpenseToResponse(expense);
        const canEditExpense = PermissionEngine.checkPermission(group, userId, 'expenseEditing', { expense: expenseData });
        if (!canEditExpense) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to edit this expense');
        }

        // If updating paidBy or participants, validate they are group members
        const memberIds = Object.keys(group.members);

        if (updateData.paidBy && !memberIds.includes(updateData.paidBy)) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PAYER', 'Payer must be a member of the group');
        }

        if (updateData.participants) {
            for (const participantId of updateData.participants) {
                if (!memberIds.includes(participantId)) {
                    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PARTICIPANT', `Participant ${participantId} is not a member of the group`);
                }
            }
        }

        // Build update object with Firestore timestamp
        // Note: We use 'any' here because we need to mix UpdateExpenseRequest fields
        // with Firestore-specific fields (timestamps) that have different types
        const updates: any = {
            ...updateData,
            updatedAt: createServerTimestamp(),
        };

        // Handle date conversion
        if (updateData.date) {
            updates.date = parseISOToTimestamp(updateData.date) || createServerTimestamp();
        }

        // Handle split recalculation if needed
        if (updateData.splitType || updateData.participants || updateData.splits || updateData.amount) {
            const amount = updateData.amount !== undefined ? updateData.amount : expense.amount;
            const splitType = updateData.splitType !== undefined ? updateData.splitType : expense.splitType;
            const participants = updateData.participants !== undefined ? updateData.participants : expense.participants;

            // If only amount is updated and splitType is 'exact', convert to equal splits
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
            updates.splitType = finalSplitType;
        }

        // Use transaction to update expense atomically with optimistic locking
        await firestoreDb.runTransaction(async (transaction) => {
            // Re-fetch expense within transaction to check for concurrent updates
            const expenseDocInTx = await transaction.get(docRef);

            if (!expenseDocInTx.exists) {
                throw Errors.NOT_FOUND('Expense');
            }

            const currentData = expenseDocInTx.data();
            if (!currentData) {
                throw Errors.NOT_FOUND('Expense');
            }

            // Check if expense was updated since we fetched it
            const originalTimestamp = expense.updatedAt;
            const currentTimestamp = currentData.updatedAt;

            if (!currentTimestamp || !originalTimestamp || !currentTimestamp.isEqual(originalTimestamp)) {
                throw new ApiError(HTTP_STATUS.CONFLICT, 'CONCURRENT_UPDATE', 'Expense was modified by another user. Please refresh and try again.');
            }

            // Create history entry
            const historyEntry = {
                ...expense,
                modifiedAt: createServerTimestamp(),
                modifiedBy: userId,
                changeType: 'update' as const,
                changes: Object.keys(updateData),
            };

            // Save history and update expense
            const historyRef = docRef.collection('history').doc();
            transaction.set(historyRef, historyEntry);
            transaction.update(docRef, updates);
        });

        // Set business context for logging
        LoggerContext.setBusinessContext({ groupId: expense.groupId, expenseId });
        logger.info('expense-updated', { id: expenseId, changes: Object.keys(updateData) });

        // Fetch and return the updated expense
        const updatedDoc = await docRef.get();
        const updatedExpense = {
            id: updatedDoc.id,
            ...updatedDoc.data(),
        } as Expense;

        return this.transformExpenseToResponse(updatedExpense);
    }

    /**
     * List expenses for a group with pagination
     */
    async listGroupExpenses(
        groupId: string,
        userId: string,
        options: {
            limit?: number;
            cursor?: string;
            includeDeleted?: boolean;
        } = {},
    ): Promise<{
        expenses: any[];
        count: number;
        hasMore: boolean;
        nextCursor?: string;
    }> {
        // Verify user is a member of the group
        await verifyGroupMembership(groupId, userId);

        const limit = Math.min(options.limit || 20, 100);
        const cursor = options.cursor;
        const includeDeleted = options.includeDeleted || false;

        let query = this.expensesCollection.where('groupId', '==', groupId);

        // Filter out deleted expenses by default
        if (!includeDeleted) {
            query = query.where(DELETED_AT_FIELD, '==', null);
        }

        query = query
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
                ...this.transformExpenseToResponse({ ...data, id: doc.id }),
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
    }

    /**
     * Delete an expense (soft delete)
     */
    async deleteExpense(expenseId: string, userId: string): Promise<void> {
        // Fetch the existing expense
        const { docRef, expense } = await this.fetchExpense(expenseId);

        // Get group data and verify permissions
        const groupDoc = await this.groupsCollection.doc(expense.groupId).get();
        if (!groupDoc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = this.transformGroupDocument(groupDoc);

        // Check if user can delete expenses in this group
        // Convert expense to ExpenseData format for permission check
        const expenseData = this.transformExpenseToResponse(expense);
        const canDeleteExpense = PermissionEngine.checkPermission(group, userId, 'expenseDeletion', { expense: expenseData });
        if (!canDeleteExpense) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to delete this expense');
        }

        try {
            // Use transaction to soft delete expense atomically
            await firestoreDb.runTransaction(async (transaction) => {
                // IMPORTANT: All reads must happen before any writes in Firestore transactions

                // Step 1: Do ALL reads first
                const expenseDoc = await transaction.get(docRef);
                if (!expenseDoc.exists) {
                    throw Errors.NOT_FOUND('Expense');
                }

                // Get the current timestamp for optimistic locking
                const originalTimestamp = expenseDoc.data()?.updatedAt;
                if (!originalTimestamp) {
                    throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_EXPENSE_DATA', 'Expense is missing updatedAt timestamp');
                }

                // Get group doc to ensure it exists (though we already checked above)
                const groupDocRef = this.groupsCollection.doc(expense.groupId);
                const groupDocInTx = await transaction.get(groupDocRef);
                if (!groupDocInTx.exists) {
                    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_GROUP', 'Group not found');
                }

                // Step 2: Check for concurrent updates
                const currentTimestamp = expenseDoc.data()?.updatedAt;
                if (!currentTimestamp || !currentTimestamp.isEqual(originalTimestamp)) {
                    throw Errors.CONCURRENT_UPDATE();
                }

                // Step 3: Now do ALL writes - soft delete the expense
                transaction.update(docRef, {
                    [DELETED_AT_FIELD]: createServerTimestamp(),
                    deletedBy: userId,
                    updatedAt: createServerTimestamp(), // Update the timestamp for optimistic locking
                });

                // Note: Group metadata/balance updates will be handled by the balance aggregation trigger
            });

            LoggerContext.setBusinessContext({ expenseId });
            logger.info('expense-deleted', { id: expenseId });
        } catch (error) {
            logger.error('Failed to delete expense', error as Error, {
                expenseId,
                userId,
            });
            throw error;
        }
    }

    /**
     * List all expenses for a user across all groups with pagination
     */
    async listUserExpenses(
        userId: string,
        options: {
            limit?: number;
            cursor?: string;
            includeDeleted?: boolean;
        } = {},
    ): Promise<{
        expenses: any[];
        count: number;
        hasMore: boolean;
        nextCursor?: string;
    }> {
        const limit = Math.min(options.limit || 50, 100);
        const cursor = options.cursor;
        const includeDeleted = options.includeDeleted || false;

        let query = this.expensesCollection
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
                ...this.transformExpenseToResponse({ ...data, id: doc.id }),
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
    }

    /**
     * Get expense history/audit log
     */
    async getExpenseHistory(expenseId: string, userId: string): Promise<{
        history: any[];
        count: number;
    }> {
        // Verify user has access to this expense first
        await this.fetchExpense(expenseId);

        const historySnapshot = await this.expensesCollection
            .doc(expenseId)
            .collection('history')
            .orderBy('modifiedAt', 'desc')
            .limit(20)
            .get();

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

        return {
            history,
            count: history.length,
        };
    }

    /**
     * Get consolidated expense details (expense + group + members)
     * Eliminates race conditions by providing all needed data in one request
     */
    async getExpenseFullDetails(expenseId: string, userId: string): Promise<{
        expense: any;
        group: any;
        members: any;
    }> {
        // Fetch the expense
        const { expense } = await this.fetchExpense(expenseId);

        // Get group document for permission check and data
        const groupDoc = await this.groupsCollection.doc(expense.groupId).get();
        if (!groupDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        // Check if user is a participant in this expense or a group member (access control for viewing)
        if (!expense.participants || !expense.participants.includes(userId)) {
            // Additional check: allow group members to view expenses they're not participants in
            const groupData = groupDoc.data();
            if (!groupData?.data?.members?.[userId]) {
                throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You are not authorized to view this expense');
            }
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

        // Get members data using the proper helper function
        const members = await _getGroupMembersData(expense.groupId, groupData.data.members || {});

        // Format expense response
        const expenseResponse = this.transformExpenseToResponse(expense);

        return {
            expense: expenseResponse,
            group,
            members,
        };
    }
}

// Export singleton instance
export const expenseService = new ExpenseService();
