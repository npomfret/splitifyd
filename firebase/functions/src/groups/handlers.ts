import { Response } from 'express';

import { DocumentSnapshot } from 'firebase-admin/firestore';
import { AuthenticatedRequest } from '../auth/middleware';
import { Errors } from '../utils/errors';
import { HTTP_STATUS, DOCUMENT_CONFIG } from '../constants';
import { validateCreateGroup, validateUpdateGroup, validateGroupId, sanitizeGroupData } from './validation';
import { Group } from '../types/group-types';
import { SecurityPresets } from '@splitifyd/shared';
import { logger } from '../logger';
import { PermissionEngine } from '../permissions';
import { getGroupService } from '../services/serviceRegistration';
import { GroupDocumentSchema } from '../schemas';
import { z } from 'zod';

// Group schemas are now centralized in ../schemas/

/**
 * Transform Firestore document to Group format
 */
export const transformGroupDocument = (doc: DocumentSnapshot): Group => {
    const rawData = doc.data();
    if (!rawData) {
        throw new Error('Invalid group document');
    }

    // Validate the group document structure
    let data: z.infer<typeof GroupDocumentSchema>;
    try {
        const dataWithId = { ...rawData, id: doc.id };
        data = GroupDocumentSchema.parse(dataWithId);
    } catch (error) {
        logger.error('Invalid group document structure', error as Error, {
            groupId: doc.id,
            validationErrors: error instanceof z.ZodError ? error.issues : undefined,
        });
        throw new Error('Group data is corrupted');
    }

    const groupData = data;

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
        createdAt: groupData.createdAt!.toDate().toISOString(),
        updatedAt: groupData.updatedAt!.toDate().toISOString(),

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
    const group = await getGroupService().createGroup(userId, sanitizedData);

    res.status(HTTP_STATUS.CREATED).json(group);
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
    const response = await getGroupService().updateGroup(groupId, userId, sanitizedUpdates);

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
    const response = await getGroupService().deleteGroup(groupId, userId);

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

    const response = await getGroupService().listGroups(userId, {
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
    const expenseLimit = parseInt(req.query.expenseLimit as string) || 20;
    const expenseCursor = req.query.expenseCursor as string;
    const settlementLimit = parseInt(req.query.settlementLimit as string) || 20;
    const settlementCursor = req.query.settlementCursor as string;

    const result = await getGroupService().getGroupFullDetails(groupId, userId, {
        expenseLimit,
        expenseCursor,
        settlementLimit,
        settlementCursor,
    });

    res.json(result);
};
