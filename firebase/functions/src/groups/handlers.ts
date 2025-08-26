import { Response } from 'express';
import * as admin from 'firebase-admin';
import { AuthenticatedRequest } from '../auth/middleware';
import { firestoreDb } from '../firebase';
import { Errors } from '../utils/errors';
import { HTTP_STATUS, DOCUMENT_CONFIG } from '../constants';
import { createOptimisticTimestamp, createTrueServerTimestamp, parseISOToTimestamp, timestampToISO, getRelativeTime } from '../utils/dateHelpers';
import { validateCreateGroup, validateUpdateGroup, validateGroupId, sanitizeGroupData } from './validation';
import { Group, GroupWithBalance } from '../types/group-types';
import {
    FirestoreCollections,
    UserThemeColor,
    GroupFullDetails,
    ListGroupsResponse,
    MessageResponse,
    DELETED_AT_FIELD,
    SecurityPresets,
    MemberRoles,
    MemberStatuses,
} from '@splitifyd/shared';
import { buildPaginatedQuery, encodeCursor } from '../utils/pagination';
import { logger, LoggerContext } from '../logger';
import { calculateGroupBalances, calculateGroupBalancesWithData } from '../services/balance';
import { userService } from '../services/userService';
import { PermissionEngine } from '../permissions';
import { calculateExpenseMetadata } from '../services/expenseMetadataService';
import { getUpdatedAtTimestamp, updateWithTimestamp } from '../utils/optimistic-locking';
import { _getGroupMembersData } from './memberHandlers';
import { _getGroupExpensesData } from '../expenses/handlers';
import { _getGroupSettlementsData } from '../settlements/handlers';
import { USER_COLORS, COLOR_PATTERNS } from '../constants/user-colors';
import { isGroupOwner, isGroupMember } from '../utils/groupHelpers';

/**
 * Get theme color for a member based on their index
 */
const getThemeColorForMember = (memberIndex: number): UserThemeColor => {
    const colorIndex = memberIndex % USER_COLORS.length;
    const patternIndex = Math.floor(memberIndex / USER_COLORS.length) % COLOR_PATTERNS.length;
    const color = USER_COLORS[colorIndex];
    const pattern = COLOR_PATTERNS[patternIndex];

    return {
        light: color.light,
        dark: color.dark,
        name: color.name,
        pattern,
        assignedAt: new Date().toISOString(),
        colorIndex,
    };
};

/**
 * Get the groups collection reference
 */
const getGroupsCollection = () => {
    return firestoreDb.collection(FirestoreCollections.GROUPS); // Using existing collection during migration
};

/**
 * Transform Firestore document to Group format
 */
export const transformGroupDocument = (doc: admin.firestore.DocumentSnapshot): Group => {
    const data = doc.data();
    if (!data) {
        throw new Error('Invalid group document');
    }

    // Expect consistent document structure
    if (!data.data) {
        throw new Error('Invalid group document structure: missing data field');
    }
    const groupData = data.data;

    // Transform members to ensure joinedAt follows the same pattern as createdAt/updatedAt
    const transformedMembers: Record<string, any> = {};
    for (const [userId, member] of Object.entries(groupData.members)) {
        const memberData = member as any;
        transformedMembers[userId] = {
            ...memberData
        };
    }

    // Ensure required permission fields are always present
    const securityPreset = groupData.securityPreset || SecurityPresets.OPEN;
    const permissions = groupData.permissions || PermissionEngine.getDefaultPermissions(securityPreset);

    return {
        id: doc.id,
        name: groupData.name!,
        description: groupData.description ?? '',
        createdBy: groupData.createdBy!,
        members: transformedMembers,
        createdAt: data.createdAt!.toDate().toISOString(),
        updatedAt: data.updatedAt!.toDate().toISOString(),

        // Permission system fields - guaranteed to be present
        securityPreset,
        permissions,
        presetAppliedAt: groupData.presetAppliedAt
    };
};

/**
 * Add computed fields to Group
 */
