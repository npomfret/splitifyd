import {
    ActivityFeedActions,
    ActivityFeedEventTypes,
    CreateExpenseRequest,
    DELETED_AT_FIELD,
    ExpenseDTO,
    ExpenseFullDetailsDTO,
    ExpenseId,
    ExpenseLabel,
    GroupDTO,
    GroupId,
    ISOString,
    toExpenseId,
    toISOString,
    UpdateExpenseRequest,
    UserId,
} from '@billsplit-wl/shared';
import { FirestoreCollections } from '../constants';
import { ErrorDetail, Errors } from '../errors';
import * as expenseValidation from '../expenses/validation';
import type { IDocumentReference } from '../firestore-wrapper';
import { logger, LoggerContext } from '../logger';
import * as measure from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import { PermissionEngineAsync } from '../permissions/permission-engine-async';
import { ActivityFeedService, CreateActivityItemInput } from './ActivityFeedService';
import { IncrementalBalanceService } from './balance/IncrementalBalanceService';
import type { IFirestoreReader, IFirestoreWriter } from './firestore';
import { GroupMemberService } from './GroupMemberService';
import { UserService } from './UserService2';

/**
 * Service for managing expenses
 */

export class ExpenseService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly incrementalBalanceService: IncrementalBalanceService,
        private readonly activityFeedService: ActivityFeedService,
        private readonly userService: UserService,
        private readonly groupMemberService: GroupMemberService,
    ) {}

    /**
     * Fetch and validate an expense document
     * @param includeSoftDeleted - If true, returns soft-deleted expenses (needed to check supersededBy before throwing NOT_FOUND)
     */
    private async fetchExpense(expenseId: ExpenseId, includeSoftDeleted = false): Promise<ExpenseDTO> {
        // Use FirestoreReader for read operation - pass includeSoftDeleted to bypass soft-delete filter
        const expenseData = await this.firestoreReader.getExpense(expenseId, { includeSoftDeleted });

        if (!expenseData) {
            throw Errors.notFound('Expense', ErrorDetail.EXPENSE_NOT_FOUND);
        }

        // Data already validated by FirestoreReader - it's an ExpenseDTO with ISO strings
        const expense: ExpenseDTO = {
            ...expenseData,
            receiptUrl: expenseData.receiptUrl || undefined,
        };

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
     * Check if expense is locked due to departed members
     * An expense is locked if any participant is no longer in the group
     */
    private async isExpenseLocked(expense: ExpenseDTO): Promise<boolean> {
        const currentMemberIds = await this.firestoreReader.getAllGroupMemberIds(expense.groupId);
        return expense.participants.some(uid => !currentMemberIds.includes(uid));
    }

    /**
     * Build updated recentlyUsedLabels map with new labels and 50-entry pruning
     * @param existingLabels - Current recentlyUsedLabels from the group (may be undefined)
     * @param newLabels - Labels from the expense being created/updated
     * @param timestamp - ISO timestamp to set for each new label
     * @returns Updated recentlyUsedLabels map, limited to 50 most recent entries
     */
    private buildUpdatedRecentlyUsedLabels(
        existingLabels: Record<ExpenseLabel, ISOString> | undefined,
        newLabels: ExpenseLabel[],
        timestamp: ISOString,
    ): Record<ExpenseLabel, ISOString> {
        if (newLabels.length === 0) {
            return existingLabels ?? ({} as Record<ExpenseLabel, ISOString>);
        }

        const merged: Record<ExpenseLabel, ISOString> = { ...(existingLabels ?? {}) } as Record<ExpenseLabel, ISOString>;

        for (const label of newLabels) {
            merged[label] = timestamp;
        }

        const entries = Object.entries(merged) as [ExpenseLabel, ISOString][];
        if (entries.length <= 50) {
            return merged;
        }

        entries.sort((a, b) => b[1].localeCompare(a[1]));
        const pruned = entries.slice(0, 50);
        return Object.fromEntries(pruned) as Record<ExpenseLabel, ISOString>;
    }

    /**
     * Get a single expense by ID
     */
    async getExpense(expenseId: ExpenseId, userId: UserId): Promise<ExpenseDTO> {
        return measure.measureDb('ExpenseService.getExpense', async () => this._getExpense(expenseId, userId));
    }

    private async _getExpense(expenseId: ExpenseId, userId: UserId): Promise<ExpenseDTO> {
        const timer = new PerformanceTimer();

        timer.startPhase('query');
        const expense = await this.fetchExpense(expenseId);

        // Verify user is a member of the group that owns this expense
        const isMember = await this.firestoreReader.verifyGroupMembership(expense.groupId, userId);
        if (!isMember) {
            throw Errors.notFound('Expense', ErrorDetail.EXPENSE_NOT_FOUND);
        }
        timer.endPhase();

        // Compute lock status - userReactions are now denormalized on the expense document
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
    async createExpense(userId: UserId, expenseData: CreateExpenseRequest): Promise<ExpenseDTO> {
        return measure.measureDb('ExpenseService.createExpense', async () => this._createExpense(userId, expenseData));
    }

    private async _createExpense(userId: UserId, requestData: CreateExpenseRequest): Promise<ExpenseDTO> {
        const timer = new PerformanceTimer();

        // Validate the input data early
        const validatedExpenseData = expenseValidation.validateCreateExpense(requestData);

        // Parallelize all pre-transaction reads for maximum performance
        timer.startPhase('query');
        const {
            group,
            memberIds,
            actorMember,
        } = await this.groupMemberService.getGroupAccessContext(validatedExpenseData.groupId, userId);
        timer.endPhase();

        // Check if user can create expenses in this group
        const canCreateExpense = PermissionEngineAsync.checkPermission(actorMember, group, userId, 'expenseEditing');
        if (!canCreateExpense) {
            throw Errors.forbidden(ErrorDetail.INSUFFICIENT_PERMISSIONS);
        }

        // Check if currency is permitted by group settings
        if (group.currencySettings?.permitted) {
            if (!group.currencySettings.permitted.includes(validatedExpenseData.currency)) {
                throw Errors.forbidden(ErrorDetail.CURRENCY_NOT_PERMITTED);
            }
        }

        if (!memberIds.includes(validatedExpenseData.paidBy)) {
            throw Errors.validationError('paidBy', ErrorDetail.INVALID_PAYER);
        }

        // Verify all participants are still in the group (race condition protection)
        for (const participantId of validatedExpenseData.participants) {
            if (!memberIds.includes(participantId)) {
                throw Errors.validationError('participants', ErrorDetail.INVALID_PARTICIPANT);
            }
        }

        // Create the expense document
        const now = toISOString(new Date().toISOString());

        // Use client-calculated splits (already validated)
        // Client sends splits calculated using currency-aware logic from @billsplit-wl/shared
        const splits = validatedExpenseData.splits;

        // Generate expense ID early (local operation, no DB call)
        const expenseId = toExpenseId(this.firestoreWriter.generateDocumentId(FirestoreCollections.EXPENSES));

        // Data to store in Firestore (without computed fields like isLocked)
        const expenseData: Omit<ExpenseDTO, 'isLocked'> = {
            id: expenseId,
            groupId: validatedExpenseData.groupId,
            createdBy: userId,
            paidBy: validatedExpenseData.paidBy,
            amount: validatedExpenseData.amount,
            currency: validatedExpenseData.currency,
            description: validatedExpenseData.description,
            labels: validatedExpenseData.labels,
            date: validatedExpenseData.date, // Already ISO string from request
            splitType: validatedExpenseData.splitType,
            participants: validatedExpenseData.participants,
            splits,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            deletedBy: null,
            supersededBy: null,
        };

        // Only add receiptUrl if it's defined
        if (validatedExpenseData.receiptUrl !== undefined) {
            expenseData.receiptUrl = validatedExpenseData.receiptUrl;
        }

        // Only add location if it's defined
        if (validatedExpenseData.location !== undefined) {
            expenseData.location = validatedExpenseData.location;
        }

        // Use transaction to create expense atomically and update balance
        let createdExpenseRef: IDocumentReference | undefined;
        let activityItem: CreateActivityItemInput | null = null;
        let activityRecipients: UserId[] = [];

        timer.startPhase('transaction');
        await this.firestoreWriter.runTransaction(async (transaction) => {
            // ===== READ PHASE: All reads must happen before any writes =====

            timer.startPhase('transaction:getGroup');
            // Re-verify group exists within transaction - using DTO method
            const groupInTx = await this.firestoreReader.getGroupInTransaction(transaction, expenseData.groupId);

            if (!groupInTx) {
                throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
            }
            timer.endPhase();

            timer.startPhase('transaction:getBalance');
            // Read current balance BEFORE any writes (Firestore transaction rule)
            const currentBalance = await this.firestoreWriter.getGroupBalanceInTransaction(transaction, expenseData.groupId);
            timer.endPhase();

            // Preload membership refs for touchGroup (must be read before writes)
            const membershipRefs = await this.firestoreReader.getMembershipRefsInTransaction(transaction, expenseData.groupId);

            // ===== WRITE PHASE: All writes happen after reads =====

            timer.startPhase('transaction:createExpense');
            // Create the expense with the pre-generated ID
            createdExpenseRef = this.firestoreWriter.createInTransaction(
                transaction,
                FirestoreCollections.EXPENSES,
                expenseId, // Use the specific ID we generated
                expenseData,
            );
            timer.endPhase();

            // Update group's recentlyUsedLabels if expense has labels
            if (expenseData.labels.length > 0) {
                timer.startPhase('transaction:updateLabels');
                const updatedLabels = this.buildUpdatedRecentlyUsedLabels(
                    groupInTx.recentlyUsedLabels,
                    expenseData.labels,
                    now,
                );
                this.firestoreWriter.updateInTransaction(
                    transaction,
                    `${FirestoreCollections.GROUPS}/${expenseData.groupId}`,
                    { recentlyUsedLabels: updatedLabels },
                );
                timer.endPhase();
            }

            timer.startPhase('transaction:touchGroup');
            // Update group timestamp to track activity
            await this.firestoreWriter.touchGroupWithPreloadedRefs(
                expenseData.groupId,
                transaction,
                membershipRefs.map((m) => m.ref),
            );
            timer.endPhase();

            timer.startPhase('transaction:applyBalance');
            // Apply incremental balance update (needs isLocked for type compatibility)
            const expenseForBalance: ExpenseDTO = { ...expenseData, isLocked: false };
            this.incrementalBalanceService.applyExpenseCreated(transaction, expenseData.groupId, currentBalance, expenseForBalance, memberIds);
            timer.endPhase();

            timer.startPhase('transaction:buildActivityItem');
            // Build activity item - will be recorded AFTER transaction commits
            activityItem = this.activityFeedService.buildGroupActivityItem({
                groupId: expenseData.groupId,
                groupName: groupInTx.name,
                eventType: ActivityFeedEventTypes.EXPENSE_CREATED,
                action: ActivityFeedActions.CREATE,
                actorId: userId,
                actorName: actorMember.groupDisplayName,
                timestamp: now,
                details: this.activityFeedService.buildDetails({
                    expense: {
                        id: expenseId,
                        description: expenseData.description,
                    },
                }),
            });
            activityRecipients = memberIds;
            timer.endPhase();
        });
        timer.endPhase();

        // Record activity feed AFTER transaction commits (fire-and-forget)
        if (activityItem && activityRecipients.length > 0) {
            await this.activityFeedService.recordActivityForUsers(activityRecipients, activityItem).catch(() => {
                // Already logged in recordActivityForUsers, just catch to prevent unhandled rejection
            });
        }

        // Ensure the expense was created successfully
        if (!createdExpenseRef) {
            throw Errors.serviceError(ErrorDetail.CREATION_FAILED);
        }

        // Set business context for logging
        LoggerContext.setBusinessContext({ groupId: expenseData.groupId, expenseId: createdExpenseRef.id });
        logger.info('expense-created', {
            id: createdExpenseRef.id,
            groupId: expenseData.groupId,
            timings: timer.getTimings(),
        });

        // Build the complete ExpenseDTO with computed isLocked field
        const expenseWithLock: ExpenseDTO = { ...expenseData, isLocked: false };
        const expense: ExpenseDTO = {
            ...expenseData,
            isLocked: await this.isExpenseLocked(expenseWithLock),
        };

        return expense;
    }

    /**
     * Update an existing expense
     */
    async updateExpense(expenseId: ExpenseId, userId: UserId, updateData: UpdateExpenseRequest): Promise<ExpenseDTO> {
        return measure.measureDb('ExpenseService.updateExpense', async () => this._updateExpense(expenseId, userId, updateData));
    }

    private async _updateExpense(expenseId: ExpenseId, userId: UserId, updateData: UpdateExpenseRequest): Promise<ExpenseDTO> {
        const timer = new PerformanceTimer();

        // Fetch the existing expense
        timer.startPhase('query');
        const oldExpense = await this.fetchExpense(expenseId);

        // Check if expense is locked (any participant has left)
        const isLocked = await this.isExpenseLocked(oldExpense);
        if (isLocked) {
            throw Errors.invalidRequest('EXPENSE_LOCKED');
        }

        // Get group data and verify permissions
        const {
            group,
            memberIds,
            actorMember,
        } = await this.groupMemberService.getGroupAccessContext(oldExpense.groupId, userId);
        timer.endPhase();

        // Group is already a GroupDTO from FirestoreReader
        // Check if user can edit expenses in this group
        // Convert expense to ExpenseData format for permission check
        const canEditExpense = PermissionEngineAsync.checkPermission(actorMember, group, userId, 'expenseEditing', { expense: oldExpense });
        if (!canEditExpense) {
            throw Errors.forbidden(ErrorDetail.INSUFFICIENT_PERMISSIONS);
        }

        // Check if the new currency is permitted by group settings (if changing currency)
        if (updateData.currency && group.currencySettings?.permitted) {
            if (!group.currencySettings.permitted.includes(updateData.currency)) {
                throw Errors.forbidden(ErrorDetail.CURRENCY_NOT_PERMITTED);
            }
        }

        if (updateData.paidBy && !memberIds.includes(updateData.paidBy)) {
            throw Errors.validationError('paidBy', ErrorDetail.INVALID_PAYER);
        }

        if (updateData.participants) {
            for (const participantId of updateData.participants) {
                if (!memberIds.includes(participantId)) {
                    throw Errors.validationError('participants', ErrorDetail.INVALID_PARTICIPANT);
                }
            }
        }

        const splitsToValidate = updateData.splits ?? oldExpense.splits;
        const uniqueSplitParticipants = Array.from(new Set(splitsToValidate.map((split) => split.uid)));

        // First check all participants are in the memberIds list
        for (const splitUid of uniqueSplitParticipants) {
            if (!memberIds.includes(splitUid)) {
                throw Errors.validationError('splits', ErrorDetail.INVALID_PARTICIPANT);
            }
        }

        // Batch fetch all member records in single round trip
        const memberRecords = await this.firestoreReader.getGroupMembers(oldExpense.groupId, uniqueSplitParticipants);
        for (const splitUid of uniqueSplitParticipants) {
            if (!memberRecords.has(splitUid)) {
                throw Errors.validationError('splits', ErrorDetail.INVALID_PARTICIPANT);
            }
        }

        // Generate new expense ID for the updated version
        const newExpenseId = toExpenseId(this.firestoreWriter.generateDocumentId(FirestoreCollections.EXPENSES));
        const now = toISOString(new Date().toISOString());

        // Build the new expense data (merging old expense with updates)
        const splits = updateData.splits !== undefined ? updateData.splits : oldExpense.splits;
        const splitType = updateData.splitType !== undefined ? updateData.splitType : oldExpense.splitType;

        const newExpenseData: Omit<ExpenseDTO, 'isLocked'> = {
            id: newExpenseId,
            groupId: oldExpense.groupId,
            createdBy: oldExpense.createdBy, // Preserve original creator
            paidBy: updateData.paidBy ?? oldExpense.paidBy,
            amount: updateData.amount ?? oldExpense.amount,
            currency: updateData.currency ?? oldExpense.currency,
            description: updateData.description ?? oldExpense.description,
            labels: updateData.labels ?? oldExpense.labels,
            date: updateData.date ?? oldExpense.date,
            splitType,
            participants: updateData.participants ?? oldExpense.participants,
            splits,
            receiptUrl: updateData.receiptUrl !== undefined ? updateData.receiptUrl : oldExpense.receiptUrl,
            location: updateData.location !== undefined ? updateData.location : oldExpense.location,
            createdAt: now, // New version gets new creation timestamp
            updatedAt: now,
            deletedAt: null,
            deletedBy: null,
            supersededBy: null,
        };

        // Declare variables outside transaction for activity feed
        let activityItem: CreateActivityItemInput | null = null;
        let activityRecipients: UserId[] = [];

        // Use transaction to soft-delete old expense and create new one atomically
        timer.startPhase('transaction');
        await this.firestoreWriter.runTransaction(async (transaction) => {
            // ===== READ PHASE: All reads must happen before any writes =====

            // Re-fetch expense within transaction to check for concurrent updates
            const currentExpense = await this.firestoreReader.getExpenseInTransaction(transaction, expenseId);

            if (!currentExpense) {
                throw Errors.notFound('Expense', ErrorDetail.EXPENSE_NOT_FOUND);
            }

            // Check if expense was updated since we fetched it (compare ISO strings)
            if (oldExpense.updatedAt !== currentExpense.updatedAt) {
                throw Errors.conflict(ErrorDetail.CONCURRENT_UPDATE);
            }

            // Read current balance BEFORE any writes (Firestore transaction rule)
            const currentBalance = await this.firestoreWriter.getGroupBalanceInTransaction(transaction, oldExpense.groupId);

            // Preload membership refs for touchGroup (must be read before writes)
            const membershipRefs = await this.firestoreReader.getMembershipRefsInTransaction(transaction, oldExpense.groupId);

            // Read group to get recentlyUsedLabels for update
            const groupInTx = await this.firestoreReader.getGroupInTransaction(transaction, oldExpense.groupId);
            if (!groupInTx) {
                throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
            }

            // ===== WRITE PHASE: All writes happen after reads =====

            // 1. Soft-delete old expense and link to new version via supersededBy
            this.firestoreWriter.updateInTransaction(transaction, `${FirestoreCollections.EXPENSES}/${expenseId}`, {
                supersededBy: newExpenseId,
                deletedAt: now,
                deletedBy: userId,
                updatedAt: now,
            });

            // 2. Create new expense document
            this.firestoreWriter.createInTransaction(
                transaction,
                FirestoreCollections.EXPENSES,
                newExpenseId,
                newExpenseData,
            );

            // 3. Update group's recentlyUsedLabels if expense has labels
            if (newExpenseData.labels.length > 0) {
                const updatedLabels = this.buildUpdatedRecentlyUsedLabels(
                    groupInTx.recentlyUsedLabels,
                    newExpenseData.labels,
                    now,
                );
                this.firestoreWriter.updateInTransaction(
                    transaction,
                    `${FirestoreCollections.GROUPS}/${oldExpense.groupId}`,
                    { recentlyUsedLabels: updatedLabels },
                );
            }

            // Update group timestamp to track activity
            await this.firestoreWriter.touchGroupWithPreloadedRefs(
                oldExpense.groupId,
                transaction,
                membershipRefs.map((m) => m.ref),
            );

            // Apply incremental balance update with old and new expense
            const newExpenseForBalance: ExpenseDTO = { ...newExpenseData, isLocked: false };
            this.incrementalBalanceService.applyExpenseUpdated(transaction, oldExpense.groupId, currentBalance, oldExpense, newExpenseForBalance, memberIds);

            // Build activity item - will be recorded AFTER transaction commits
            activityItem = this.activityFeedService.buildGroupActivityItem({
                groupId: oldExpense.groupId,
                groupName: group.name,
                eventType: ActivityFeedEventTypes.EXPENSE_UPDATED,
                action: ActivityFeedActions.UPDATE,
                actorId: userId,
                actorName: actorMember.groupDisplayName,
                timestamp: now,
                details: this.activityFeedService.buildDetails({
                    expense: {
                        id: newExpenseId, // Reference the new expense
                        description: newExpenseData.description,
                    },
                }),
            });
            activityRecipients = memberIds;
        });

        timer.endPhase();

        // Record activity feed AFTER transaction commits (fire-and-forget)
        if (activityItem && activityRecipients.length > 0) {
            await this.activityFeedService.recordActivityForUsers(activityRecipients, activityItem).catch(() => {
                // Already logged in recordActivityForUsers, just catch to prevent unhandled rejection
            });
        }

        // Set business context for logging
        LoggerContext.setBusinessContext({ groupId: oldExpense.groupId, expenseId: newExpenseId });
        logger.info('expense-updated', {
            oldId: expenseId,
            newId: newExpenseId,
            changes: Object.keys(updateData),
            timings: timer.getTimings(),
        });

        // Build the complete ExpenseDTO with computed isLocked field
        const newExpenseWithLock: ExpenseDTO = { ...newExpenseData, isLocked: false };
        const expense: ExpenseDTO = {
            ...newExpenseData,
            isLocked: await this.isExpenseLocked(newExpenseWithLock),
        };

        return expense;
    }

    /**
     * List expenses for a group with pagination
     */
    async listGroupExpenses(
        groupId: GroupId,
        userId: UserId,
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
        groupId: GroupId,
        userId: UserId,
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
            throw Errors.forbidden(ErrorDetail.NOT_GROUP_MEMBER);
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
    async deleteExpense(expenseId: ExpenseId, userId: UserId): Promise<void> {
        return measure.measureDb('ExpenseService.deleteExpense', async () => this._deleteExpense(expenseId, userId));
    }

    private async _deleteExpense(expenseId: ExpenseId, userId: UserId): Promise<void> {
        const timer = new PerformanceTimer();

        // Fetch the existing expense (include soft-deleted to check supersededBy before throwing NOT_FOUND)
        timer.startPhase('query');
        const expense = await this.fetchExpense(expenseId, true);

        // Prevent deletion of superseded expenses (they're already archived via edit history)
        // This check MUST come before the deletedAt check to return the correct error
        if (expense.supersededBy !== null) {
            throw Errors.invalidRequest('CANNOT_DELETE_SUPERSEDED');
        }

        // If the expense is already soft-deleted (user-initiated deletion), return NOT_FOUND
        if (expense.deletedAt) {
            throw Errors.notFound('Expense', ErrorDetail.EXPENSE_NOT_FOUND);
        }

        // Get group data and verify permissions
        const {
            group,
            memberIds,
            actorMember,
        } = await this.groupMemberService.getGroupAccessContext(expense.groupId, userId);
        timer.endPhase();

        const canDeleteExpense = PermissionEngineAsync.checkPermission(actorMember, group, userId, 'expenseDeletion', { expense: expense });
        if (!canDeleteExpense) {
            throw Errors.forbidden(ErrorDetail.INSUFFICIENT_PERMISSIONS);
        }

        // Declare variables outside transaction for activity feed
        let activityItem: CreateActivityItemInput | null = null;
        let activityRecipients: UserId[] = [];

        try {
            // Use transaction to soft delete expense atomically and update balance
            timer.startPhase('transaction');
            await this.firestoreWriter.runTransaction(async (transaction) => {
                // ===== READ PHASE: All reads must happen before any writes =====

                // Do ALL reads first - using DTO methods
                const currentExpense = await this.firestoreReader.getExpenseInTransaction(transaction, expenseId);
                if (!currentExpense) {
                    throw Errors.notFound('Expense', ErrorDetail.EXPENSE_NOT_FOUND);
                }

                // Get group doc to ensure it exists (though we already checked above)
                const groupInTx = await this.firestoreReader.getGroupInTransaction(transaction, expense.groupId);
                if (!groupInTx) {
                    throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
                }

                // Read current balance BEFORE any writes (Firestore transaction rule)
                const currentBalance = await this.firestoreWriter.getGroupBalanceInTransaction(transaction, expense.groupId);

                // Check for concurrent updates (compare ISO strings)
                if (expense.updatedAt !== currentExpense.updatedAt) {
                    throw Errors.conflict(ErrorDetail.CONCURRENT_UPDATE);
                }

                // Preload membership refs for touchGroup (must be read before writes)
                const membershipRefs = await this.firestoreReader.getMembershipRefsInTransaction(transaction, expense.groupId);

                // ===== WRITE PHASE: All writes happen after reads =====

                // Soft delete the expense
                const now = toISOString(new Date().toISOString());
                this.firestoreWriter.updateInTransaction(transaction, `${FirestoreCollections.EXPENSES}/${expenseId}`, {
                    [DELETED_AT_FIELD]: now, // ISO string, FirestoreWriter converts to Timestamp
                    deletedBy: userId,
                    updatedAt: now, // ISO string for optimistic locking
                });

                // Update group timestamp to track activity
                await this.firestoreWriter.touchGroupWithPreloadedRefs(
                    expense.groupId,
                    transaction,
                    membershipRefs.map((m) => m.ref),
                );

                // Apply incremental balance update to remove this expense's contribution
                this.incrementalBalanceService.applyExpenseDeleted(transaction, expense.groupId, currentBalance, expense, memberIds);

                // Build activity item - will be recorded AFTER transaction commits
                activityItem = this.activityFeedService.buildGroupActivityItem({
                    groupId: expense.groupId,
                    groupName: groupInTx.name,
                    eventType: ActivityFeedEventTypes.EXPENSE_DELETED,
                    action: ActivityFeedActions.DELETE,
                    actorId: userId,
                    actorName: actorMember.groupDisplayName,
                    timestamp: now,
                    details: this.activityFeedService.buildDetails({
                        expense: {
                            id: expenseId,
                            description: expense.description,
                        },
                    }),
                });
                activityRecipients = memberIds;
            });
            timer.endPhase();

            // Record activity feed AFTER transaction commits (fire-and-forget)
            if (activityItem && activityRecipients.length > 0) {
                await this.activityFeedService.recordActivityForUsers(activityRecipients, activityItem).catch(() => {
                    // Already logged in recordActivityForUsers, just catch to prevent unhandled rejection
                });
            }

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
    async getExpenseFullDetails(expenseId: ExpenseId, userId: UserId): Promise<ExpenseFullDetailsDTO> {
        const timer = new PerformanceTimer();

        // Fetch the expense
        timer.startPhase('query');
        const expense = await this.fetchExpense(expenseId);

        // Get group document for permission check and data
        const groupId = expense.groupId;
        const groupData = await this.firestoreReader.getGroup(groupId);
        if (!groupData) {
            throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
        }

        if (!groupData?.name) {
            throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
        }

        // Verify user is a member of the group that owns this expense
        const isMember = await this.firestoreReader.verifyGroupMembership(groupId, userId);
        if (!isMember) {
            throw Errors.notFound('Expense', ErrorDetail.EXPENSE_NOT_FOUND);
        }

        // Transform group data using same pattern as groups handler (without deprecated members field)
        // LENIENT: Handle both ISO strings (from DTOs) and Timestamps during transition
        // GroupDTO already has ISO strings from FirestoreReader
        const group: GroupDTO = {
            id: groupData.id,
            name: groupData.name,
            description: groupData.description,
            createdAt: groupData.createdAt,
            updatedAt: groupData.updatedAt,
            permissions: groupData.permissions,
            locked: groupData.locked ?? false,
            deletedAt: groupData.deletedAt ?? null,
        };

        // Fetch participant data by UID (works for current AND departed members)
        const userIds = expense.participants;
        const participantData = await this.userService.resolveGroupMemberProfiles(groupId, userIds);

        // Compute lock status - userReactions are now denormalized on the expense document
        const isLocked = await this.isExpenseLocked(expense);
        timer.endPhase();

        // Format expense response
        logger.info('expense-full-details-retrieved', {
            expenseId,
            groupId: groupId,
            timings: timer.getTimings(),
        });

        return {
            expense: {
                ...expense,
                isLocked,
            },
            group,
            members: { members: participantData }, // Wrap in object to match ExpenseFullDetailsDTO.members structure
        };
    }
}

// ServiceRegistry handles service instantiation
