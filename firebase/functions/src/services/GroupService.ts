import {DocumentReference, Timestamp} from 'firebase-admin/firestore';
import {getFirestore} from '../firebase';
import {Errors} from '../utils/errors';
import {Group, UpdateGroupRequest} from '../types/group-types';
import {CreateGroupRequest, DELETED_AT_FIELD, FirestoreCollections, GroupMemberDocument, ListGroupsResponse, MemberRoles, MemberStatuses, MessageResponse, SecurityPresets} from '@splitifyd/shared';
import {BalanceCalculationResultSchema, CurrencyBalanceDisplaySchema, BalanceDisplaySchema} from '../schemas';
import {GroupDataSchema} from '../schemas';
import {BalanceCalculationService} from './balance/BalanceCalculationService';
import {DOCUMENT_CONFIG} from '../constants';
import {logger, LoggerContext} from '../logger';
import {createOptimisticTimestamp, createTrueServerTimestamp, getRelativeTime, parseISOToTimestamp, timestampToISO} from '../utils/dateHelpers';
import {PermissionEngine} from '../permissions';
import {getUpdatedAtTimestamp, updateWithTimestamp} from '../utils/optimistic-locking';
import { measureDb } from '../monitoring/measure';
import type { IFirestoreReader } from './firestore/IFirestoreReader';
import type { IFirestoreWriter } from './firestore/IFirestoreWriter';
import type { BalanceCalculationResult } from './balance';
import type { UserProfile } from '../services/UserService2';
import { ExpenseMetadataService } from './expenseMetadataService';
import { UserService } from './UserService2';
import { ExpenseService } from './ExpenseService';
import { SettlementService } from './SettlementService';
import { GroupMemberService } from './GroupMemberService';
import { NotificationService } from './notification-service';
import {GroupShareService} from "./GroupShareService";
import {DataFetcher} from "./balance/DataFetcher";
import { createTopLevelMembershipDocument, getTopLevelMembershipDocId } from '../utils/groupMembershipHelpers';

/**
 * Service for managing group operations
 */
