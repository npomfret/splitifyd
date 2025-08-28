import { Response } from 'express';
import * as admin from 'firebase-admin';
import { AuthenticatedRequest } from '../auth/middleware';
import { Errors } from '../utils/errors';
import { HTTP_STATUS, DOCUMENT_CONFIG } from '../constants';
import { validateCreateGroup, validateUpdateGroup, validateGroupId, sanitizeGroupData } from './validation';
import { Group } from '../types/group-types';
import { GroupFullDetails, SecurityPresets, MemberRoles, MemberStatuses } from '@splitifyd/shared';
import { logger } from '../logger';
import { PermissionEngine } from '../permissions';
import { calculateGroupBalances } from '../services/balance';
import { groupService } from '../services/GroupService';
import { _getGroupMembersData } from './memberHandlers';
import { _getGroupExpensesData } from '../expenses/handlers';
import { SettlementService } from '../services/SettlementService';
import { z } from 'zod';

/**
 * Zod schemas for group document validation
 */
const GroupMemberSchema = z
    .object({
        role: z.nativeEnum(MemberRoles),
        status: z.nativeEnum(MemberStatuses),
        joinedAt: z.any(), // Firestore Timestamp
        invitedBy: z.string().optional(),
        invitedAt: z.any().optional(), // Firestore Timestamp
        color: z
            .object({
                light: z.string(),
                dark: z.string(),
                name: z.string(),
                pattern: z.string(),
                assignedAt: z.string(),
                colorIndex: z.number(),
            })
            .optional(),
    })
    .passthrough();

const GroupDataSchema = z
    .object({
        name: z.string().min(1),
        description: z.string().optional(),
        createdBy: z.string().min(1),
        members: z.record(z.string(), GroupMemberSchema),
        securityPreset: z.nativeEnum(SecurityPresets).optional(),
        permissions: z
            .object({
                expenseEditing: z.string(),
                expenseDeletion: z.string(),
                memberInvitation: z.string(),
                memberApproval: z.union([z.literal('automatic'), z.literal('admin-required')]),
                settingsManagement: z.string(),
            })
            .passthrough()
            .optional(), // Allow extra fields like settlementCreation, memberManagement, groupManagement
        presetAppliedAt: z.any().optional(), // Firestore Timestamp
    })
    .passthrough();

export const GroupDocumentSchema = z
    .object({
        data: GroupDataSchema,
        createdAt: z.any(), // Firestore Timestamp
        updatedAt: z.any(), // Firestore Timestamp
    })
    .passthrough();

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
            validationErrors: error instanceof z.ZodError ? error.issues : undefined,
        });
        throw new Error('Group data is corrupted');
    }

    const groupData = data.data;

    // Transform members to ensure joinedAt follows the same pattern as createdAt/updatedAt
    const transformedMembers: Record<string, any> = {};
    for (const [userId, member] of Object.entries(groupData.members)) {
        const memberData = member as any;
        transformedMembers[userId] = {
            ...memberData,
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
        presetAppliedAt: groupData.presetAppliedAt,
    };
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

    // Use GroupService to update the group
    const response = await groupService.updateGroup(groupId, userId, sanitizedUpdates);

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

    // Use GroupService to delete the group
    const response = await groupService.deleteGroup(groupId, userId);

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
        // Get group with access check (this will throw if user doesn't have access)
        const groupWithBalance = await groupService.getGroup(groupId, userId);
        // Extract the base group data (without the balance field added by getGroup)
        const group: Group = {
            id: groupWithBalance.id,
            name: groupWithBalance.name,
            description: groupWithBalance.description,
            createdBy: groupWithBalance.createdBy,
            members: groupWithBalance.members,
            createdAt: groupWithBalance.createdAt,
            updatedAt: groupWithBalance.updatedAt,
            securityPreset: groupWithBalance.securityPreset,
            permissions: groupWithBalance.permissions,
            presetAppliedAt: groupWithBalance.presetAppliedAt,
        };

        // Use extracted internal functions to eliminate duplication
        const [membersData, expensesData, balancesData, settlementsData] = await Promise.all([
            // Get members using extracted function with theme information
            _getGroupMembersData(groupId, group.members),

            // Get expenses using extracted function with pagination
            _getGroupExpensesData(groupId, {
                limit: expenseLimit,
                cursor: expenseCursor,
            }),

            // Get balances using existing calculator
            calculateGroupBalances(groupId),

            // Get settlements using extracted function with pagination
            new SettlementService()._getGroupSettlementsData(groupId, {
                limit: settlementLimit,
                cursor: settlementCursor,
            }),
        ]);

        // Construct response using existing patterns
        const response: GroupFullDetails = {
            group,
            members: membersData,
            expenses: expensesData,
            balances: balancesData as any, // Type conversion - GroupBalance from models matches GroupBalances structure
            settlements: settlementsData,
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