const addComputedFields = async (group: Group, userId: string): Promise<Group> => {
    // Calculate real balance for the user
    const groupBalances = await calculateGroupBalances(group.id);

    // Calculate expense metadata on-demand
    const expenseMetadata = await calculateExpenseMetadata(group.id);

    // Calculate currency-specific balances
    const balancesByCurrency: Record<string, any> = {};
    if (groupBalances.balancesByCurrency) {
        for (const [currency, currencyBalances] of Object.entries(groupBalances.balancesByCurrency)) {
            const currencyUserBalance = currencyBalances[userId];
            if (currencyUserBalance && Math.abs(currencyUserBalance.netBalance) > 0.01) {
                balancesByCurrency[currency] = {
                    currency,
                    netBalance: currencyUserBalance.netBalance,
                    totalOwed: currencyUserBalance.netBalance > 0 ? currencyUserBalance.netBalance : 0,
                    totalOwing: currencyUserBalance.netBalance < 0 ? Math.abs(currencyUserBalance.netBalance) : 0,
                };
            }
        }
    }

    return {
        ...group,
        balance: {
            balancesByCurrency,
        },
        lastActivity: expenseMetadata.lastExpenseTime ? `Last expense ${expenseMetadata.lastExpenseTime.toLocaleDateString()}` : 'No recent activity',
        lastActivityRaw: expenseMetadata.lastExpenseTime ? expenseMetadata.lastExpenseTime.toISOString() : group.createdAt,
    };
};

/**
 * Fetch a group and verify user access
 */
const fetchGroupWithAccess = async (groupId: string, userId: string, requireWriteAccess: boolean = false): Promise<{ docRef: admin.firestore.DocumentReference; group: Group }> => {
    const docRef = getGroupsCollection().doc(groupId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw Errors.NOT_FOUND('Group');
    }

    const group = transformGroupDocument(doc);

    // Check if user is the owner
    if (isGroupOwner(group, userId)) {
        const groupWithComputed = await addComputedFields(group, userId);
        return { docRef, group: groupWithComputed };
    }

    // For write operations, only the owner is allowed
    if (requireWriteAccess) {
        throw Errors.FORBIDDEN();
    }

    // For read operations, check if user is a member
    if (isGroupMember(group, userId)) {
        const groupWithComputed = await addComputedFields(group, userId);
        return { docRef, group: groupWithComputed };
    }

    // User doesn't have access to this group
    // SECURITY: Return 404 instead of 403 to prevent information disclosure.
    // This prevents attackers from enumerating valid group IDs.
    throw Errors.NOT_FOUND('Group');
};

/**
 * Create a new group
 */
export const createGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        // Validate request body
        const groupData = validateCreateGroup(req.body);

        // Sanitize group data
        const sanitizedData = sanitizeGroupData(groupData);

        // Initialize group structure with server timestamps
        const docRef = getGroupsCollection().doc();
        const serverTimestamp = createTrueServerTimestamp(); // This returns FieldValue.serverTimestamp()

        // For the data field, we need actual timestamps for the response
        const now = createOptimisticTimestamp();

        // Create member list with theme assignments
        const initialMemberIds = sanitizedData.members ? sanitizedData.members.map((m: any) => m.uid) : [userId];
        const members: Record<string, any> = {};

        // Ensure creator is always first with theme index 0 and gets admin role
        members[userId] = {
            role: MemberRoles.ADMIN,
            status: MemberStatuses.ACTIVE,
            theme: getThemeColorForMember(0),
            joinedAt: now.toDate().toISOString(), // Convert to ISO string for consistency
        };

        // Add other members with incrementing theme indices
        let memberIndex = 1;
        for (const memberId of initialMemberIds) {
            if (memberId !== userId) {
                members[memberId] = {
                    role: MemberRoles.MEMBER,
                    status: MemberStatuses.ACTIVE,
                    theme: getThemeColorForMember(memberIndex),
                    joinedAt: now.toDate().toISOString(), // Convert to ISO string for consistency
                };
                memberIndex++;
            }
        }

        const newGroup: Group = {
            id: docRef.id,
            name: sanitizedData.name,
            description: sanitizedData.description ?? '',
            createdBy: userId,
            members: members,
            createdAt: timestampToISO(now),
            updatedAt: timestampToISO(now),
            securityPreset: SecurityPresets.OPEN,
            presetAppliedAt: timestampToISO(now),
            permissions: PermissionEngine.getDefaultPermissions(SecurityPresets.OPEN),
        };

        // Store in Firestore with true server timestamps for the document-level timestamps
        await docRef.set({
            data: newGroup,
            createdAt: serverTimestamp, // True server timestamp
            updatedAt: serverTimestamp, // True server timestamp
        });

        // Add group context to logger
        LoggerContext.setBusinessContext({ groupId: docRef.id });

        // Log without explicitly passing userId - it will be automatically included
        logger.info('group-created', { id: docRef.id });

        const createdDoc = await docRef.get();
        const group = transformGroupDocument(createdDoc);
        const groupWithComputed = await addComputedFields(group, userId);

        res.status(HTTP_STATUS.CREATED).json(groupWithComputed);
    } catch (error) {
        logger.error('Error in createGroup', error, { userId: req.user?.uid });
        throw error;
    }
};

