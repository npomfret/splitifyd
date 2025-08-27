import { Response } from 'express';
import * as admin from 'firebase-admin';
import { AuthenticatedRequest } from '../auth/middleware';
import { firestoreDb } from '../firebase';
import { Errors } from '../utils/errors';
import { HTTP_STATUS, DOCUMENT_CONFIG } from '../constants';
import { createOptimisticTimestamp } from '../utils/dateHelpers';
import { validateCreateGroup, validateUpdateGroup, validateGroupId, sanitizeGroupData } from './validation';
import { Group } from '../types/group-types';
import {
    FirestoreCollections,
    GroupFullDetails,
    MessageResponse,
    SecurityPresets,
    MemberRoles,
    MemberStatuses,
} from '@splitifyd/shared';
import { logger, LoggerContext } from '../logger';
import { PermissionEngine } from '../permissions';
import { calculateGroupBalances } from '../services/balance';
import { groupService } from '../services/GroupService';
import { calculateExpenseMetadata } from '../services/expenseMetadataService';
import { getUpdatedAtTimestamp, updateWithTimestamp } from '../utils/optimistic-locking';
import { _getGroupMembersData } from './memberHandlers';
import { _getGroupExpensesData } from '../expenses/handlers';
import { _getGroupSettlementsData } from '../settlements/handlers';
import { isGroupOwner, isGroupMember } from '../utils/groupHelpers';
import { z } from 'zod';

/**
 * Zod schemas for group document validation
 */
const GroupMemberSchema = z.object({
    role: z.nativeEnum(MemberRoles),
    status: z.nativeEnum(MemberStatuses),
    joinedAt: z.any(), // Firestore Timestamp
    invitedBy: z.string().optional(),
    invitedAt: z.any().optional(), // Firestore Timestamp
    color: z.object({
        light: z.string(),
        dark: z.string(),
        name: z.string(),
        pattern: z.string(),
        assignedAt: z.string(),
        colorIndex: z.number(),
    }).optional(),
}).passthrough();

const GroupDataSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    createdBy: z.string().min(1),
    members: z.record(z.string(), GroupMemberSchema),
    securityPreset: z.nativeEnum(SecurityPresets).optional(),
    permissions: z.object({
        expenseEditing: z.string(),
        expenseDeletion: z.string(),
        memberInvitation: z.string(),
        memberApproval: z.union([z.literal('automatic'), z.literal('admin-required')]),
        settingsManagement: z.string(),
    }).passthrough().optional(), // Allow extra fields like settlementCreation, memberManagement, groupManagement
    presetAppliedAt: z.any().optional(), // Firestore Timestamp
}).passthrough();

const GroupDocumentSchema = z.object({
    data: GroupDataSchema,
    createdAt: z.any(), // Firestore Timestamp
    updatedAt: z.any(), // Firestore Timestamp
}).passthrough();


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
    const rawData = doc.data();
    if (!rawData) {
        throw new Error('Invalid group document');
    }

    // Validate the group document structure
    let data: z.infer<typeof GroupDocumentSchema>;
    try {
        data = GroupDocumentSchema.parse(rawData);
    } catch (error) {
        logger.error('Invalid group document structure', error as Error, { 
            groupId: doc.id, 
            validationErrors: error instanceof z.ZodError ? error.issues : undefined 
        });
        throw new Error('Group data is corrupted');
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
        permissions: permissions as any, // Cast to any since extra fields are allowed and will be handled by permission engine
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
    const userId = req.user?.uid;
    if (!userId) {
        throw Errors.UNAUTHORIZED();
    }

    // Validate request body
    const groupData = validateCreateGroup(req.body);

    // Sanitize group data
    const sanitizedData = sanitizeGroupData(groupData);

    // Use GroupService to create the group
    const group = await groupService.createGroup(userId, sanitizedData);

    res.status(HTTP_STATUS.CREATED).json(group);
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

    const groupWithBalance = await groupService.getGroup(groupId, userId);
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

    const response = await groupService.listGroups(userId, {
        limit,
        cursor,
        order,
        includeMetadata,
    });

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

