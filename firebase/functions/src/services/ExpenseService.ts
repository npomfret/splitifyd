import * as admin from 'firebase-admin';
import { z } from 'zod';
import { firestoreDb } from '../firebase';
import { ApiError, Errors } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { timestampToISO, createServerTimestamp, parseISOToTimestamp } from '../utils/dateHelpers';
import { logger, LoggerContext } from '../logger';
import { FirestoreCollections, DELETED_AT_FIELD, SplitTypes, Group, CreateExpenseRequest } from '@splitifyd/shared';
import { Expense, calculateSplits } from '../expenses/validation';
import { verifyGroupMembership } from '../utils/groupHelpers';
import { PermissionEngine } from '../permissions';

/**
 * Zod schemas for expense document validation
 */
export const ExpenseSplitSchema = z.object({
    userId: z.string().min(1),
    amount: z.number().positive(),
    percentage: z.number().min(0).max(100).optional(),
});

export const ExpenseDocumentSchema = z.object({
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
}).passthrough(); // Allow additional fields that may exist

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
                validationErrors: error instanceof z.ZodError ? error.issues : undefined 
            });
            throw new ApiError(
                HTTP_STATUS.INTERNAL_ERROR, 
                'INVALID_EXPENSE_DATA', 
                'Expense data is corrupted'
            );
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
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN, 
                'NOT_AUTHORIZED', 
                'You do not have permission to create expenses in this group'
            );
        }

        // Validate that paidBy and all participants are group members
        const memberIds = Object.keys(group.members);
        
        if (!memberIds.includes(expenseData.paidBy)) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST, 
                'INVALID_PAYER', 
                'Payer must be a member of the group'
            );
        }

        for (const participantId of expenseData.participants) {
            if (!memberIds.includes(participantId)) {
                throw new ApiError(
                    HTTP_STATUS.BAD_REQUEST, 
                    'INVALID_PARTICIPANT', 
                    `Participant ${participantId} is not a member of the group`
                );
            }
        }

        // Create the expense document
        const now = createServerTimestamp();
        const docRef = this.expensesCollection.doc();
        
        // Calculate splits based on split type
        const splits = calculateSplits(
            expenseData.amount, 
            expenseData.splitType, 
            expenseData.participants, 
            expenseData.splits
        );

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
                validationErrors: error instanceof z.ZodError ? error.issues : undefined 
            });
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'INVALID_EXPENSE_DATA',
                'Invalid expense data format'
            );
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
     * List expenses for a group with pagination
     */
    async listGroupExpenses(
        groupId: string,
        userId: string,
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
    }> {
        // Verify user is a member of the group
        await verifyGroupMembership(groupId, userId);

        const limit = Math.min(options.limit || 20, 100);
        const cursor = options.cursor;
        const includeDeleted = options.includeDeleted || false;

        let query = this.expensesCollection
            .where('groupId', '==', groupId);

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
                    query = query.startAfter(
                        parseISOToTimestamp(cursorData.date) || createServerTimestamp(), 
                        parseISOToTimestamp(cursorData.createdAt) || createServerTimestamp()
                    );
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
                ...this.transformExpenseToResponse({ ...data, id: doc.id })
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
}

// Export singleton instance
export const expenseService = new ExpenseService();