/**
 * Get a single group by ID
 */
export const getGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
        throw Errors.UNAUTHORIZED();
    }
    const groupId = validateGroupId(req.params.id);

    const { group } = await fetchGroupWithAccess(groupId, userId);

    // Calculate balance information on-demand
    const groupBalances = await calculateGroupBalances(groupId);

    // Calculate currency-specific balances
    const balancesByCurrency: Record<string, any> = {};
    if (groupBalances.balancesByCurrency) {
        for (const [currency, currencyBalances] of Object.entries(groupBalances.balancesByCurrency)) {
            const currencyUserBalance = currencyBalances[userId];
            if (currencyUserBalance && Math.abs(currencyUserBalance.netBalance) > 0.01) {
                balancesByCurrency[currency] = {
                    currency,
                    netBalance: currencyUserBalance.netBalance,
                    totalOwed: currencyUserBalance.netBalance > 0 ? currencyUserBalance.netBalance : 0,
                    totalOwing: currencyUserBalance.netBalance < 0 ? Math.abs(currencyUserBalance.netBalance) : 0,
                };
            }
        }
    }

    // Get user's balance from first available currency
    let userBalance: any = null;
    if (groupBalances.balancesByCurrency) {
        const currencyBalances = Object.values(groupBalances.balancesByCurrency)[0];

        if (currencyBalances && currencyBalances[userId]) {
            const balance = currencyBalances[userId];
            userBalance = {
                netBalance: balance.netBalance,
                totalOwed: balance.netBalance > 0 ? balance.netBalance : 0,
                totalOwing: balance.netBalance < 0 ? Math.abs(balance.netBalance) : 0,
            };
        }
    }

    const groupWithBalance: GroupWithBalance = {
        ...group,
        balance: {
            userBalance,
            balancesByCurrency,
        },
    };

    res.json(groupWithBalance);
};

/**
 * Update an existing group
 */
export const updateGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
        throw Errors.UNAUTHORIZED();
    }
    const groupId = validateGroupId(req.params.id);

    // Validate request body
    const updates = validateUpdateGroup(req.body);

    // Sanitize update data
    const sanitizedUpdates = sanitizeGroupData(updates);

    // Fetch group with write access check
    const { docRef, group } = await fetchGroupWithAccess(groupId, userId, true);

    // Update with optimistic locking (timestamp is handled by optimistic locking system)
    await firestoreDb.runTransaction(async (transaction) => {
        const freshDoc = await transaction.get(docRef);
        if (!freshDoc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const originalUpdatedAt = getUpdatedAtTimestamp(freshDoc.data(), docRef.id);

        // Create updated data with current timestamp (will be converted to ISO in the data field)
        const now = createOptimisticTimestamp();
        const updatedData = {
            ...group,
            ...sanitizedUpdates,
            updatedAt: now.toDate(),
        };

        // Use existing pattern since we already have the fresh document from transaction read
        await updateWithTimestamp(
            transaction,
            docRef,
            {
                'data.name': updatedData.name,
                'data.description': updatedData.description,
                'data.updatedAt': updatedData.updatedAt.toISOString(),
            },
            originalUpdatedAt,
        );
    });

    // Set group context
    LoggerContext.setBusinessContext({ groupId });

    // Log without explicitly passing userId - it will be automatically included
    logger.info('group-updated', { id: groupId });

    const response: MessageResponse = { message: 'Group updated successfully' };
    res.json(response);
};

