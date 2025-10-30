import { MemberStatuses } from '@splitifyd/shared';
import type { MemberStatus } from '@splitifyd/shared';
import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { DOCUMENT_CONFIG, HTTP_STATUS } from '../constants';
import { GroupService } from '../services/GroupService';
import { Errors } from '../utils/errors';
import { sanitizeGroupData, validateCreateGroup, validateGroupId, validateUpdateDisplayName, validateUpdateGroup } from './validation';

export class GroupHandlers {
    constructor(private readonly groupService: GroupService,) {}

    /**
     * Create a new group
     */
    createGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        // Validate request body
        const groupData = validateCreateGroup(req.body);

        // Sanitize group data
        const sanitizedData = sanitizeGroupData(groupData);

        // Use GroupService to create the group
        const group = await this.groupService.createGroup(userId, sanitizedData);

        res.status(HTTP_STATUS.CREATED).json(group);
    };

    /**
     * Update an existing group
     */
    updateGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
        const response = await this.groupService.updateGroup(groupId, userId, sanitizedUpdates);

        res.json(response);
    };

    /**
     * Delete a group
     */
    deleteGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }
        const groupId = validateGroupId(req.params.id);

        // Use GroupService to delete the group
        const response = await this.groupService.deleteGroup(groupId, userId);

        res.json(response);
    };

    /**
     * List all groups for the authenticated user
     */
    listGroups = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        // Parse pagination parameters
        const limit = Math.min(parseInt(req.query.limit as string) || DOCUMENT_CONFIG.LIST_LIMIT, DOCUMENT_CONFIG.LIST_LIMIT);
        const cursor = req.query.cursor as string;
        const direction = (req.query.order as 'asc' | 'desc') ?? 'desc';
        const statusFilterParam = typeof req.query.statusFilter === 'string' ? req.query.statusFilter : undefined;

        let statusFilter: MemberStatus | MemberStatus[] | undefined;
        if (statusFilterParam) {
            const allowedStatuses = new Set<string>(Object.values(MemberStatuses));
            const requestedStatuses = statusFilterParam
                .split(',')
                .map((status) => status.trim().toLowerCase())
                .filter((status) => status.length > 0 && allowedStatuses.has(status));
            const uniqueStatuses = Array.from(new Set(requestedStatuses)) as MemberStatus[];

            if (uniqueStatuses.length === 1) {
                statusFilter = uniqueStatuses[0];
            } else if (uniqueStatuses.length > 1) {
                statusFilter = uniqueStatuses;
            }
        }

        const response = await this.groupService.listGroups(userId, {
            limit,
            cursor,
            orderBy: {
                field: 'updatedAt',
                direction,
            },
            statusFilter,
        });

        res.json(response);
    };

    /**
     * Get consolidated group details (group + members + expenses + balances + settlements)
     * Reuses existing tested handler logic to eliminate race conditions
     * Supports pagination for expenses and settlements
     */
    getGroupFullDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }
        const groupId = validateGroupId(req.params.id);

        // Parse pagination parameters from query string
        const expenseLimit = parseInt(req.query.expenseLimit as string) || 8;
        const expenseCursor = req.query.expenseCursor as string;
        const settlementLimit = parseInt(req.query.settlementLimit as string) || 8;
        const settlementCursor = req.query.settlementCursor as string;
        const includeDeletedExpenses = req.query.includeDeletedExpenses === 'true';
        const includeDeletedSettlements = req.query.includeDeletedSettlements === 'true';
        const commentLimit = parseInt(req.query.commentLimit as string) || 8;
        const commentCursor = req.query.commentCursor as string;

        const result = await this.groupService.getGroupFullDetails(groupId, userId, {
            expenseLimit,
            expenseCursor,
            includeDeletedExpenses,
            settlementLimit,
            settlementCursor,
            includeDeletedSettlements,
            commentLimit,
            commentCursor,
        });

        res.json(result);
    };

    /**
     * Update a member's group-specific display name
     */
    updateGroupMemberDisplayName = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }
        const groupId = validateGroupId(req.params.id);

        // Validate request body
        const { displayName } = validateUpdateDisplayName(req.body);

        // Update the display name using FirestoreWriter directly
        await this.groupService.updateGroupMemberDisplayName(groupId, userId, displayName);

        res.json({ message: 'Display name updated successfully' });
    };
}