export class GroupService {
    private balanceService: BalanceCalculationService;
    // Keep collection reference for write operations (until we have IFirestoreWriter)
    private groupsCollection = getFirestore().collection(FirestoreCollections.GROUPS);
    
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly userService: UserService,
        private readonly expenseService: ExpenseService,
        private readonly settlementService: SettlementService,
        private readonly groupMemberService: GroupMemberService,
        private readonly notificationService: NotificationService,
        private readonly expenseMetadataService: ExpenseMetadataService,
        private readonly groupShareService: GroupShareService,
    ) {
        const dataFetcher = new DataFetcher(firestoreReader, userService);
        this.balanceService = new BalanceCalculationService(dataFetcher);
    }
    
    /**
     * Helper to safely convert any date-like value to ISO string
     * todo: this is bullshit - it implies we don't understand our own data model
     */
    private safeDateToISO(value: any): string {
        if (value instanceof Timestamp) {
            return timestampToISO(value);
        }
        if (value instanceof Date) {
            return timestampToISO(value);
        }
        if (typeof value === 'string') {
            return value;
        }
        // Fallback for unknown types - use current timestamp
        return new Date().toISOString();
    }
    

    /**
     * Add computed fields to Group (balance, last activity)
     */
    private async addComputedFields(group: Group, userId: string): Promise<Group> {
        // Calculate real balance for the user
        const groupBalances = await this.balanceService.calculateGroupBalances(group.id);

        // Validate the balance calculation result for type safety
        const validatedBalances = BalanceCalculationResultSchema.parse(groupBalances);

        // Calculate expense metadata on-demand
        // TODO: Update ExpenseMetadata interface to include lastExpenseTime
        const expenseMetadata = await this.expenseMetadataService.calculateExpenseMetadata(group.id);

        // Calculate currency-specific balances with proper typing
        const balancesByCurrency: Record<string, {
            currency: string;
            netBalance: number;
            totalOwed: number;
            totalOwing: number;
        }> = {};
        
        if (validatedBalances.balancesByCurrency) {
            for (const [currency, currencyBalances] of Object.entries(validatedBalances.balancesByCurrency)) {
                const currencyUserBalance = currencyBalances[userId];
                if (currencyUserBalance && Math.abs(currencyUserBalance.netBalance) > 0.01) {
                    const currencyDisplayData = {
                        currency,
                        netBalance: currencyUserBalance.netBalance,
                        totalOwed: currencyUserBalance.netBalance > 0 ? currencyUserBalance.netBalance : 0,
                        totalOwing: currencyUserBalance.netBalance < 0 ? Math.abs(currencyUserBalance.netBalance) : 0,
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
            lastActivity: expenseMetadata.lastExpenseTime ? `Last expense ${expenseMetadata.lastExpenseTime.toLocaleDateString()}` : 'No recent activity',
            lastActivityRaw: expenseMetadata.lastExpenseTime ? expenseMetadata.lastExpenseTime.toISOString() : group.createdAt,
        };
    }

    /**
     * Fetch a group and verify user access
     */
    private async fetchGroupWithAccess(groupId: string, userId: string, requireWriteAccess: boolean = false): Promise<{ docRef: DocumentReference; group: Group }> {
        const docRef = this.groupsCollection.doc(groupId);
        const groupData = await this.firestoreReader.getGroup(groupId);

        if (!groupData) {
            throw Errors.NOT_FOUND('Group');
        }

        // Convert GroupDocument to Group format (the reader returns validated data)
        const group: Group = {
            id: groupData.id,
            name: groupData.name,
            description: groupData.description,
            createdBy: groupData.createdBy,
            createdAt: this.safeDateToISO(groupData.createdAt),
            updatedAt: this.safeDateToISO(groupData.updatedAt),
            securityPreset: groupData.securityPreset!,
            presetAppliedAt: this.safeDateToISO(groupData.presetAppliedAt),
            permissions: groupData.permissions as any,
        };

        // Check if user is the owner
        if (await this.groupMemberService.isGroupOwnerAsync(group.id, userId)) {
            const groupWithComputed = await this.addComputedFields(group, userId);
            return { docRef, group: groupWithComputed };
        }

        // For write operations, only the owner is allowed
        if (requireWriteAccess) {
            throw Errors.FORBIDDEN();
        }

        // For read operations, check if user is a member
        if (await this.groupMemberService.isGroupMemberAsync(group.id, userId)) {
            const groupWithComputed = await this.addComputedFields(group, userId);
            return { docRef, group: groupWithComputed };
        }

        // User doesn't have access to this group
        // SECURITY: Return 404 instead of 403 to prevent information disclosure.
        // This prevents attackers from enumerating valid group IDs.
        throw Errors.NOT_FOUND('Group');
    }

    /**
     * Batch fetch all expenses and settlements for multiple groups
     * PERFORMANCE OPTIMIZED: Reduces N database queries to just 2-3
     */
    private async batchFetchGroupData(groupIds: string[]): Promise<{
        expensesByGroup: Map<string, any[]>;
        settlementsByGroup: Map<string, any[]>;
        expenseMetadataByGroup: Map<string, { count: number; lastExpenseTime?: Date }>;
    }> {
        if (groupIds.length === 0) {
            return {
                expensesByGroup: new Map(),
                settlementsByGroup: new Map(),
                expenseMetadataByGroup: new Map(),
            };
        }

        // Firestore 'in' query supports max 10 items - chunk if needed
        const chunks: string[][] = [];
        for (let i = 0; i < groupIds.length; i += 10) {
            chunks.push(groupIds.slice(i, i + 10));
        }

        // Batch fetch all expenses and settlements for all groups using FirestoreReader
        const expenseQueries = chunks.map(async (chunk) => {
            const allExpenses = [];
            for (const groupId of chunk) {
                const expenses = await this.firestoreReader.getExpensesForGroup(groupId);
                allExpenses.push(...expenses.map(expense => ({ ...expense, groupId })));
            }
            return allExpenses;
        });

        const settlementQueries = chunks.map(async (chunk) => {
            const allSettlements = [];
            for (const groupId of chunk) {
                const settlements = await this.firestoreReader.getSettlementsForGroup(groupId);
                allSettlements.push(...settlements.map(settlement => ({ ...settlement, groupId })));
            }
            return allSettlements;
        });

        // Execute all queries in parallel
        const [expenseResults, settlementResults] = await Promise.all([Promise.all(expenseQueries), Promise.all(settlementQueries)]);

        // Organize expenses by group ID
        const expensesByGroup = new Map<string, any[]>();
        const expenseMetadataByGroup = new Map<string, { count: number; lastExpenseTime?: Date }>();

        for (const expenseArray of expenseResults) {
            for (const expense of expenseArray) {
                const groupId = expense.groupId;

                if (!expensesByGroup.has(groupId)) {
                    expensesByGroup.set(groupId, []);
                }
                expensesByGroup.get(groupId)!.push(expense);
            }
        }

        // Calculate metadata for each group
        for (const [groupId, expenses] of expensesByGroup.entries()) {
            const nonDeletedExpenses = expenses.filter((expense) => !expense[DELETED_AT_FIELD]);
            const sortedExpenses = nonDeletedExpenses.sort((a, b) => {
                // Handle both Firestore Timestamps and ISO strings
                const aTime = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : (a.createdAt?.toMillis() || 0);
                const bTime = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : (b.createdAt?.toMillis() || 0);
                return bTime - aTime; // DESC order
            });

            expenseMetadataByGroup.set(groupId, {
                count: nonDeletedExpenses.length,
                lastExpenseTime: sortedExpenses.length > 0 ? (
                    typeof sortedExpenses[0].createdAt === 'string' 
                        ? new Date(sortedExpenses[0].createdAt) 
                        : sortedExpenses[0].createdAt?.toDate()
                ) : undefined,
            });
        }

        // Set empty metadata for groups with no expenses
        for (const groupId of groupIds) {
            if (!expenseMetadataByGroup.has(groupId)) {
                expenseMetadataByGroup.set(groupId, { count: 0 });
            }
        }

        // Organize settlements by group ID
        const settlementsByGroup = new Map<string, any[]>();
        for (const settlementArray of settlementResults) {
            for (const settlement of settlementArray) {
                const groupId = settlement.groupId;

                if (!settlementsByGroup.has(groupId)) {
                    settlementsByGroup.set(groupId, []);
                }
                settlementsByGroup.get(groupId)!.push(settlement);
            }
        }

        return {
            expensesByGroup,
            settlementsByGroup,
            expenseMetadataByGroup,
        };
    }

    /**
     * Format a date as relative time (e.g., "2 hours ago")
     */
    private formatRelativeTime(dateStr: string): string {
        const timestamp = parseISOToTimestamp(dateStr);
        if (!timestamp) {
            return 'unknown';
        }
        return getRelativeTime(timestamp);
    }

    /**
     * List all groups for a user with pagination and balance information
     * PERFORMANCE OPTIMIZED: Batches database operations to prevent N+1 queries
     */
    async listGroups(
        userId: string,
        options: {
            limit?: number;
            cursor?: string;
            order?: 'asc' | 'desc';
            includeMetadata?: boolean;
        } = {},
    ): Promise<ListGroupsResponse> {
        return measureDb('listGroups', async () => this._listGroups(userId, options));
    }

    private async _listGroups(
        userId: string,
        options: {
            limit?: number;
            cursor?: string;
            order?: 'asc' | 'desc';
            includeMetadata?: boolean;
        } = {},
    ): Promise<ListGroupsResponse> {
        return measureDb('list-groups', async () => {
            return this._executeListGroups(userId, options);
        });
    }

    private async _executeListGroups(
        userId: string,
        options: {
            limit?: number;
            cursor?: string;
            order?: 'asc' | 'desc';
            includeMetadata?: boolean;
        } = {},
    ): Promise<ListGroupsResponse> {
        // Parse options with defaults
        const limit = Math.min(options.limit || DOCUMENT_CONFIG.LIST_LIMIT, DOCUMENT_CONFIG.LIST_LIMIT);
        const cursor = options.cursor;
        const order = options.order ?? 'desc';
        const includeMetadata = options.includeMetadata === true;

        // Step 1: Query groups and metadata using FirestoreReader
        const { paginatedGroups } = await (async () => {
            // Get groups for user using FirestoreReader (returns PaginatedResult)
            // FirestoreReader already handles pagination internally
            const paginatedGroups = await this.firestoreReader.getGroupsForUser(userId, {
                limit: limit, // Use actual limit, FirestoreReader handles the +1 for hasMore detection
                cursor: cursor,
                orderBy: {
                    field: 'updatedAt',
                    direction: order
                }
            });

            // Note: recentGroupChanges removed as GROUP_CHANGES collection was unused
            return {
                paginatedGroups
            };
        })();

        // Step 2: Process group documents
        const { groups, groupIds } = await (async () => {
            // Extract groups data from paginated result
            const groupsData = paginatedGroups.data;
            
            // FirestoreReader already handled pagination, use all returned groups
            const returnedGroups = groupsData;

            // Convert GroupDocument to Group format (the reader returns validated data)
            const groups: Group[] = returnedGroups.map((groupData: any) => ({
                id: groupData.id,
                name: groupData.name,
                description: groupData.description,
                createdBy: groupData.createdBy,
                createdAt: this.safeDateToISO(groupData.createdAt),
                updatedAt: this.safeDateToISO(groupData.updatedAt),
                securityPreset: groupData.securityPreset!,
                presetAppliedAt: this.safeDateToISO(groupData.presetAppliedAt),
                permissions: groupData.permissions as any,
            }));
            const groupIds = groups.map((group) => group.id);
            
            return { groups, groupIds };
        })();

        // Step 3: Batch fetch group data
        const { expenseMetadataByGroup } = await (async () => {
            // 🚀 PERFORMANCE FIX: Batch fetch all data for all groups in 3 queries instead of N×4
            return this.batchFetchGroupData(groupIds);
        })();

        // Step 4: Batch fetch user profiles and create member mapping
        const { allMemberProfiles, membersByGroup } = await (async () => {
            // Batch fetch user profiles for all members across all groups using subcollections
            const allMemberIds = new Set<string>();
            const membersByGroup = new Map<string, string[]>();
            
            // Fetch members for each group from subcollections
            const memberPromises = groups.map((group: Group) => 
                this.groupMemberService.getMembersFromSubcollection(group.id)
            );
            const membersArrays = await Promise.all(memberPromises);
            
            // Collect all member IDs and create mapping
            groups.forEach((group: Group, index: number) => {
                const memberDocs = membersArrays[index];
                const memberIds = memberDocs.map((memberDoc: GroupMemberDocument) => memberDoc.userId);
                membersByGroup.set(group.id, memberIds);
                memberIds.forEach((memberId: string) => allMemberIds.add(memberId));
            });
            
            const allMemberProfiles = await this.userService.getUsers(Array.from(allMemberIds));
            
            return { allMemberProfiles, membersByGroup };
        })();

        // Step 5: Calculate balances for groups with expenses
        const balanceMap = await (async () => {
            // Calculate balances for groups that have expenses
            const groupsWithExpenses = groups.filter((group: Group) => {
                const expenseMetadata = expenseMetadataByGroup.get(group.id) || { count: 0 };
                return expenseMetadata.count > 0;
            });

            const balancePromises = groupsWithExpenses.map((group: Group) => 
                this.balanceService.calculateGroupBalances(group.id).catch((error: Error) => {
                    logger.error('Error calculating balances', error, { groupId: group.id });
                    return {
                        groupId: group.id,
                        balancesByCurrency: {},
                        userBalances: {},
                        simplifiedDebts: [],
                        lastUpdated: new Date().toISOString(),
                    };
                })
            );

            const balanceResults = await Promise.all(balancePromises);
            const balanceMap = new Map<string, BalanceCalculationResult>();
            groupsWithExpenses.forEach((group: Group, index: number) => {
                balanceMap.set(group.id, balanceResults[index]);
            });

            return balanceMap;
        })();

        // Step 6: Process each group using batched data - no more database calls!
        const groupsWithBalances: Group[] = await (async () => {
            return groups.map((group: Group) => {
            // Get pre-fetched data for this group (no database calls)
            const expenseMetadata = expenseMetadataByGroup.get(group.id) || { count: 0 };

            // Get member profiles for this group
            const memberIds = membersByGroup.get(group.id) || [];
            const memberProfiles = new Map<string, UserProfile>();
            for (const memberId of memberIds) {
                const profile = allMemberProfiles.get(memberId);
                if (profile) {
                    memberProfiles.set(memberId, profile);
                }
            }

            // 🚀 OPTIMIZED: Use pre-calculated balance or empty balance
            const groupBalances = balanceMap.get(group.id) || {
                groupId: group.id,
                balancesByCurrency: {},
                userBalances: {},
                simplifiedDebts: [],
                lastUpdated: Timestamp.now(),
            };

            // Calculate currency-specific balances with proper typing
            const balancesByCurrency: Record<string, {
                currency: string;
                netBalance: number;
                totalOwed: number;
                totalOwing: number;
            }> = {};
            
            if (groupBalances.balancesByCurrency) {
                // Validate the balance data with schema first
                const validatedBalances = BalanceCalculationResultSchema.parse(groupBalances);
                
                for (const [currency, currencyBalances] of Object.entries(validatedBalances.balancesByCurrency)) {
                    const currencyUserBalance = currencyBalances[userId];
                    if (currencyUserBalance && Math.abs(currencyUserBalance.netBalance) > 0.01) {
                        const currencyDisplayData = {
                            currency,
                            netBalance: currencyUserBalance.netBalance,
                            totalOwed: currencyUserBalance.netBalance > 0 ? currencyUserBalance.netBalance : 0,
                            totalOwing: currencyUserBalance.netBalance < 0 ? Math.abs(currencyUserBalance.netBalance) : 0,
                        };
                        
                        // Validate the currency display data structure
                        const validatedCurrencyData = CurrencyBalanceDisplaySchema.parse(currencyDisplayData);
                        balancesByCurrency[currency] = validatedCurrencyData;
                    }
                }
            }

            // Format last activity using pre-fetched metadata
            const lastActivityDate = expenseMetadata.lastExpenseTime ?? new Date(group.updatedAt);
            let lastActivity: string;
            let lastActivityRaw: string;
            
            try {
                if (lastActivityDate instanceof Date && !isNaN(lastActivityDate.getTime())) {
                    lastActivityRaw = lastActivityDate.toISOString();
                    lastActivity = this.formatRelativeTime(lastActivityRaw);
                } else if (typeof lastActivityDate === 'string') {
                    lastActivityRaw = lastActivityDate;
                    lastActivity = this.formatRelativeTime(lastActivityDate);
                } else {
                    // Fallback to group's updatedAt
                    lastActivityRaw = group.updatedAt;
                    lastActivity = this.formatRelativeTime(group.updatedAt);
                }
            } catch (error) {
                logger.warn('Failed to format last activity time, using group updatedAt', { 
                    error, 
                    lastActivityDate, 
                    groupId: group.id 
                });
                lastActivityRaw = group.updatedAt;
                lastActivity = this.formatRelativeTime(group.updatedAt);
            }

            // Get user's balance from first available currency with proper typing
            let userBalance: {
                netBalance: number;
                totalOwed: number;
                totalOwing: number;
            } = {
                netBalance: 0,
                totalOwed: 0,
                totalOwing: 0,
            };
            
            if (groupBalances.balancesByCurrency) {
                // Use validated balance data from above
                const validatedBalances = BalanceCalculationResultSchema.parse(groupBalances);
                const currencyBalancesArray = Object.values(validatedBalances.balancesByCurrency);
                
                if (currencyBalancesArray.length > 0) {
                    const firstCurrencyBalances = currencyBalancesArray[0];
                    if (firstCurrencyBalances && firstCurrencyBalances[userId]) {
                        const balance = firstCurrencyBalances[userId];
                        userBalance = {
                            netBalance: balance.netBalance,
                            totalOwed: balance.netBalance > 0 ? balance.netBalance : 0,
                            totalOwing: balance.netBalance < 0 ? Math.abs(balance.netBalance) : 0,
                        };
                    }
                }
            }

            return {
                ...group,
                balance: {
                    userBalance,
                    balancesByCurrency,
                },
                lastActivity,
                lastActivityRaw,
            };
            });
        })();

        // Step 7: Generate pagination and response
        return await (async () => {
            // Use pagination information from FirestoreReader
            const hasMore = paginatedGroups.hasMore;
            const nextCursor = paginatedGroups.nextCursor;

            const response: ListGroupsResponse = {
                groups: groupsWithBalances,
                count: groupsWithBalances.length,
                hasMore,
                ...(nextCursor && { nextCursor }),
                pagination: {
                    limit,
                    order,
                },
            };

            // Metadata functionality removed as GROUP_CHANGES collection was unused

            return response;
        })();
    }

    /**
     * Create a new group with the creator as the owner/admin
     * IMPORTANT: The creator is automatically added as a member with 'owner' role
     */
    async createGroup(userId: string, groupData: CreateGroupRequest): Promise<Group> {
        return measureDb('createGroup', async () => this._createGroup(userId, groupData)
        );
    }

    private async _createGroup(userId: string, createGroupRequest: CreateGroupRequest): Promise<Group> {
        // Initialize group structure with server timestamps
        const docRef = this.groupsCollection.doc();
        const serverTimestamp = createTrueServerTimestamp();
        const now = createOptimisticTimestamp();

        const newGroup: Group = {
            id: docRef.id,
            name: createGroupRequest.name,
            description: createGroupRequest.description ?? '',
            createdBy: userId,
            createdAt: timestampToISO(now),
            updatedAt: timestampToISO(now),
            securityPreset: SecurityPresets.OPEN,
            presetAppliedAt: timestampToISO(now),
            permissions: PermissionEngine.getDefaultPermissions(SecurityPresets.OPEN),
        };

        // Add server timestamps to the flat document structure
        const documentToWrite = {
            ...newGroup,
            createdAt: serverTimestamp,
            updatedAt: serverTimestamp,
        };

        try {
            GroupDataSchema.parse(newGroup);
        } catch (error) {
            logger.error('Invalid group document to write', error as Error, {
                groupId: docRef.id,
                userId,
            });
            throw Errors.INVALID_INPUT();
        }

        // Pre-calculate member subcollection data outside transaction for speed
        const memberRef = getFirestore()
            .collection(FirestoreCollections.GROUPS)
            .doc(docRef.id)
            .collection('members')
            .doc(userId);
            
        const memberDoc: GroupMemberDocument = {
            userId: userId,
            groupId: docRef.id,
            memberRole: MemberRoles.ADMIN,
            theme: this.groupShareService.getThemeColorForMember(0),
            joinedAt: now.toDate().toISOString(),
            memberStatus: MemberStatuses.ACTIVE,
        };
        
        const memberServerTimestamp = createTrueServerTimestamp();
        const memberDocWithTimestamps = {
            ...memberDoc,
            createdAt: memberServerTimestamp,
            updatedAt: memberServerTimestamp,
        };

        // Atomic transaction: create both group and member documents
        await this.firestoreWriter.runTransaction(async (transaction) => {
            this.firestoreWriter.createInTransaction(
                transaction,
                FirestoreCollections.GROUPS,
                docRef.id,
                documentToWrite
            );
            this.firestoreWriter.createInTransaction(
                transaction,
                `${FirestoreCollections.GROUPS}/${docRef.id}/members`,
                userId,
                memberDocWithTimestamps
            );
            
            // NEW: Also write to top-level collection for improved querying
            const topLevelMemberDoc = createTopLevelMembershipDocument(
                memberDoc,
                timestampToISO(now)
            );
            this.firestoreWriter.createInTransaction(
                transaction,
                FirestoreCollections.GROUP_MEMBERSHIPS,
                getTopLevelMembershipDocId(userId, docRef.id),
                {
                    ...topLevelMemberDoc,
                    createdAt: memberServerTimestamp,
                    updatedAt: memberServerTimestamp,
                }
            );
        });

        // Initialize group notifications for creator
        await this.notificationService.addUserToGroupNotificationTracking(userId, docRef.id);

        // Add group context to logger
        LoggerContext.setBusinessContext({ groupId: docRef.id });

        // Fetch the created document to get server-side timestamps
        const groupData = await this.firestoreReader.getGroup(docRef.id);
        if (!groupData) {
            throw new Error('Failed to fetch created group');
        }
        
        // Convert GroupDocument to Group format
        const group: Group = {
            id: groupData.id,
            name: groupData.name,
            description: groupData.description,
            createdBy: groupData.createdBy,
            createdAt: this.safeDateToISO(groupData.createdAt),
            updatedAt: this.safeDateToISO(groupData.updatedAt),
            securityPreset: groupData.securityPreset!,
            presetAppliedAt: this.safeDateToISO(groupData.presetAppliedAt),
            permissions: groupData.permissions as any,
        };

        // Add computed fields before returning
        return await this.addComputedFields(group, userId);
    }

    /**
     * Update an existing group
     * Only the owner can update a group
     */
    async updateGroup(groupId: string, userId: string, updates: UpdateGroupRequest): Promise<MessageResponse> {
        // Fetch group with write access check
        const { docRef, group } = await this.fetchGroupWithAccess(groupId, userId, true);

        // Update with optimistic locking (timestamp is handled by optimistic locking system)
        await this.firestoreWriter.runTransaction(async (transaction) => {
            const freshDoc = await this.firestoreReader.getRawDocumentInTransactionWithRef(transaction, docRef);
            if (!freshDoc) {
                throw Errors.NOT_FOUND('Group');
            }

            const originalUpdatedAt = getUpdatedAtTimestamp(freshDoc.data(), docRef.id);

            // Create updated data with current timestamp (will be converted to ISO in the data field)
            const now = createOptimisticTimestamp();
            const updatedData = {
                ...group,
                ...updates,
                updatedAt: now.toDate(),
            };

            // Use existing pattern since we already have the fresh document from transaction read
            await updateWithTimestamp(
                transaction,
                docRef,
                {
                    name: updatedData.name,
                    description: updatedData.description,
                    updatedAt: updatedData.updatedAt.toISOString(),
                },
                originalUpdatedAt,
            );
            
            // NEW: Update denormalized groupUpdatedAt in all membership documents
            const memberships = await getFirestore()
                .collection(FirestoreCollections.GROUP_MEMBERSHIPS)
                .where('groupId', '==', groupId)
                .get();
            
            if (!memberships.empty) {
                const newGroupUpdatedAt = updatedData.updatedAt.toISOString();
                for (const membershipDoc of memberships.docs) {
                    transaction.update(membershipDoc.ref, {
                        groupUpdatedAt: newGroupUpdatedAt,
                        updatedAt: createTrueServerTimestamp()
                    });
                }
            }
        });

        // Set group context
        LoggerContext.setBusinessContext({ groupId });

        // Log without explicitly passing userId - it will be automatically included
        logger.info('group-updated', { id: groupId });

        return { message: 'Group updated successfully' };
    }

    /**
     * Permanently delete a group and ALL associated data (hard delete)
     * Only the owner can delete a group
     * This is a destructive operation that cannot be undone
     */
    async deleteGroup(groupId: string, userId: string): Promise<MessageResponse> {
        // Fetch group with write access check
        const { docRef } = await this.fetchGroupWithAccess(groupId, userId, true);

        // Get member list BEFORE deletion for change tracking
        const memberDocs = await this.firestoreReader.getMembersFromSubcollection(groupId);
        const memberIds = memberDocs ? memberDocs.map(doc => doc.userId) : [];
        
        logger.info('Initiating hard delete for group', { 
            groupId, 
            memberCount: memberIds.length,
            members: memberIds,
            operation: 'HARD_DELETE'
        });

        // PHASE 1: Discover all related data
        logger.info('Discovering all related data for comprehensive deletion', { groupId });

        // Get all related data using centralized FirestoreReader
        const {
            expenses,
            settlements,
            transactionChanges,
            balanceChanges,
            shareLinks,
            groupComments,
            expenseComments: expenseCommentSnapshots
        } = await this.firestoreReader.getGroupDeletionData(groupId);

        // Calculate total documents to delete for logging
        const totalDocuments = expenses.size + settlements.size + 
                             transactionChanges.size + balanceChanges.size + shareLinks.size + 
                             groupComments.size + (memberDocs?.length || 0) + 1 + // +1 for main group doc
                             expenseCommentSnapshots.reduce((sum, snapshot) => sum + snapshot.size, 0);

        logger.info('Data discovery complete, creating change document before deletion', {
            groupId,
            totalDocuments,
            breakdown: {
                expenses: expenses.size,
                settlements: settlements.size,
                transactionChanges: transactionChanges.size,
                balanceChanges: balanceChanges.size,
                shareLinks: shareLinks.size,
                groupComments: groupComments.size,
                members: memberDocs?.length || 0,
                expenseComments: expenseCommentSnapshots.reduce((sum, snapshot) => sum + snapshot.size, 0)
            }
        });

        // PHASE 2: Notifications will be handled by triggers after deletion
        // This ensures a single source of truth for notification management
        logger.info('Group deletion notifications will be handled by triggers', {
            groupId,
            memberCount: memberIds.length,
            members: memberIds
        });

        // PHASE 3: Execute bulk deletion using IFirestoreWriter
        const documentPaths: string[] = [];
        
        // Collect all document paths for bulk deletion
        expenses.docs.forEach(doc => documentPaths.push(doc.ref.path));
        settlements.docs.forEach(doc => documentPaths.push(doc.ref.path));
        transactionChanges.docs.forEach(doc => documentPaths.push(doc.ref.path));
        balanceChanges.docs.forEach(doc => documentPaths.push(doc.ref.path));
        shareLinks.docs.forEach(doc => documentPaths.push(doc.ref.path));
        groupComments.docs.forEach(doc => documentPaths.push(doc.ref.path));

        // Delete expense comments
        expenseCommentSnapshots.forEach(snapshot => {
            snapshot.docs.forEach(doc => documentPaths.push(doc.ref.path));
        });

        // Delete members
        if (memberDocs) {
            memberDocs.forEach(memberDoc => {
                const memberPath = `${FirestoreCollections.GROUPS}/${groupId}/members/${memberDoc.userId}`;
                documentPaths.push(memberPath);
            });
        }

        // Delete main group document last
        documentPaths.push(docRef.path);

        // Execute bulk deletion
        logger.info('Executing bulk deletion operations', { groupId, totalDocuments });
        const bulkDeleteResult = await this.firestoreWriter.bulkDelete(documentPaths);
        
        if (bulkDeleteResult.failureCount > 0) {
            logger.error('Some deletions failed during group hard delete', {
                groupId,
                successCount: bulkDeleteResult.successCount,
                failureCount: bulkDeleteResult.failureCount
            });
        }

        logger.info('Bulk deletion completed successfully', { 
            groupId, 
            totalDocuments,
            operation: 'HARD_DELETE_COMPLETE'
        });

        // Set group context
        LoggerContext.setBusinessContext({ groupId });

        // Final success log
        logger.info('group-hard-deleted', { 
            id: groupId,
            totalDocuments,
            operation: 'HARD_DELETE_SUCCESS'
        });

        return { message: 'Group and all associated data deleted permanently' };
    }

    /**
     * Get group balances for a user
     * Returns simplified debts and balance information
     */
    async getGroupBalances(groupId: string, userId: string): Promise<{
        groupId: string;
        userBalances: any;
        simplifiedDebts: any;
        lastUpdated: string;
        balancesByCurrency: Record<string, any>;
    }> {
        return measureDb('getGroupBalances', async () => this._getGroupBalances(groupId, userId)
        );
    }

    private async _getGroupBalances(groupId: string, userId: string): Promise<{
        groupId: string;
        userBalances: any;
        simplifiedDebts: any;
        lastUpdated: string;
        balancesByCurrency: Record<string, any>;
    }> {
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        if (!groupId) {
            throw Errors.MISSING_FIELD('groupId');
        }

        const groupData = await this.firestoreReader.getGroup(groupId);

        if (!groupData) {
            throw Errors.NOT_FOUND('Group');
        }

        // The reader already returns validated data
        const validatedGroup = groupData;

        // Validate user access using scalable membership check
        const membersData = await this.userService.getUsers([userId]);
        if (!membersData.has(userId)) {
            throw Errors.FORBIDDEN();
        }
        
        // Check if user is a member using the async helper
        if (!(await this.groupMemberService.isGroupMemberAsync(groupId, userId))) {
            throw Errors.FORBIDDEN();
        }

        // Always calculate balances on-demand for accurate data
        const balances = await this.balanceService.calculateGroupBalances(groupId);

        return {
            groupId: balances.groupId,
            userBalances: balances.userBalances,
            simplifiedDebts: balances.simplifiedDebts,
            lastUpdated: balances.lastUpdated,
            balancesByCurrency: balances.balancesByCurrency || {},
        };
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
        } = {}
    ) {
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

            // Get balances using existing calculator
            this.balanceService.calculateGroupBalances(groupId),

            // Get settlements using service layer with pagination
            this.settlementService.listSettlements(groupId, userId, {
                limit: settlementLimit,
                cursor: options.settlementCursor,
            }),
        ]);

        // Validate balance data before returning
        const validatedBalances = BalanceCalculationResultSchema.parse(balancesData);

        // Construct response using existing patterns
        return {
            group,
            members: membersData,
            expenses: expensesData,
            balances: validatedBalances, // Now properly validated instead of unsafe cast
            settlements: settlementsData,
        };
    }
}

// ServiceRegistry handles service instantiation