/**
 * Delete a group
 */
export const deleteGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
        throw Errors.UNAUTHORIZED();
    }
    const groupId = validateGroupId(req.params.id);

    // Fetch group with write access check
    const { docRef } = await fetchGroupWithAccess(groupId, userId, true);

    // Check if group has expenses
    const expensesSnapshot = await firestoreDb.collection(FirestoreCollections.EXPENSES).where('groupId', '==', groupId).limit(1).get();

    if (!expensesSnapshot.empty) {
        throw Errors.INVALID_INPUT('Cannot delete group with expenses. Delete all expenses first.');
    }

    // Delete the group
    await docRef.delete();

    // Set group context
    LoggerContext.setBusinessContext({ groupId });

    // Log without explicitly passing userId - it will be automatically included
    logger.info('group-deleted', { id: groupId });

    const response: MessageResponse = { message: 'Group deleted successfully' };
    res.json(response);
};

/**
 * Batch fetch all expenses and settlements for multiple groups
 */
const batchFetchGroupData = async (groupIds: string[]): Promise<{
    expensesByGroup: Map<string, any[]>,
    settlementsByGroup: Map<string, any[]>,
    expenseMetadataByGroup: Map<string, { count: number, lastExpenseTime?: Date }>
}> => {
    if (groupIds.length === 0) {
        return {
            expensesByGroup: new Map(),
            settlementsByGroup: new Map(),
            expenseMetadataByGroup: new Map()
        };
    }

    // Firestore 'in' query supports max 10 items - chunk if needed
    const chunks: string[][] = [];
    for (let i = 0; i < groupIds.length; i += 10) {
        chunks.push(groupIds.slice(i, i + 10));
    }

    // Batch fetch all expenses and settlements for all groups
    const expenseQueries = chunks.map(chunk =>
        firestoreDb.collection(FirestoreCollections.EXPENSES)
            .where('groupId', 'in', chunk)
            .get()
    );

    const settlementQueries = chunks.map(chunk =>
        firestoreDb.collection(FirestoreCollections.SETTLEMENTS)
            .where('groupId', 'in', chunk)
            .get()
    );

    // Execute all queries in parallel
    const [expenseResults, settlementResults] = await Promise.all([
        Promise.all(expenseQueries),
        Promise.all(settlementQueries)
    ]);

    // Organize expenses by group ID
    const expensesByGroup = new Map<string, any[]>();
    const expenseMetadataByGroup = new Map<string, { count: number, lastExpenseTime?: Date }>();

    for (const snapshot of expenseResults) {
        for (const doc of snapshot.docs) {
            const expenseData = doc.data();
            const expense = { id: doc.id, groupId: expenseData.groupId, ...expenseData };
            const groupId = expense.groupId;

            if (!expensesByGroup.has(groupId)) {
                expensesByGroup.set(groupId, []);
            }
            expensesByGroup.get(groupId)!.push(expense);
        }
    }

    // Calculate metadata for each group
    for (const [groupId, expenses] of expensesByGroup.entries()) {
        const nonDeletedExpenses = expenses.filter(expense => !expense[DELETED_AT_FIELD]);
        const sortedExpenses = nonDeletedExpenses.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime; // DESC order
        });

        expenseMetadataByGroup.set(groupId, {
            count: nonDeletedExpenses.length,
            lastExpenseTime: sortedExpenses.length > 0 ? sortedExpenses[0].createdAt?.toDate() : undefined
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
    for (const snapshot of settlementResults) {
        for (const doc of snapshot.docs) {
            const settlementData = doc.data();
            const settlement = { id: doc.id, groupId: settlementData.groupId, ...settlementData };
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
        expenseMetadataByGroup
    };
};

/**
 * List all groups for the authenticated user
 * PERFORMANCE OPTIMIZED: Fixes N+1 query problem by batching all database calls
 */
export const listGroups = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
        throw Errors.UNAUTHORIZED();
    }

    // Parse pagination parameters
    const limit = Math.min(parseInt(req.query.limit as string) || DOCUMENT_CONFIG.LIST_LIMIT, DOCUMENT_CONFIG.LIST_LIMIT);
    const cursor = req.query.cursor as string;
    const order = (req.query.order as 'asc' | 'desc') ?? 'desc';
    const includeMetadata = req.query.includeMetadata === 'true';

    // Build base query - groups where user is a member
    const baseQuery = getGroupsCollection()
        .where(`data.members.${userId}`, '!=', null)
        .select('data', 'createdAt', 'updatedAt');

    // Build paginated query
    const paginatedQuery = buildPaginatedQuery(baseQuery, cursor, order, limit + 1);

    // Execute parallel queries for performance
    const queries: Promise<any>[] = [paginatedQuery.get()];

    // Include metadata query if requested
    if (includeMetadata) {
        // Get recent changes (last 60 seconds)
        const changesQuery = admin
            .firestore()
            .collection(FirestoreCollections.GROUP_CHANGES)
            .where('timestamp', '>', new Date(Date.now() - 60000))
            .where('metadata.affectedUsers', 'array-contains', userId)
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();
        queries.push(changesQuery);
    }

    const results = await Promise.all(queries);
    const snapshot = results[0] as admin.firestore.QuerySnapshot;
    const changesSnapshot = includeMetadata ? results[1] as admin.firestore.QuerySnapshot : null;
    const documents = snapshot.docs;

    // Determine if there are more results
    const hasMore = documents.length > limit;
    const returnedDocs = hasMore ? documents.slice(0, limit) : documents;

    // Transform documents to groups and extract group IDs
    const groups: Group[] = returnedDocs.map((doc: admin.firestore.QueryDocumentSnapshot) =>
        transformGroupDocument(doc)
    );
    const groupIds = groups.map(group => group.id);

    // 🚀 PERFORMANCE FIX: Batch fetch all data for all groups in 3 queries instead of N×4
    const { expensesByGroup, settlementsByGroup, expenseMetadataByGroup } = await batchFetchGroupData(groupIds);

    // Batch fetch user profiles for all members across all groups
    const allMemberIds = new Set<string>();
    for (const group of groups) {
        Object.keys(group.members).forEach(memberId => allMemberIds.add(memberId));
    }
    const allMemberProfiles = await userService.getUsers(Array.from(allMemberIds));

    // Process each group using batched data - no more database calls!
    const groupsWithBalances: Group[] = groups.map((group) => {
        // Get pre-fetched data for this group (no database calls)
        const expenses = expensesByGroup.get(group.id) || [];
        const settlements = settlementsByGroup.get(group.id) || [];
        const expenseMetadata = expenseMetadataByGroup.get(group.id) || { count: 0 };

        // Get member profiles for this group
        const memberIds = Object.keys(group.members);
        const memberProfiles = new Map<string, any>();
        for (const memberId of memberIds) {
            const profile = allMemberProfiles.get(memberId);
            if (profile) {
                memberProfiles.set(memberId, profile);
            }
        }

        // 🚀 OPTIMIZED: Use pre-fetched data instead of making database calls
        let groupBalances;
        try {
            // Create the input structure expected by the balance service
            const balanceInput = {
                groupId: group.id,
                expenses,
                settlements,
                groupData: {
                    id: group.id,
                    data: {
                        members: group.members,
                        name: group.name,
                        description: group.description,
                        createdBy: group.createdBy
                    }
                },
                memberProfiles
            };

            // Use optimized balance calculation with pre-fetched data
            groupBalances = calculateGroupBalancesWithData(balanceInput);
        } catch (error) {
            logger.error('Error calculating balances', error, { groupId: group.id });
            // Provide fallback empty balances
            groupBalances = {
                balancesByCurrency: {},
                userBalances: {},
                simplifiedDebts: {}
            };
        }

            // Calculate currency-specific balances
            const balancesByCurrency: Record<string, any> = {};
            if (groupBalances.balancesByCurrency) {
                for (const [currency, currencyBalances] of Object.entries(groupBalances.balancesByCurrency)) {
                    const currencyUserBalance = currencyBalances[userId];
                    if (currencyUserBalance && Math.abs(currencyUserBalance.netBalance) > 0.01) {
                        balancesByCurrency[currency] = {
                            currency,
                            netBalance: currencyUserBalance.netBalance,
                            totalOwed: currencyUserBalance.netBalance > 0 ? currencyUserBalance.netBalance : 0,
                            totalOwing: currencyUserBalance.netBalance < 0 ? Math.abs(currencyUserBalance.netBalance) : 0,
                        };
                    }
                }
            }

            // Format last activity using pre-fetched metadata
            const lastActivityDate = expenseMetadata.lastExpenseTime ?? new Date(group.updatedAt);
            const lastActivity = formatRelativeTime(lastActivityDate.toISOString());

            // Get user's balance from first available currency
            let userBalance: any = null;
            if (groupBalances.balancesByCurrency) {
                const currencyBalances = Object.values(groupBalances.balancesByCurrency)[0];

                if (currencyBalances && currencyBalances[userId]) {
                    const balance = currencyBalances[userId];
                    userBalance = {
                        netBalance: balance.netBalance,
                        totalOwed: balance.netBalance > 0 ? balance.netBalance : 0,
                        totalOwing: balance.netBalance < 0 ? Math.abs(balance.netBalance) : 0,
                    };
                }
            }

            return {
                ...group,
                balance: {
                    userBalance,
                    balancesByCurrency,
                },
                lastActivity,
                lastActivityRaw: lastActivityDate.toISOString(),
            };
        });

    // Generate nextCursor if there are more results
    let nextCursor: string | undefined;
    if (hasMore && returnedDocs.length > 0) {
        const lastDoc = returnedDocs[returnedDocs.length - 1];
        const lastGroup = transformGroupDocument(lastDoc);
        nextCursor = encodeCursor({
            updatedAt: lastGroup.updatedAt,
            id: lastGroup.id,
        });
    }

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

    // Add metadata if requested
    if (includeMetadata && changesSnapshot) {
        const lastChange = changesSnapshot.docs[0];
        response.metadata = {
            lastChangeTimestamp: lastChange?.data().timestamp?.toMillis() || 0,
            changeCount: changesSnapshot.size,
            serverTime: Date.now(),
            hasRecentChanges: changesSnapshot.size > 0
        };
    }

    res.json(response);
};

