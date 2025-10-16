import {
    Amount,
    amountToSmallestUnit,
    CreateGroupRequest,
    GroupDTO,
    GroupFullDetailsDTO,
    ListGroupsResponse,
    MemberRoles,
    MemberStatuses,
    MessageResponse,
    SecurityPresets,
    smallestUnitToAmountString,
    UpdateGroupRequest,
} from '@splitifyd/shared';
import { BalanceDisplaySchema, CurrencyBalanceDisplaySchema, GroupBalances } from '@splitifyd/shared';
import { CreateGroupRequestBuilder } from '@splitifyd/test-support';
import { DOCUMENT_CONFIG, FIRESTORE, FirestoreCollections } from '../constants';
import { logger, LoggerContext } from '../logger';
import * as measure from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import { PermissionEngine } from '../permissions';
import { GroupBalanceDTO } from '../schemas';
import * as dateHelpers from '../utils/dateHelpers';
import { Errors } from '../utils/errors';
import { getTopLevelMembershipDocId } from '../utils/groupMembershipHelpers';
import { ExpenseService } from './ExpenseService';
import type { GetGroupsForUserOptions, IFirestoreReader, IFirestoreWriter } from './firestore';
import { GroupMemberService } from './GroupMemberService';
import { GroupShareService } from './GroupShareService';
import { NotificationService } from './notification-service';
import { SettlementService } from './SettlementService';
import { UserService } from './UserService2';

/**
 * Service for managing group operations
 */
