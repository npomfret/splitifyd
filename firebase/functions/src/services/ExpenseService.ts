import {CreateExpenseRequest, DELETED_AT_FIELD, ExpenseDTO, ExpenseFullDetailsDTO, GroupDTO, GroupMember, UpdateExpenseRequest} from '@splitifyd/shared';
import {z} from 'zod';
import {FirestoreCollections, HTTP_STATUS} from '../constants';
import * as expenseValidation from '../expenses/validation';
import type {IDocumentReference} from '../firestore-wrapper';
import {logger, LoggerContext} from '../logger';
import * as measure from '../monitoring/measure';
import {PerformanceTimer} from '../monitoring/PerformanceTimer';
import {PermissionEngineAsync} from '../permissions/permission-engine-async';
import {ApiError, Errors} from '../utils/errors';
import {IncrementalBalanceService} from './balance/IncrementalBalanceService';
import type {IFirestoreReader, IFirestoreWriter} from './firestore';

/**
 * Zod schema for User document - ensures critical fields are present
 */
const UserDataSchema = z
    .object({
        displayName: z.string().min(1),
        // Other fields are optional for this basic validation
    })
    .passthrough(); // Allow additional fields to pass through

/**
 * Service for managing expenses
 */

export class ExpenseService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly incrementalBalanceService: IncrementalBalanceService,
    ) {}

    /**
     * Fetch and validate an expense document
     */
    private async fetchExpense(expenseId: string): Promise<ExpenseDTO> {
        // Use FirestoreReader for read operation
        const expenseData = await this.firestoreReader.getExpense(expenseId);

        if (!expenseData) {
            throw Errors.NOT_FOUND('Expense');
        }

        // Validate the expense data structure
        let expense: ExpenseDTO;
        try {
            // Data already validated by FirestoreReader - it's an ExpenseDTO with ISO strings
            expense = {
                ...expenseData,
                receiptUrl: expenseData.receiptUrl || undefined,
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
    private normalizeValidatedExpense(validatedData: any): ExpenseDTO {
        return {
            ...validatedData,
            receiptUrl: validatedData.receiptUrl,
        };
    }

    /**
     * Fetch participant data for expenses
     * Handles both current members and departed members (who have left the group)
     * to allow viewing historical transaction data
     */
    private async fetchParticipantData(groupId: string, userId: string): Promise<GroupMember> {
        const [userData, memberData] = await Promise.all([
            this.firestoreReader.getUser(userId),
            this.firestoreReader.getGroupMember(groupId, userId),
        ]);

        if (!userData) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', `User ${userId} not found`);
        }

        // Validate user data
        try {
            const validatedData = UserDataSchema.parse(userData);
            const displayName = validatedData.displayName ?? 'Unknown User';

            // Generate initials from display name
            const initials = displayName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

            // If memberData is null, the user has left the group
            // Show real user profile data; use sentinel values for missing membership fields
            if (!memberData) {
                return {
                    uid: userId,
                    displayName,
                    initials,
                    themeColor: userData.themeColor || {
                        light: '#9CA3AF',
                        dark: '#6B7280',
                        name: 'Neutral Gray',
                        pattern: 'solid',
                        assignedAt: new Date().toISOString(),
                        colorIndex: -1,
                    },
                    memberRole: 'member', // Last known role before departure
                    memberStatus: 'active', // Last known status (can't use 'left' - not in enum)
                    joinedAt: '', // Historical data unavailable
                    invitedBy: undefined,
                    groupDisplayName: displayName, // Use global displayName for departed members
                };
            }

            // Normal path: member is still in the group
            return {
                uid: userId,
                displayName,
                initials,
                themeColor: memberData.theme,
                memberRole: memberData.memberRole,
                memberStatus: memberData.memberStatus,
                joinedAt: memberData.joinedAt, // Already ISO string from DTO
                invitedBy: memberData.invitedBy,
                groupDisplayName: memberData.groupDisplayName,
            };
        } catch (error) {
            logger.error('User document validation failed', error, { userId });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_USER_DATA', `User ${userId} has invalid data structure`);
        }
    }

    /**
     * Check if expense is locked due to departed members
     * An expense is locked if any participant is no longer in the group
     */
    private async isExpenseLocked(expense: ExpenseDTO): Promise<boolean> {
        const currentMemberIds = await this.firestoreReader.getAllGroupMemberIds(expense.groupId);
        return expense.participants.some(uid => !currentMemberIds.includes(uid));
    }

    /**
     * Get a single expense by ID
     */
    async getExpense(expenseId: string, userId: string): Promise<ExpenseDTO> {
        return measure.measureDb('ExpenseService.getExpense', async () => this._getExpense(expenseId, userId));
    }

    private async _getExpense(expenseId: string, userId: string): Promise<ExpenseDTO> {
        const timer = new PerformanceTimer();

        timer.startPhase('query');
        const expense = await this.fetchExpense(expenseId);
        timer.endPhase();

        // Verify user has access to view this expense
        // Check if user is a participant in this expense
        if (!expense.participants || !expense.participants.includes(userId)) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_EXPENSE_PARTICIPANT', 'You are not a participant in this expense');
        }

        const isLocked = await this.isExpenseLocked(expense);

        logger.info('expense-retrieved', {
            id: expenseId,
            timings: timer.getTimings(),
        });

        return {
            ...expense,
            isLocked,
        };
    }

    /**
     * Create a new expense
     */
    async createExpense(userId: string, expenseData: CreateExpenseRequest): Promise<ExpenseDTO> {
        return measure.measureDb('ExpenseService.createExpense', async () => this._createExpense(userId, expenseData));
    }

    private async _createExpense(userId: string, expenseData: CreateExpenseRequest): Promise<ExpenseDTO> {
        const timer = new PerformanceTimer();

        // Validate the input data early
        const validatedExpenseData = expenseValidation.validateCreateExpense(expenseData);

        // Parallelize all pre-transaction reads for maximum performance
        timer.startPhase('query');
        const [groupData, memberIds, member] = await Promise.all([
            this.firestoreReader.getGroup(validatedExpenseData.groupId),
            this.firestoreReader.getAllGroupMemberIds(validatedExpenseData.groupId),
            this.firestoreReader.getGroupMember(validatedExpenseData.groupId, userId),
        ]);
        timer.endPhase();

        if (!groupData) {
            throw Errors.NOT_FOUND('Group');
        }

        if (!member || !memberIds.includes(userId)) {
            throw Errors.FORBIDDEN();
        }

        // Check if user can create expenses in this group
        const canCreateExpense = PermissionEngineAsync.checkPermission(member!, groupData, userId, 'expenseEditing');
        if (!canCreateExpense) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to create expenses in this group');
        }

        if (!memberIds.includes(validatedExpenseData.paidBy)) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PAYER', 'Payer must be a member of the group');
        }

        // Verify all participants are still in the group (race condition protection)
        for (const participantId of validatedExpenseData.participants) {
            if (!memberIds.includes(participantId)) {
                throw new ApiError(
                    HTTP_STATUS.BAD_REQUEST,
                    'MEMBER_NOT_IN_GROUP',
                    `Cannot create expense - participant ${participantId} is not in the group`,
                );
            }
        }

        // Create the expense document
        const now = new Date().toISOString();

        // Use client-calculated splits (already validated)
        // Client sends splits calculated using currency-aware logic from @splitifyd/shared
        const splits = validatedExpenseData.splits;

        // Generate expense ID early (local operation, no DB call)
        const expenseId = this.firestoreWriter.generateDocumentId(FirestoreCollections.EXPENSES);

        const expense: ExpenseDTO = {
            id: expenseId,
            groupId: validatedExpenseData.groupId,
            createdBy: userId,
            paidBy: validatedExpenseData.paidBy,
            amount: validatedExpenseData.amount,
            currency: validatedExpenseData.currency,
            description: validatedExpenseData.description,
            category: validatedExpenseData.category,
            date: validatedExpenseData.date, // Already ISO string from request
            splitType: validatedExpenseData.splitType,
            participants: validatedExpenseData.participants,
            splits,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            deletedBy: null,
        };

        // Only add receiptUrl if it's defined
        if (validatedExpenseData.receiptUrl !== undefined) {
            expense.receiptUrl = validatedExpenseData.receiptUrl;
        }

        // Use transaction to create expense atomically and update balance
        let createdExpenseRef: IDocumentReference | undefined;
        timer.startPhase('transaction');
        await this.firestoreWriter.runTransaction(async (transaction) => {
            // Re-verify group exists within transaction - using DTO method
            const groupInTx = await this.firestoreReader.getGroupInTransaction(transaction, expenseData.groupId);

            if (!groupInTx) {
                throw Errors.NOT_FOUND('Group');
            }

            // Read current balance BEFORE any writes (Firestore transaction rule)
            const currentBalance = await this.firestoreWriter.getGroupBalanceInTransaction(transaction, expenseData.groupId);

            // Create the expense with the pre-generated ID
            createdExpenseRef = this.firestoreWriter.createInTransaction(
                transaction,
                FirestoreCollections.EXPENSES,
                expenseId, // Use the specific ID we generated
                expense,
            );

            // Update group timestamp to track activity
            await this.firestoreWriter.touchGroup(expenseData.groupId, transaction);

            // Apply incremental balance update
            this.incrementalBalanceService.applyExpenseCreated(transaction, expenseData.groupId, currentBalance, expense, memberIds);
        });
        timer.endPhase();

        // Ensure the expense was created successfully
        if (!createdExpenseRef) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'EXPENSE_CREATION_FAILED', 'Failed to create expense');
        }

        // Set business context for logging
        LoggerContext.setBusinessContext({ groupId: expenseData.groupId, expenseId: createdExpenseRef.id });
        logger.info('expense-created', {
            id: createdExpenseRef.id,
            groupId: expenseData.groupId,
            timings: timer.getTimings(),
        });

        return expense;
    }

    /**
     * Update an existing expense
     */
    async updateExpense(expenseId: string, userId: string, updateData: UpdateExpenseRequest): Promise<ExpenseDTO> {
        return measure.measureDb('ExpenseService.updateExpense', async () => this._updateExpense(expenseId, userId, updateData));
    }

    private async _updateExpense(expenseId: string, userId: string, updateData: UpdateExpenseRequest): Promise<ExpenseDTO> {
        const timer = new PerformanceTimer();

        // Fetch the existing expense
        timer.startPhase('query');
        const expense = await this.fetchExpense(expenseId);

        // Check if expense is locked (any participant has left)
        const isLocked = await this.isExpenseLocked(expense);
        if (isLocked) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'EXPENSE_LOCKED',
                'Cannot edit expense - one or more participants have left the group',
            );
        }

        // Get group data and verify permissions
        const [groupData, memberIds, member] = await Promise.all([
            this.firestoreReader.getGroup(expense.groupId),
            this.firestoreReader.getAllGroupMemberIds(expense.groupId),
            this.firestoreReader.getGroupMember(expense.groupId, userId),
        ]);
        timer.endPhase();

        if (!groupData) {
            throw Errors.NOT_FOUND('Group');
        }
        if (!member) {
            throw Errors.FORBIDDEN();
        }

        // Group is already a GroupDTO from FirestoreReader
        // Check if user can edit expenses in this group
        // Convert expense to ExpenseData format for permission check
        const canEditExpense = PermissionEngineAsync.checkPermission(member!, groupData, userId, 'expenseEditing', { expense: expense });
        if (!canEditExpense) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to edit this expense');
        }

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

        const splitsToValidate = updateData.splits ?? expense.splits;
        const uniqueSplitParticipants = Array.from(new Set(splitsToValidate.map((split) => split.uid)));
        await Promise.all(uniqueSplitParticipants.map(async (splitUid) => {
            if (!memberIds.includes(splitUid)) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PARTICIPANT', `Split participant ${splitUid} is not a member of the group`);
            }
            const memberRecord = await this.firestoreReader.getGroupMember(expense.groupId, splitUid);
            if (!memberRecord) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PARTICIPANT', `Split participant ${splitUid} is not a member of the group`);
            }
        }));

        // Build update object with ISO timestamp
        // Note: updatedAt will be set to current ISO timestamp for optimistic locking
        // FirestoreWriter will convert ISO strings to Timestamps when writing
        const updates: any = {
            ...updateData,
            updatedAt: new Date().toISOString(), // ISO string for DTO
        };

        // Date is already an ISO string from updateData, no conversion needed
        // FirestoreWriter handles ISO → Timestamp conversion

        // Use client-calculated splits if provided (already validated)
        if (updateData.splitType || updateData.participants || updateData.splits || updateData.amount) {
            const splitType = updateData.splitType !== undefined ? updateData.splitType : expense.splitType;
            const splits = updateData.splits !== undefined ? updateData.splits : expense.splits;

            // Client always sends splits calculated using currency-aware logic from @splitifyd/shared
            updates.splits = splits;
            updates.splitType = splitType;
        }

        // Use transaction to update expense atomically with optimistic locking and balance update
        timer.startPhase('transaction');
        await this.firestoreWriter.runTransaction(async (transaction) => {
            // Re-fetch expense within transaction to check for concurrent updates
            // Now using DTO method which returns ISO strings
            const currentExpense = await this.firestoreReader.getExpenseInTransaction(transaction, expenseId);

            if (!currentExpense) {
                throw Errors.NOT_FOUND('Expense');
            }

            // Check if expense was updated since we fetched it (compare ISO strings)
            // Both timestamps are now ISO strings, so we can compare directly
            if (expense.updatedAt !== currentExpense.updatedAt) {
                throw new ApiError(HTTP_STATUS.CONFLICT, 'CONCURRENT_UPDATE', 'Expense was modified by another user. Please refresh and try again.');
            }

            // Read current balance BEFORE any writes (Firestore transaction rule)
            const currentBalance = await this.firestoreWriter.getGroupBalanceInTransaction(transaction, expense.groupId);

            // Create history entry with ISO timestamp
            // Filter out undefined values for Firestore compatibility
            const cleanExpenseData = Object.fromEntries(Object.entries(expense).filter(([, value]) => value !== undefined));

            // Save history and update expense
            // FirestoreWriter will convert ISO strings to Timestamps
            this.firestoreWriter.updateInTransaction(transaction, `${FirestoreCollections.EXPENSES}/${expenseId}`, updates);

            // Update group timestamp to track activity
            await this.firestoreWriter.touchGroup(expense.groupId, transaction);

            // Apply incremental balance update with old and new expense
            const newExpense: ExpenseDTO = { ...expense, ...updates };
            this.incrementalBalanceService.applyExpenseUpdated(transaction, expense.groupId, currentBalance, expense, newExpense, memberIds);
        });

        timer.endPhase();

        // Fetch and return the updated expense
        timer.startPhase('refetch');
        const updatedExpense = await this.firestoreReader.getExpense(expenseId);
        timer.endPhase();

        if (!updatedExpense) {
            throw Errors.NOT_FOUND('Expense');
        }

        // Set business context for logging
        LoggerContext.setBusinessContext({ groupId: expense.groupId, expenseId });
        logger.info('expense-updated', {
            id: expenseId,
            changes: Object.keys(updateData),
            timings: timer.getTimings(),
        });

        // The expense from IFirestoreReader is already validated and includes the ID
        return this.normalizeValidatedExpense(updatedExpense);
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
        return measure.measureDb('ExpenseService.listGroupExpenses', async () => this._listGroupExpenses(groupId, userId, options));
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
        const timer = new PerformanceTimer();

        // Verify user is a member of the group
        timer.startPhase('query');
        const isMember = await this.firestoreReader.verifyGroupMembership(groupId, userId);
        if (!isMember) {
            throw Errors.FORBIDDEN();
        }

        // Use the centralized FirestoreReader method
        const result = await this.firestoreReader.getExpensesForGroupPaginated(groupId, options);

        // Get current member IDs once for all expenses
        const currentMemberIds = await this.firestoreReader.getAllGroupMemberIds(groupId);
        timer.endPhase();

        // Transform the validated expense documents to response format and compute lock status
        const expenses = result.expenses.map((validatedExpense) => {
            const isLocked = validatedExpense.participants.some(
                uid => !currentMemberIds.includes(uid),
            );

            return {
                ...(this.normalizeValidatedExpense(validatedExpense)),
                isLocked,
            };
        });

        logger.info('expenses-listed', {
            groupId,
            count: expenses.length,
            timings: timer.getTimings(),
        });

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
        return measure.measureDb('ExpenseService.deleteExpense', async () => this._deleteExpense(expenseId, userId));
    }

    private async _deleteExpense(expenseId: string, userId: string): Promise<void> {
        const timer = new PerformanceTimer();

        // Fetch the existing expense
        timer.startPhase('query');
        const expense = await this.fetchExpense(expenseId);

        // Get group data and verify permissions
        const [groupData, memberIds, member] = await Promise.all([
            this.firestoreReader.getGroup(expense.groupId),
            this.firestoreReader.getAllGroupMemberIds(expense.groupId),
            this.firestoreReader.getGroupMember(expense.groupId, userId),
        ]);
        timer.endPhase();

        if (!groupData) {
            throw Errors.NOT_FOUND('Group');
        }
        if (!member) {
            throw Errors.FORBIDDEN();
        }

        const canDeleteExpense = PermissionEngineAsync.checkPermission(member!, groupData, userId, 'expenseDeletion', { expense: expense });
        if (!canDeleteExpense) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to delete this expense');
        }

        try {
            // Use transaction to soft delete expense atomically and update balance
            timer.startPhase('transaction');
            await this.firestoreWriter.runTransaction(async (transaction) => {
                // IMPORTANT: All reads must happen before any writes in Firestore transactions

                // Step 1: Do ALL reads first - using DTO methods
                const currentExpense = await this.firestoreReader.getExpenseInTransaction(transaction, expenseId);
                if (!currentExpense) {
                    throw Errors.NOT_FOUND('Expense');
                }

                // Get group doc to ensure it exists (though we already checked above)
                const groupInTx = await this.firestoreReader.getGroupInTransaction(transaction, expense.groupId);
                if (!groupInTx) {
                    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_GROUP', 'Group not found');
                }

                // Read current balance BEFORE any writes (Firestore transaction rule)
                const currentBalance = await this.firestoreWriter.getGroupBalanceInTransaction(transaction, expense.groupId);

                // Step 2: Check for concurrent updates (compare ISO strings)
                if (expense.updatedAt !== currentExpense.updatedAt) {
                    throw Errors.CONCURRENT_UPDATE();
                }

                // Step 3: Now do ALL writes - soft delete the expense
                const now = new Date().toISOString();
                this.firestoreWriter.updateInTransaction(transaction, `${FirestoreCollections.EXPENSES}/${expenseId}`, {
                    [DELETED_AT_FIELD]: now, // ISO string, FirestoreWriter converts to Timestamp
                    deletedBy: userId,
                    updatedAt: now, // ISO string for optimistic locking
                });

                // Update group timestamp to track activity
                await this.firestoreWriter.touchGroup(expense.groupId, transaction);

                // Apply incremental balance update to remove this expense's contribution
                this.incrementalBalanceService.applyExpenseDeleted(transaction, expense.groupId, currentBalance, expense, memberIds);
            });
            timer.endPhase();

            LoggerContext.setBusinessContext({ expenseId });
            logger.info('expense-deleted', {
                id: expenseId,
                timings: timer.getTimings(),
            });
        } catch (error) {
            logger.error('Failed to delete expense', error as Error, {
                expenseId,
                userId,
            });
            throw error;
        }
    }

    /**
     * Get consolidated expense details (expense + group + members)
     * Eliminates race conditions by providing all needed data in one request
     */
    async getExpenseFullDetails(expenseId: string, userId: string): Promise<ExpenseFullDetailsDTO> {
        const timer = new PerformanceTimer();

        // Fetch the expense
        timer.startPhase('query');
        const expense = await this.fetchExpense(expenseId);

        // Get group document for permission check and data
        const groupData = await this.firestoreReader.getGroup(expense.groupId);
        if (!groupData) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        // Check if user is a participant in this expense (only participants can view expense details)
        if (!expense.participants || !expense.participants.includes(userId)) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You are not authorized to view this expense');
        }

        if (!groupData?.name) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Invalid group data');
        }

        // Transform group data using same pattern as groups handler (without deprecated members field)
        // LENIENT: Handle both ISO strings (from DTOs) and Timestamps during transition
        // GroupDTO already has ISO strings from FirestoreReader
        const group: GroupDTO = {
            id: groupData.id,
            name: groupData.name,
            description: groupData.description,
            createdBy: groupData.createdBy,
            createdAt: groupData.createdAt,
            updatedAt: groupData.updatedAt,
            securityPreset: groupData.securityPreset,
            permissions: groupData.permissions,
        };

        // Fetch participant data by UID (works for current AND departed members)
        const participantData = await Promise.all(
            expense.participants.map((uid) => this.fetchParticipantData(expense.groupId, uid)),
        );

        const isLocked = await this.isExpenseLocked(expense);
        timer.endPhase();

        // Format expense response
        logger.info('expense-full-details-retrieved', {
            expenseId,
            groupId: expense.groupId,
            timings: timer.getTimings(),
        });

        return {
            expense: {
                ...(expense),
                isLocked,
            },
            group,
            members: { members: participantData }, // Wrap in object to match ExpenseFullDetailsDTO.members structure
        };
    }
}

// ServiceRegistry handles service instantiation