/**
 * Get consolidated group details (group + members + expenses + balances + settlements)
 * Reuses existing tested handler logic to eliminate race conditions
 * Supports pagination for expenses and settlements
 */
export const getGroupFullDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
        throw Errors.UNAUTHORIZED();
    }
    const groupId = validateGroupId(req.params.id);

    // Parse pagination parameters from query string
    const expenseLimit = Math.min(parseInt(req.query.expenseLimit as string) || 20, 100);
    const expenseCursor = req.query.expenseCursor as string;
    const settlementLimit = Math.min(parseInt(req.query.settlementLimit as string) || 20, 100);
    const settlementCursor = req.query.settlementCursor as string;

    try {
        // Reuse existing tested functions for each data type
        const { group } = await fetchGroupWithAccess(groupId, userId);

        // Use extracted internal functions to eliminate duplication
        const [membersData, expensesData, balancesData, settlementsData] = await Promise.all([
            // Get members using extracted function with theme information
            _getGroupMembersData(groupId, group.members),

            // Get expenses using extracted function with pagination
            _getGroupExpensesData(groupId, {
                limit: expenseLimit,
                cursor: expenseCursor
            }),

            // Get balances using existing calculator
            calculateGroupBalances(groupId),

            // Get settlements using extracted function with pagination
            _getGroupSettlementsData(groupId, {
                limit: settlementLimit,
                cursor: settlementCursor
            })
        ]);

        // Construct response using existing patterns
        const response: GroupFullDetails = {
            group,
            members: membersData,
            expenses: expensesData,
            balances: balancesData as any, // Type conversion - GroupBalance from models matches GroupBalances structure
            settlements: settlementsData
        };

        res.json(response);
    } catch (error) {
        logger.error('Error in getGroupFullDetails', error, {
            groupId,
            userId,
        });
        throw error;
    }
};

/**
 * Format a date as relative time (e.g., "2 hours ago")
 * Now uses centralized date helpers for consistency
 */
const formatRelativeTime = (dateStr: string): string => {
    const timestamp = parseISOToTimestamp(dateStr);
    if (!timestamp) {
        return 'unknown';
    }
    return getRelativeTime(timestamp);
};