export class GroupService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly userService: UserService,
        private readonly expenseService: ExpenseService,
        private readonly settlementService: SettlementService,
        private readonly groupMemberService: GroupMemberService,
        private readonly notificationService: NotificationService,
        private readonly groupShareService: GroupShareService,
    ) {}

    /**
     * Add computed fields to Group (balance, last activity)
     * Now reads pre-computed balance from Firestore instead of calculating on-the-fly
     */
    private async addComputedFields(group: GroupDTO, userId: string): Promise<GroupDTO> {
        // Read pre-computed balance from Firestore (O(1) read vs O(N) calculation)
        const groupBalance = await this.firestoreReader.getGroupBalance(group.id);

        // Use group.updatedAt for last activity (updated by touchGroup() on any group activity)
        const lastActivity = this.formatRelativeTime(group.updatedAt);

        // Calculate currency-specific balances for current user with proper typing
        const balancesByCurrency: Record<
            string,
            {
                currency: string;
                netBalance: Amount;
                totalOwed: Amount;
                totalOwing: Amount;
            }
        > = {};

        if (groupBalance.balancesByCurrency) {
            for (const [currency, currencyBalances] of Object.entries(groupBalance.balancesByCurrency)) {
                const currencyUserBalance = currencyBalances[userId];
                if (currencyUserBalance) {
                    const netBalanceUnits = amountToSmallestUnit(currencyUserBalance.netBalance, currency);
                    if (netBalanceUnits === 0) {
                        continue;
                    }

                    const totalOwedUnits = netBalanceUnits > 0 ? netBalanceUnits : 0;
                    const totalOwingUnits = netBalanceUnits < 0 ? Math.abs(netBalanceUnits) : 0;

                    const currencyDisplayData = {
                        currency,
                        netBalance: smallestUnitToAmountString(netBalanceUnits, currency),
                        totalOwed: smallestUnitToAmountString(totalOwedUnits, currency),
                        totalOwing: smallestUnitToAmountString(totalOwingUnits, currency),
                    };

                    // Validate the currency display data structure
                    const validatedCurrencyData = CurrencyBalanceDisplaySchema.parse(currencyDisplayData);
                    balancesByCurrency[currency] = validatedCurrencyData;
                }
            }
        }

        // Create and validate the complete balance display data
        const balanceDisplay = { balancesByCurrency };
        const validatedBalanceDisplay = BalanceDisplaySchema.parse(balanceDisplay);

        return {
            ...group,
            balance: validatedBalanceDisplay,
            lastActivity,
        };
    }

    /**
     * Fetch a group and verify user access
     */
    private async fetchGroupWithAccess(groupId: string, userId: string, requireWriteAccess: boolean = false): Promise<{ group: GroupDTO; }> {
        const group = await this.firestoreReader.getGroup(groupId);

        if (!group) {
            throw Errors.NOT_FOUND('Group');
        }

        // FirestoreReader already returns a GroupDTO with ISO strings - no conversion needed

        // Check if user is the owner
        if (await this.groupMemberService.isGroupOwnerAsync(group.id, userId)) {
            const groupWithComputed = await this.addComputedFields(group, userId);
            return { group: groupWithComputed };
        }

        // For write operations, only the owner is allowed
        if (requireWriteAccess) {
            throw Errors.FORBIDDEN();
        }

        // For read operations, check if user is a member
        if (await this.groupMemberService.isGroupMemberAsync(group.id, userId)) {
            const groupWithComputed = await this.addComputedFields(group, userId);
            return { group: groupWithComputed };
        }

        // User doesn't have access to this group
        // SECURITY: Return 404 instead of 403 to prevent information disclosure.
        // This prevents attackers from enumerating valid group IDs.
        throw Errors.NOT_FOUND('Group');
    }

    /**
     * Format a date as relative time (e.g., "2 hours ago")
     */
    private formatRelativeTime(dateStr: string): string {
        const timestamp = dateHelpers.parseISOToTimestamp(dateStr);
        if (!timestamp) {
            return 'unknown';
        }
        return dateHelpers.getRelativeTime(timestamp);
    }

    /**
     * Calculate totalOwed and totalOwing from netBalance
     */
    private calculateBalanceBreakdown(netBalance: Amount, currency: string): { netBalance: Amount; totalOwed: Amount; totalOwing: Amount; } {
        const netBalanceUnits = amountToSmallestUnit(netBalance, currency);
        const totalOwedUnits = netBalanceUnits > 0 ? netBalanceUnits : 0;
        const totalOwingUnits = netBalanceUnits < 0 ? Math.abs(netBalanceUnits) : 0;

        return {
            netBalance: smallestUnitToAmountString(netBalanceUnits, currency),
            totalOwed: smallestUnitToAmountString(totalOwedUnits, currency),
            totalOwing: smallestUnitToAmountString(totalOwingUnits, currency),
        };
    }

    /**
     * Enrich a group with balance information and last activity timestamp
     */
    private enrichGroupWithBalance(group: GroupDTO, groupBalances: GroupBalanceDTO, userId: string): GroupDTO {
        // Calculate currency-specific balances with proper typing
        const balancesByCurrency: Record<
            string,
            {
                currency: string;
                netBalance: Amount;
                totalOwed: Amount;
                totalOwing: Amount;
            }
        > = {};

        if (groupBalances.balancesByCurrency) {
            // groupBalances is already validated by GroupBalanceDTO from getGroupBalance()
            for (const [currency, currencyBalances] of Object.entries(groupBalances.balancesByCurrency)) {
                const currencyUserBalance = currencyBalances[userId];
                if (currencyUserBalance) {
                    const netBalanceUnits = amountToSmallestUnit(currencyUserBalance.netBalance, currency);
                    if (netBalanceUnits === 0) {
                        continue;
                    }

                    const currencyDisplayData = {
                        currency,
                        ...this.calculateBalanceBreakdown(currencyUserBalance.netBalance, currency),
                    };

                    // Validate the currency display data structure
                    const validatedCurrencyData = CurrencyBalanceDisplaySchema.parse(currencyDisplayData);
                    balancesByCurrency[currency] = validatedCurrencyData;
                }
            }
        }

        // Format last activity using group's updatedAt timestamp
        const lastActivity = this.formatRelativeTime(new Date(group.updatedAt).toISOString());

        // Create and validate the complete balance display data
        const balanceDisplay = { balancesByCurrency };
        const validatedBalanceDisplay = BalanceDisplaySchema.parse(balanceDisplay);

        return {
            ...group,
            balance: validatedBalanceDisplay,
            lastActivity,
        };
    }

    /**
     * List all groups for a user with pagination and balance information
     * PERFORMANCE OPTIMIZED: Batches database operations to prevent N+1 queries
     */
    async listGroups(userId: string, options: GetGroupsForUserOptions = {}): Promise<ListGroupsResponse> {
        return measure.measureDb('list-groups', async () => {
            return this._executeListGroups(userId, options);
        });
    }

    private async _executeListGroups(userId: string, options: GetGroupsForUserOptions = {}): Promise<ListGroupsResponse> {
        const timer = new PerformanceTimer();

        // Parse options with defaults
        const limit = Math.min(options.limit || DOCUMENT_CONFIG.LIST_LIMIT, DOCUMENT_CONFIG.LIST_LIMIT);
        const orderBy = options.orderBy ?? { field: 'updatedAt', direction: 'desc' as const };

        // Step 1: Query groups and metadata using FirestoreReader
        timer.startPhase('query');
        const paginatedGroups = await this.firestoreReader.getGroupsForUserV2(userId, {
            limit,
            cursor: options.cursor,
            orderBy,
        });
        timer.endPhase();

        // Step 2: Fetch balances and enrich groups in parallel
        timer.startPhase('balances');
        const groupsWithBalances = await Promise.all(
            paginatedGroups.data.map(async (group: GroupDTO) => {
                try {
                    const groupBalance = await this.firestoreReader.getGroupBalance(group.id);
                    return this.enrichGroupWithBalance(group, groupBalance, userId);
                } catch (e) {
                    logger.error('Error reading group balance', e, { groupId: group.id });
                    const emptyBalance: GroupBalanceDTO = {
                        groupId: group.id,
                        balancesByCurrency: {},
                        simplifiedDebts: [],
                        lastUpdatedAt: new Date().toISOString(),
                        version: 0,
                    };
                    return this.enrichGroupWithBalance(group, emptyBalance, userId);
                }
            }),
        );
        timer.endPhase();

        logger.info('groups-listed', {
            userId,
            count: groupsWithBalances.length,
            timings: timer.getTimings(),
        });

        // Step 3: Build response
        return {
            groups: groupsWithBalances,
            count: groupsWithBalances.length,
            hasMore: paginatedGroups.hasMore,
            ...(paginatedGroups.nextCursor && { nextCursor: paginatedGroups.nextCursor }),
            pagination: {
                limit,
                order: orderBy.direction,
            },
        };
    }

    /**
     * Create a new group with the creator as the owner/admin
     * IMPORTANT: The creator is automatically added as a member with 'owner' role
     */
    async createGroup(
        userId: string,
        groupData: CreateGroupRequest = new CreateGroupRequestBuilder()
            .build(),
    ): Promise<GroupDTO> {
        return measure.measureDb('createGroup', async () => this._createGroup(userId, groupData));
    }

    private async _createGroup(userId: string, createGroupRequest: CreateGroupRequest): Promise<GroupDTO> {
        const timer = new PerformanceTimer();

        // Initialize group structure with ISO strings (DTOs)
        const groupId = this.firestoreWriter.generateDocumentId(FirestoreCollections.GROUPS);
        const nowISO = new Date().toISOString();

        // Create the document to write (using ISO strings - FirestoreWriter converts to Timestamps)
        const documentToWrite = {
            name: createGroupRequest.name,
            description: createGroupRequest.description ?? '',
            createdBy: userId,
            createdAt: nowISO,
            updatedAt: nowISO,
            securityPreset: SecurityPresets.OPEN,
            presetAppliedAt: nowISO,
            permissions: PermissionEngine.getDefaultPermissions(SecurityPresets.OPEN),
        };

        // Note: Validation happens in FirestoreWriter after ISO → Timestamp conversion

        // Get user's display name to set as initial groupDisplayName
        const userData = await this.firestoreReader.getUser(userId);
        if (!userData || !userData.displayName) {
            throw Errors.NOT_FOUND('User profile');
        }

        // Pre-calculate member data outside transaction for speed (using ISO strings - DTOs)
        const themeColor = this.groupShareService.getThemeColorForMember(0);
        const memberDoc = {
            uid: userId,
            groupId: groupId,
            memberRole: MemberRoles.ADMIN,
            theme: themeColor, // ISO string assignedAt
            joinedAt: nowISO,
            memberStatus: MemberStatuses.ACTIVE,
            groupDisplayName: userData.displayName, // Default to user's account display name
        };

        // Initialize empty group balance (no expenses/settlements yet)
        const initialBalance: GroupBalanceDTO = {
            groupId,
            balancesByCurrency: {},
            simplifiedDebts: [],
            lastUpdatedAt: nowISO,
            version: 0,
        };

        // Atomic transaction: create group, member, and balance documents
        timer.startPhase('transaction');
        await this.firestoreWriter.runTransaction(async (transaction) => {
            this.firestoreWriter.createInTransaction(transaction, FirestoreCollections.GROUPS, groupId, documentToWrite);

            // Write to top-level collection for improved querying
            const topLevelMemberDoc = {
                ...memberDoc,
                groupUpdatedAt: nowISO,
                createdAt: nowISO,
                updatedAt: nowISO,
            };

            // FirestoreWriter.createInTransaction handles conversion and validation
            this.firestoreWriter.createInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, getTopLevelMembershipDocId(userId, groupId), topLevelMemberDoc);

            // Initialize balance document atomically with group creation
            this.firestoreWriter.setGroupBalanceInTransaction(transaction, groupId, initialBalance);

            // Note: Group notifications are handled by the trackGroupChanges trigger
            // which fires when the group document is created
        });
        timer.endPhase();

        // Add group context to logger
        LoggerContext.setBusinessContext({ groupId: groupId });

        // Fetch the created document to get server-side timestamps
        timer.startPhase('refetch');
        const groupData = await this.firestoreReader.getGroup(groupId);
        if (!groupData) {
            throw new Error('Failed to fetch created group');
        }

        // groupData is already a GroupDTO with ISO strings - no conversion needed
        // Add computed fields before returning
        const result = await this.addComputedFields(groupData, userId);
        timer.endPhase();

        logger.info('group-created', {
            groupId,
            timings: timer.getTimings(),
        });

        return result;
    }

    /**
     * Update an existing group
     * Only the owner can update a group
     */
    async updateGroup(groupId: string, userId: string, updates: UpdateGroupRequest): Promise<MessageResponse> {
        const timer = new PerformanceTimer();

        // Fetch group with write access check
        timer.startPhase('query');
        const { group } = await this.fetchGroupWithAccess(groupId, userId, true);
        timer.endPhase();

        // Update with optimistic locking and transaction retry logic
        timer.startPhase('transaction');
        await this.firestoreWriter.runTransaction(async (transaction) => {
            // IMPORTANT: All reads must happen before any writes in Firestore transactions

            // PHASE 1: ALL READS FIRST
            const currentGroup = await this.firestoreReader.getGroupInTransaction(transaction, groupId);
            if (!currentGroup) {
                throw Errors.NOT_FOUND('Group');
            }

            // Read membership documents that need updating
            const membershipSnapshot = await this.firestoreReader.getGroupMembershipsInTransaction(transaction, groupId);

            // Optimistic locking: Check if group was updated since we fetched it (compare ISO strings)
            if (group.updatedAt !== currentGroup.updatedAt) {
                throw Errors.CONCURRENT_UPDATE();
            }

            // Create updated data with current timestamp for optimistic response
            const now = new Date().toISOString();
            const updatedData = {
                ...group,
                ...updates,
                updatedAt: now,
            };

            // PHASE 2: ALL WRITES AFTER ALL READS
            // Update group document with ISO timestamp (FirestoreWriter converts to Timestamp)
            const documentPath = `${FirestoreCollections.GROUPS}/${groupId}`;
            this.firestoreWriter.updateInTransaction(transaction, documentPath, {
                name: updatedData.name,
                description: updatedData.description,
                updatedAt: now,
            });

            // Update denormalized groupUpdatedAt in all membership documents
            // Use the same ISO timestamp to keep them in sync
            membershipSnapshot.docs.forEach((doc) => {
                this.firestoreWriter.updateInTransaction(transaction, doc.ref.path, {
                    groupUpdatedAt: now,
                    updatedAt: now,
                });
            });
        });
        timer.endPhase();

        // Set group context
        LoggerContext.setBusinessContext({ groupId });

        // Log without explicitly passing userId - it will be automatically included
        logger.info('group-updated', {
            id: groupId,
            timings: timer.getTimings(),
        });

        return { message: 'Group updated successfully' };
    }

    /**
     * Permanently delete a group and ALL associated data (hard delete)
     * Only the owner can delete a group
     * This is a destructive operation that cannot be undone
     */
    /**
     * Mark a group as "deleting" to prevent concurrent operations
     * @param groupId - The ID of the group to mark for deletion
     * @returns Promise<void>
     */
    private async markGroupForDeletion(groupId: string): Promise<void> {
        await this.firestoreWriter.runTransaction(async (transaction) => {
            const groupRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUPS, groupId);
            const groupSnap = await transaction.get(groupRef);

            if (!groupSnap.exists) {
                throw new Error(`Group ${groupId} not found`);
            }

            const groupData = groupSnap.data();

            // Check if already deleting
            if (groupData?.deletionStatus === 'deleting') {
                logger.warn('Group is already marked for deletion', { groupId });
                throw new Error('Group deletion is already in progress');
            }

            // Check if deletion failed and we've exceeded max attempts
            if (groupData?.deletionStatus === 'failed' && (groupData?.deletionAttempts || 0) >= FIRESTORE.MAX_DELETION_ATTEMPTS) {
                throw new Error(`Group deletion has failed ${FIRESTORE.MAX_DELETION_ATTEMPTS} times. Manual intervention required.`);
            }

            // Mark for deletion
            // Note: deletionStatus and deletionAttempts are internal Firestore fields not in GroupDTO
            const now = new Date().toISOString();
            const updatedData: any = {
                deletionStatus: 'deleting' as const,
                deletionStartedAt: now,
                deletionAttempts: (groupData?.deletionAttempts || 0) + 1,
                updatedAt: now,
            };

            this.firestoreWriter.updateInTransaction(transaction, groupRef.path, updatedData);

            logger.info('Group marked for deletion', {
                groupId,
                attempt: updatedData.deletionAttempts,
            });
        });
    }

    /**
     * Delete a batch of documents atomically
     * @param collectionType - Type of collection being deleted (for logging)
     * @param groupId - The group ID for logging context
     * @param documentPaths - Array of document paths to delete
     * @returns Promise<void>
     */
    private async deleteBatch(collectionType: string, groupId: string, documentPaths: string[]): Promise<void> {
        if (documentPaths.length === 0) {
            return;
        }

        // Split into chunks respecting Firestore transaction limits
        const chunks = [];
        for (let i = 0; i < documentPaths.length; i += FIRESTORE.DELETION_BATCH_SIZE) {
            chunks.push(documentPaths.slice(i, i + FIRESTORE.DELETION_BATCH_SIZE));
        }

        logger.info('Deleting documents in batches', {
            collectionType,
            groupId,
            totalDocuments: documentPaths.length,
            batchCount: chunks.length,
            batchSize: FIRESTORE.DELETION_BATCH_SIZE,
        });

        // Process each chunk in its own transaction
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const batchNumber = i + 1;

            try {
                await this.firestoreWriter.runTransaction(async (transaction) => {
                    logger.info('Processing deletion batch', {
                        collectionType,
                        groupId,
                        batchNumber,
                        batchSize: chunk.length,
                        totalBatches: chunks.length,
                    });

                    this.firestoreWriter.bulkDeleteInTransaction(transaction, chunk);
                });

                logger.info('Deletion batch completed successfully', {
                    collectionType,
                    groupId,
                    batchNumber,
                    batchSize: chunk.length,
                });
            } catch (error) {
                logger.error('Deletion batch failed', {
                    collectionType,
                    groupId,
                    batchNumber,
                    batchSize: chunk.length,
                    error: error instanceof Error ? error.message : String(error),
                });

                // Mark group as failed and rethrow
                await this.markGroupDeletionFailed(groupId, error instanceof Error ? error.message : String(error));
                throw error;
            }
        }
    }

    /**
     * Mark a group deletion as failed
     * @param groupId - The group ID
     * @param errorMessage - The error that caused the failure
     */
    private async markGroupDeletionFailed(groupId: string, errorMessage: string): Promise<void> {
        try {
            await this.firestoreWriter.runTransaction(async (transaction) => {
                const groupRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUPS, groupId);
                const groupSnap = await transaction.get(groupRef);

                if (groupSnap.exists) {
                    this.firestoreWriter.updateInTransaction(transaction, groupRef.path, {
                        deletionStatus: 'failed' as const,
                        updatedAt: new Date().toISOString(),
                    });
                }
            });

            logger.error('Group deletion marked as failed', { groupId, errorMessage });
        } catch (markError) {
            logger.error('Failed to mark group deletion as failed', {
                groupId,
                originalError: errorMessage,
                markError: markError instanceof Error ? markError.message : String(markError),
            });
        }
    }

    /**
     * Finalize group deletion by removing the main group document
     * @param groupId - The group ID to finalize deletion for
     * @returns Promise<void>
     */
    private async finalizeGroupDeletion(groupId: string): Promise<void> {
        await this.firestoreWriter.runTransaction(async (transaction) => {
            const groupRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUPS, groupId);
            const groupSnap = await transaction.get(groupRef);

            if (!groupSnap.exists) {
                logger.warn('Group document not found during finalization', { groupId });
                return;
            }

            const groupData = groupSnap.data();

            // Verify group is marked for deletion
            if (groupData?.deletionStatus !== 'deleting') {
                throw new Error(`Group ${groupId} is not marked for deletion. Current status: ${groupData?.deletionStatus || 'none'}`);
            }

            // Delete the main group document
            transaction.delete(groupRef);

            logger.info('Group document deleted successfully', { groupId });
        });
    }

    async deleteGroup(groupId: string, userId: string): Promise<MessageResponse> {
        // Fetch group with write access check
        await this.fetchGroupWithAccess(groupId, userId, true);

        // Get member list BEFORE deletion for change tracking
        const memberIds = await this.firestoreReader.getAllGroupMemberIds(groupId);

        logger.info('Initiating atomic group deletion', {
            groupId,
            memberCount: memberIds.length,
            members: memberIds,
            operation: 'ATOMIC_DELETE',
        });

        try {
            // PHASE 1: Mark group for deletion (atomic)
            logger.info('Step 1: Marking group for deletion', { groupId });
            await this.markGroupForDeletion(groupId);

            // PHASE 2: Discover all related data
            logger.info('Step 2: Discovering all related data', { groupId });
            const { expenses, settlements, shareLinks, groupComments, expenseComments: expenseCommentSnapshots } = await this.firestoreReader.getGroupDeletionData(groupId);

            // Calculate total documents for logging
            const totalDocuments = expenses.size + settlements.size + shareLinks.size + groupComments.size + (memberIds?.length || 0)
                + expenseCommentSnapshots.reduce((sum, snapshot) => sum + snapshot.size, 0);

            logger.info('Data discovery complete', {
                groupId,
                totalDocuments,
                breakdown: {
                    expenses: expenses.size,
                    settlements: settlements.size,
                    shareLinks: shareLinks.size,
                    groupComments: groupComments.size,
                    members: memberIds?.length || 0,
                    expenseComments: expenseCommentSnapshots.reduce((sum, snapshot) => sum + snapshot.size, 0),
                },
            });

            // PHASE 3: Delete collections in atomic batches
            logger.info('Step 3: Deleting collections atomically', { groupId });

            // Delete expenses
            const expensePaths = expenses.docs.map((doc) => doc.ref.path);
            await this.deleteBatch('expenses', groupId, expensePaths);

            // Delete settlements
            const settlementPaths = settlements.docs.map((doc) => doc.ref.path);
            await this.deleteBatch('settlements', groupId, settlementPaths);

            // Delete share links
            const shareLinkPaths = shareLinks.docs.map((doc) => doc.ref.path);
            await this.deleteBatch('share-links', groupId, shareLinkPaths);

            // Delete group comments
            const groupCommentPaths = groupComments.docs.map((doc) => doc.ref.path);
            await this.deleteBatch('group-comments', groupId, groupCommentPaths);

            // Delete expense comments
            const expenseCommentPaths: string[] = [];
            expenseCommentSnapshots.forEach((snapshot) => {
                snapshot.docs.forEach((doc) => expenseCommentPaths.push(doc.ref.path));
            });
            await this.deleteBatch('expense-comments', groupId, expenseCommentPaths);

            // Delete memberships from top-level collection
            const membershipPaths: string[] = [];
            if (memberIds) {
                memberIds.forEach((uid) => {
                    const topLevelDocId = getTopLevelMembershipDocId(uid, groupId);
                    const topLevelPath = `${FirestoreCollections.GROUP_MEMBERSHIPS}/${topLevelDocId}`;
                    membershipPaths.push(topLevelPath);
                });
            }
            await this.deleteBatch('memberships', groupId, membershipPaths);

            // PHASE 4: Finalize by deleting main group document (atomic)
            logger.info('Step 4: Finalizing group deletion', { groupId });
            await this.finalizeGroupDeletion(groupId);

            // PHASE 5: Clean up user notification documents (AFTER all triggers have finished)
            // Since we removed trackMembershipDeletion trigger, we need to manually clean up notifications
            logger.info('Step 5: Cleaning up user notification documents', { groupId });
            if (memberIds.length > 0) {
                const results = [];
                for (const memberId of memberIds) {
                    const result = await this.notificationService.removeUserFromGroup(memberId, groupId);
                    results.push(result);
                }
                const successfulCleanups = results.filter((r) => r.success).length;
                logger.info('Notification cleanup completed', {
                    groupId,
                    totalUsers: memberIds.length,
                    successfulCleanups,
                    failedCleanups: results.length - successfulCleanups,
                });
            }

            // Set group context
            LoggerContext.setBusinessContext({ groupId });

            logger.info('Atomic group deletion completed successfully', {
                groupId,
                totalDocuments,
                operation: 'ATOMIC_DELETE_SUCCESS',
            });

            return { message: 'Group and all associated data deleted permanently' };
        } catch (error) {
            logger.error('Atomic group deletion failed', {
                groupId,
                error: error instanceof Error ? error.message : String(error),
                operation: 'ATOMIC_DELETE_FAILED',
            });

            // The markGroupDeletionFailed method is called within deleteBatch if needed
            // Group will remain marked as 'failed' for manual intervention
            throw error;
        }
    }

    /**
     * Get comprehensive group details including members, expenses, balances, and settlements
     * @param groupId Group ID
     * @param userId User ID for access control
     * @param options Pagination options for expenses and settlements
     * @returns Complete group details
     */
    async getGroupFullDetails(
        groupId: string,
        userId: string,
        options: {
            expenseLimit?: number;
            expenseCursor?: string;
            settlementLimit?: number;
            settlementCursor?: string;
            includeDeletedSettlements?: boolean;
        } = {},
    ): Promise<GroupFullDetailsDTO> {
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        // Validate and set defaults for pagination
        const expenseLimit = Math.min(options.expenseLimit || 20, 100);
        const settlementLimit = Math.min(options.settlementLimit || 20, 100);

        // Get group with access check (this will throw if user doesn't have access)
        const { group } = await this.fetchGroupWithAccess(groupId, userId);

        // Fetch all data in parallel using proper service layer methods
        const [membersData, expensesData, balancesData, settlementsData] = await Promise.all([
            // Get members using service layer
            this.userService.getGroupMembersResponseFromSubcollection(groupId),

            // Get expenses using service layer with pagination
            this.expenseService.listGroupExpenses(groupId, userId, {
                limit: expenseLimit,
                cursor: options.expenseCursor,
            }),

            // Get pre-computed balances from Firestore (O(1) read)
            this.firestoreReader.getGroupBalance(groupId),

            // Get settlements using service layer with pagination
            this.settlementService.listSettlements(groupId, userId, {
                limit: settlementLimit,
                cursor: options.settlementCursor,
                includeDeleted: options.includeDeletedSettlements ?? false,
            }),
        ]);

        // balancesData is already validated GroupBalanceDTO from getGroupBalance()
        // Map lastUpdatedAt to lastUpdated for API response compatibility
        const balancesDTO: GroupBalances = {
            ...balancesData,
            lastUpdated: balancesData.lastUpdatedAt,
            userBalances: {}, // TODO: Populate from balancesByCurrency if needed by client
        };

        // Construct response using existing patterns
        return {
            group,
            members: membersData,
            expenses: expensesData,
            balances: balancesDTO,
            settlements: settlementsData,
        };
    }
}

// ServiceRegistry handles service instantiation
