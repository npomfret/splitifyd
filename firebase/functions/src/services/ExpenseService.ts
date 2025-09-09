import {DocumentReference} from 'firebase-admin/firestore';
import {z} from 'zod';
import {ApiError, Errors} from '../utils/errors';
import {HTTP_STATUS} from '../constants';
import {createOptimisticTimestamp, parseISOToTimestamp, timestampToISO} from '../utils/dateHelpers';
import {logger, LoggerContext} from '../logger';
import type {Group, GroupPermissions} from '@splitifyd/shared';
import {CreateExpenseRequest, DELETED_AT_FIELD, FirestoreCollections, SplitTypes, UpdateExpenseRequest} from '@splitifyd/shared';
import {calculateSplits, Expense} from '../expenses/validation';
import {verifyGroupMembership} from '../utils/groupHelpers';
import {isMemberInArray} from '../utils/memberHelpers';
import type {IServiceProvider} from './IServiceProvider';
import {PermissionEngineAsync} from '../permissions/permission-engine-async';
import {ExpenseDocumentSchema, ExpenseSplitSchema} from '../schemas/expense';
import { measureDb } from '../monitoring/measure';
import {runTransactionWithRetry} from '../utils/firestore-helpers';
import type {IFirestoreReader} from './firestore/IFirestoreReader';
import type {IFirestoreWriter} from './firestore/IFirestoreWriter';
import type {GroupDocument} from '../schemas';

export { ExpenseDocumentSchema, ExpenseSplitSchema };

/**
 * Service for managing expenses
 */
/**
 * Transform GroupDocument (database schema) to Group (API type) with required defaults
 */
function toGroup(groupDoc: GroupDocument): Group {
    const defaultPermissions: GroupPermissions = {
        expenseEditing: 'anyone',
        expenseDeletion: 'owner-and-admin',
        memberInvitation: 'anyone',
        memberApproval: 'automatic',
        settingsManagement: 'admin-only'
    };
    
    return {
        ...groupDoc,
        securityPreset: groupDoc.securityPreset!,
        permissions: groupDoc.permissions as GroupPermissions
    };
}

