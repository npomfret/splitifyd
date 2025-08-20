import { Response } from 'express';
import * as admin from 'firebase-admin';
import { AuthenticatedRequest } from '../auth/middleware';
import { db } from '../firebase';
import { Errors } from '../utils/errors';
import { HTTP_STATUS, DOCUMENT_CONFIG } from '../constants';
import { createOptimisticTimestamp, createTrueServerTimestamp, parseISOToTimestamp, timestampToISO, getRelativeTime } from '../utils/dateHelpers';
import { validateCreateGroup, validateUpdateGroup, validateGroupId, sanitizeGroupData } from './validation';
import { Group, GroupWithBalance } from '../types/group-types';
import { FirestoreCollections } from '../shared/shared-types';
import { buildPaginatedQuery, encodeCursor } from '../utils/pagination';
import { logger, LoggerContext } from '../logger';
import { calculateGroupBalances } from '../services/balanceCalculator';
import { calculateExpenseMetadata } from '../services/expenseMetadataService';
import { getUpdatedAtTimestamp, updateWithTimestamp } from '../utils/optimistic-locking';
import { _getGroupMembersData } from './memberHandlers';
import { _getGroupExpensesData } from '../expenses/handlers';
import { _getGroupSettlementsData } from '../settlements/handlers';

/**
 * Get the groups collection reference
 */
const getGroupsCollection = () => {
    return db.collection(FirestoreCollections.GROUPS); // Using existing collection during migration
};

/**
 * Transform Firestore document to Group format
 */
const transformGroupDocument = (doc: admin.firestore.DocumentSnapshot): Group => {
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
            ...memberData,
            // Convert Firestore Timestamp to ISO string if it exists, matching pattern of createdAt/updatedAt
            joinedAt: memberData.joinedAt?.toDate 
                ? memberData.joinedAt.toDate().toISOString()
                : (memberData.joinedAt?._seconds 
                    ? new Date(memberData.joinedAt._seconds * 1000).toISOString()
                    : memberData.joinedAt)
        };
    }

    return {
        id: doc.id,
        name: groupData.name!,
        description: groupData.description ?? '',
        createdBy: groupData.createdBy!,
        members: transformedMembers,
        memberIds: Object.keys(groupData.members), // Computed from members
        createdAt: data.createdAt!.toDate().toISOString(),
        updatedAt: data.updatedAt!.toDate().toISOString(),
    } as Group;
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
    if (group.createdBy === userId) {
        const groupWithComputed = await addComputedFields(group, userId);
        return { docRef, group: groupWithComputed };
    }

    // For write operations, only the owner is allowed
    if (requireWriteAccess) {
        throw Errors.FORBIDDEN();
    }

    // For read operations, check if user is a member
    if (userId in group.members) {
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
        
        // Ensure creator is always first with theme index 0
        members[userId] = {
            isCreator: true,
            themeIndex: 0,
            joinedAt: now.toDate().toISOString(), // Convert to ISO string for consistency
        };
        
        // Add other members with incrementing theme indices
        let memberIndex = 1;
        for (const memberId of initialMemberIds) {
            if (memberId !== userId) {
                members[memberId] = {
                    isCreator: false,
                    themeIndex: memberIndex,
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
            memberIds: Object.keys(members), // DEPRECATED: Computed from members for backward compatibility
            createdAt: timestampToISO(now),
            updatedAt: timestampToISO(now),
        };

        // Store in Firestore with true server timestamps for the document-level timestamps
        await docRef.set({
            userId,
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
    await db.runTransaction(async (transaction) => {
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

    res.json({ message: 'Group updated successfully' });
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
    const expensesSnapshot = await db.collection(FirestoreCollections.EXPENSES).where('groupId', '==', groupId).limit(1).get();

    if (!expensesSnapshot.empty) {
        throw Errors.INVALID_INPUT('Cannot delete group with expenses. Delete all expenses first.');
    }

    // Delete the group
    await docRef.delete();

    // Set group context
    LoggerContext.setBusinessContext({ groupId });
    
    // Log without explicitly passing userId - it will be automatically included
    logger.info('group-deleted', { id: groupId });

    res.json({ message: 'Group deleted successfully' });
};

/**
 * List all groups for the authenticated user
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
    const baseQuery = getGroupsCollection().where('data.memberIds', 'array-contains', userId).select('data', 'createdAt', 'updatedAt', 'userId');

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

    // Transform documents to groups
    const groups: Group[] = await Promise.all(
        returnedDocs.map(async (doc: admin.firestore.QueryDocumentSnapshot) => {
            const group = transformGroupDocument(doc);

            // Calculate balance for each group on-demand
            const groupBalances = await calculateGroupBalances(group.id);
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

            // Calculate expense metadata for each group
            const expenseMetadata = await calculateExpenseMetadata(group.id);

            // Format last activity
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
        }),
    );

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

    const response: any = {
        groups,
        count: groups.length,
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
        const response = {
            group,
            members: membersData,
            expenses: expensesData,
            balances: balancesData,
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
