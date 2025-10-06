import { Response } from 'express';

import { AuthenticatedRequest } from '../auth/middleware';
import { Errors } from '../utils/errors';
import { HTTP_STATUS, DOCUMENT_CONFIG } from '../constants';
import { validateCreateGroup, validateUpdateGroup, validateGroupId, sanitizeGroupData } from './validation';
import { getAuth, getFirestore } from '../firebase';
import { ApplicationBuilder } from '../services/ApplicationBuilder';

const firestore = getFirestore();
const applicationBuilder = ApplicationBuilder.createApplicationBuilder(firestore, getAuth());
const groupService = applicationBuilder.buildGroupService();

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
    const direction = (req.query.order as 'asc' | 'desc') ?? 'desc';

    const response = await groupService.listGroups(userId, {
        limit,
        cursor,
        orderBy: {
            field: 'updatedAt',
            direction,
        },
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

    const result = await groupService.getGroupFullDetails(groupId, userId, {
        expenseLimit,
        expenseCursor,
        settlementLimit,
        settlementCursor,
    });

    res.json(result);
};