export class ExpenseService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly serviceProvider: IServiceProvider
    ) {}

    /**
     * Fetch and validate an expense document
     */
    private async fetchExpense(expenseId: string): Promise<Expense> {
        // Use FirestoreReader for read operation
        const expenseData = await this.firestoreReader.getExpense(expenseId);
        
        if (!expenseData) {
            throw Errors.NOT_FOUND('Expense');
        }

        // Validate the expense data structure
        let expense: Expense;
        try {
            // Data already validated by FirestoreReader
            const validatedData = expenseData;
            // Use the validated data directly - schema parse guarantees type safety
            // Convert receiptUrl from null to undefined if needed
            expense = {
                ...validatedData,
                receiptUrl: validatedData.receiptUrl || undefined,
            };
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

        return expense;
    }

    /**
     * Normalize validated expense data to Expense type
     */
    private normalizeValidatedExpense(validatedData: any): Expense {
        return {
            ...validatedData,
            receiptUrl: validatedData.receiptUrl,
        };
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
            deletedBy: expense.deletedBy,
        };
    }

    /**
     * Get a single expense by ID
     */
    async getExpense(expenseId: string, userId: string): Promise<any> {
        return measureDb('ExpenseService.getExpense', async () => this._getExpense(expenseId, userId));
    }

    private async _getExpense(expenseId: string, userId: string): Promise<any> {
        const expense = await this.fetchExpense(expenseId);

        // Verify user has access to view this expense
        // Check if user is a participant in this expense
        if (!expense.participants || !expense.participants.includes(userId)) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_EXPENSE_PARTICIPANT', 'You are not a participant in this expense');
        }

        return this.transformExpenseToResponse(expense);
    }


    /**
     * Create a new expense
     */
    async createExpense(userId: string, expenseData: CreateExpenseRequest): Promise<any> {
        return measureDb('ExpenseService.createExpense', async () => this._createExpense(userId, expenseData));
    }

    private async _createExpense(userId: string, expenseData: CreateExpenseRequest): Promise<any> {
        // Verify user is a member of the group
        await verifyGroupMembership(expenseData.groupId, userId);

        // Get group data and verify permissions using FirestoreReader
        const groupData = await this.firestoreReader.getGroup(expenseData.groupId);
        if (!groupData) {
            throw Errors.NOT_FOUND('Group');
        }

        // Transform GroupDocument to Group format for PermissionEngine
        const group = toGroup(groupData);

        // Check if user can create expenses in this group
        const canCreateExpense = await PermissionEngineAsync.checkPermission(group, userId, 'expenseEditing');
        if (!canCreateExpense) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to create expenses in this group');
        }

        // Get current members to validate participants
        const membersData = await this.serviceProvider.getGroupMembers(expenseData.groupId);
        const members = membersData.members;

        if (!isMemberInArray(members, expenseData.paidBy)) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PAYER', 'Payer must be a member of the group');
        }

        for (const participantId of expenseData.participants) {
            if (!isMemberInArray(members, participantId)) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PARTICIPANT', `Participant ${participantId} is not a member of the group`);
            }
        }

        // Create the expense document
        const now = createOptimisticTimestamp();

        // Generate a unique ID for the expense
        const expenseId = this.firestoreWriter.generateDocumentId(FirestoreCollections.EXPENSES);

        // Calculate splits based on split type
        const splits = calculateSplits(expenseData.amount, expenseData.splitType, expenseData.participants, expenseData.splits);

        const expense: Expense = {
            id: expenseId,
            groupId: expenseData.groupId,
            createdBy: userId,
            paidBy: expenseData.paidBy,
            amount: expenseData.amount,
            currency: expenseData.currency,
            description: expenseData.description,
            category: expenseData.category,
            date: parseISOToTimestamp(expenseData.date)!,
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
        let createdExpenseRef: DocumentReference | undefined;
        await this.firestoreWriter.runTransaction(async (transaction) => {
            // Re-verify group exists within transaction
            const groupDocInTx = await this.firestoreReader.getRawGroupDocumentInTransaction(transaction, expenseData.groupId);

            if (!groupDocInTx) {
                throw Errors.NOT_FOUND('Group');
            }

            const groupDataInTx = groupDocInTx.data();
            if (!groupDataInTx) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_GROUP', 'Group data is missing');
            }

            // Create the expense with the pre-generated ID
            createdExpenseRef = this.firestoreWriter.createInTransaction(
                transaction,
                FirestoreCollections.EXPENSES,
                expenseId, // Use the specific ID we generated
                expense
            );
        });

        // Ensure the expense was created successfully
        if (!createdExpenseRef) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'EXPENSE_CREATION_FAILED', 'Failed to create expense');
        }

        // Set business context for logging
        LoggerContext.setBusinessContext({ groupId: expenseData.groupId, expenseId: createdExpenseRef.id });
        logger.info('expense-created', { id: createdExpenseRef.id, groupId: expenseData.groupId });

        // Return the expense in response format
        return this.transformExpenseToResponse(expense);
    }

    /**
     * Update an existing expense
     */
    async updateExpense(expenseId: string, userId: string, updateData: UpdateExpenseRequest): Promise<any> {
        return measureDb('ExpenseService.updateExpense', async () => this._updateExpense(expenseId, userId, updateData));
    }

    private async _updateExpense(expenseId: string, userId: string, updateData: UpdateExpenseRequest): Promise<any> {
        // Fetch the existing expense
        const expense = await this.fetchExpense(expenseId);

        // Get group data and verify permissions
        const groupData = await this.firestoreReader.getGroup(expense.groupId);
        if (!groupData) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = toGroup(groupData);

        // Check if user can edit expenses in this group
        // Convert expense to ExpenseData format for permission check
        const expenseData = this.transformExpenseToResponse(expense);
        const canEditExpense = await PermissionEngineAsync.checkPermission(group, userId, 'expenseEditing', { expense: expenseData });
        if (!canEditExpense) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to edit this expense');
        }

        // If updating paidBy or participants, validate they are group members
        const membersData = await this.serviceProvider.getGroupMembers(expense.groupId);
        const members = membersData.members;

        if (updateData.paidBy && !isMemberInArray(members, updateData.paidBy)) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PAYER', 'Payer must be a member of the group');
        }

        if (updateData.participants) {
            for (const participantId of updateData.participants) {
                if (!isMemberInArray(members, participantId)) {
                    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PARTICIPANT', `Participant ${participantId} is not a member of the group`);
                }
            }
        }

        // Build update object with Firestore timestamp
        // Note: We use 'any' here because we need to mix UpdateExpenseRequest fields
        // with Firestore-specific fields (timestamps) that have different types
        const updates: any = {
            ...updateData,
            updatedAt: createOptimisticTimestamp(),
        };

        // Handle date conversion
        if (updateData.date) {
            updates.date = parseISOToTimestamp(updateData.date);
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
        await runTransactionWithRetry(
            async (transaction) => {
                // Re-fetch expense within transaction to check for concurrent updates
                const expenseDocInTx = await this.firestoreReader.getRawExpenseDocumentInTransaction(transaction, expenseId);

                if (!expenseDocInTx) {
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
                // Filter out undefined values for Firestore compatibility
                const cleanExpenseData = Object.fromEntries(
                    Object.entries(expense).filter(([, value]) => value !== undefined)
                );

                const historyEntry = {
                    ...cleanExpenseData,
                    modifiedAt: createOptimisticTimestamp(),
                    modifiedBy: userId,
                    changeType: 'update' as const,
                    changes: Object.keys(updateData),
                };

                // Save history and update expense
                const historyRef = expenseDocInTx.ref.collection('history').doc();
                this.firestoreWriter.createInTransaction(
                    transaction,
                    `${FirestoreCollections.EXPENSES}/${expenseId}/history`,
                    historyRef.id,
                    historyEntry
                );
                this.firestoreWriter.updateInTransaction(
                    transaction,
                    expenseDocInTx.ref.path,
                    updates
                );
            },
            {
                maxAttempts: 3,
                context: {
                    operation: 'updateExpense',
                    userId,
                    groupId: expense.groupId,
                    expenseId: expenseId
                }
            }
        );

        // Set business context for logging
        LoggerContext.setBusinessContext({ groupId: expense.groupId, expenseId });
        logger.info('expense-updated', { id: expenseId, changes: Object.keys(updateData) });

        // Fetch and return the updated expense
        const updatedExpense = await this.firestoreReader.getExpense(expenseId);
        if (!updatedExpense) {
            throw Errors.NOT_FOUND('Expense');
        }

        // The expense from IFirestoreReader is already validated and includes the ID
        return this.transformExpenseToResponse(this.normalizeValidatedExpense(updatedExpense));
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
        return measureDb('ExpenseService.listGroupExpenses', async () => this._listGroupExpenses(groupId, userId, options));
    }

    private async _listGroupExpenses(
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

        // Use the centralized FirestoreReader method
        const result = await this.firestoreReader.getExpensesForGroupPaginated(groupId, options);
        
        // Transform the validated expense documents to response format
        const expenses = result.expenses.map(validatedExpense => ({
            id: validatedExpense.id,
            ...this.transformExpenseToResponse(this.normalizeValidatedExpense(validatedExpense)),
        }));

        return {
            expenses,
            count: expenses.length,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
        };
    }

    /**
     * Delete an expense (soft delete)
     */
    async deleteExpense(expenseId: string, userId: string): Promise<void> {
        return measureDb('ExpenseService.deleteExpense', async () => this._deleteExpense(expenseId, userId));
    }

    private async _deleteExpense(expenseId: string, userId: string): Promise<void> {
        // Fetch the existing expense
        const expense = await this.fetchExpense(expenseId);

        // Get group data and verify permissions
        const groupData = await this.firestoreReader.getGroup(expense.groupId);
        if (!groupData) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = toGroup(groupData);

        // Check if user can delete expenses in this group
        // Convert expense to ExpenseData format for permission check
        const expenseData = this.transformExpenseToResponse(expense);
        const canDeleteExpense = await PermissionEngineAsync.checkPermission(group, userId, 'expenseDeletion', { expense: expenseData });
        if (!canDeleteExpense) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to delete this expense');
        }

        try {
            // Use transaction to soft delete expense atomically
            await runTransactionWithRetry(
                async (transaction) => {
                    // IMPORTANT: All reads must happen before any writes in Firestore transactions

                    // Step 1: Do ALL reads first
                    const expenseDoc = await this.firestoreReader.getRawExpenseDocumentInTransaction(transaction, expenseId);
                    if (!expenseDoc) {
                        throw Errors.NOT_FOUND('Expense');
                    }

                    // Get the current timestamp for optimistic locking
                    const originalTimestamp = expenseDoc.data()?.updatedAt;
                    if (!originalTimestamp) {
                        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_EXPENSE_DATA', 'Expense is missing updatedAt timestamp');
                    }

                    // Get group doc to ensure it exists (though we already checked above)
                    const groupDocInTx = await this.firestoreReader.getRawGroupDocumentInTransaction(transaction, expense.groupId);
                    if (!groupDocInTx) {
                        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_GROUP', 'Group not found');
                    }

                    // Step 2: Check for concurrent updates
                    const currentTimestamp = expenseDoc.data()?.updatedAt;
                    if (!currentTimestamp || !currentTimestamp.isEqual(originalTimestamp)) {
                        throw Errors.CONCURRENT_UPDATE();
                    }

                    // Step 3: Now do ALL writes - soft delete the expense
                    this.firestoreWriter.updateInTransaction(
                        transaction,
                        expenseDoc.ref.path,
                        {
                            [DELETED_AT_FIELD]: createOptimisticTimestamp(),
                            deletedBy: userId,
                            updatedAt: createOptimisticTimestamp(), // Update the timestamp for optimistic locking
                        }
                    );

                    // Note: Group metadata/balance updates will be handled by the balance aggregation trigger
                },
                {
                    maxAttempts: 3,
                    context: {
                        operation: 'deleteExpense',
                        userId,
                        groupId: expense.groupId,
                        expenseId
                    }
                }
            );

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
        // Use the centralized FirestoreReader method
        const result = await this.firestoreReader.getUserExpenses(userId, options);
        
        // Transform the validated expense documents to response format
        const expenses = result.expenses.map(validatedExpense => ({
            id: validatedExpense.id,
            ...this.transformExpenseToResponse(this.normalizeValidatedExpense(validatedExpense)),
        }));

        return {
            expenses,
            count: expenses.length,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
        };
    }

    /**
     * Get expense history/audit log
     */
    async getExpenseHistory(expenseId: string): Promise<{ history: any[]; count: number }> {
        // Verify user has access to this expense first
        await this.fetchExpense(expenseId);

        // Use the centralized FirestoreReader method
        return await this.firestoreReader.getExpenseHistory(expenseId, 20);
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
        const expense = await this.fetchExpense(expenseId);

        // Get group document for permission check and data
        const groupData = await this.firestoreReader.getGroup(expense.groupId);
        if (!groupData) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        // Check if user is a participant in this expense or a group member (access control for viewing)
        if (!expense.participants || !expense.participants.includes(userId)) {
            // Additional check: allow group members to view expenses they're not participants in
            const member = await this.serviceProvider.getGroupMember(expense.groupId, userId);
            if (!member) {
                throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You are not authorized to view this expense');
            }
        }

        if (!groupData?.name) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Invalid group data');
        }

        // Transform group data using same pattern as groups handler (without deprecated members field)
        const group = {
            id: groupData.id,
            name: groupData.name,
            description: groupData.description,
            createdBy: groupData.createdBy,
            createdAt: groupData.createdAt.toDate().toISOString(),
            updatedAt: groupData.updatedAt.toDate().toISOString(),
        };

        // Get members data from subcollection
        const members = await this.serviceProvider.getGroupMembers(expense.groupId);

        // Format expense response
        const expenseResponse = this.transformExpenseToResponse(expense);

        return {
            expense: expenseResponse,
            group,
            members,
        };
    }
}

// ServiceRegistry handles service instantiation
