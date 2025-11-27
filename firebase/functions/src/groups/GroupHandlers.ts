import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { HTTP_STATUS } from '../constants';
import { GroupService } from '../services/GroupService';
import { Errors } from '../utils/errors';
import {
    validateCreateGroup,
    validateGroupFullDetailsQuery,
    validateGroupId,
    validateListGroupsQuery,
    validateUpdateDisplayName,
    validateUpdateGroup,
} from './validation';

export class GroupHandlers {
    constructor(private readonly groupService: GroupService) {}

    /**
     * Create a new group
     */
    createGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        // Validate and sanitize request body
        const groupData = validateCreateGroup(req.body);

        // Use GroupService to create the group
        const group = await this.groupService.createGroup(userId, groupData);

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
        const groupId = validateGroupId(req.params.groupId);

        // Validate and sanitize request body
        const updates = validateUpdateGroup(req.body);

        // Use GroupService to update the group
        await this.groupService.updateGroup(groupId, userId, updates);

        res.status(HTTP_STATUS.NO_CONTENT).send();
    };

    /**
     * Delete a group
     */
    deleteGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }
        const groupId = validateGroupId(req.params.groupId);

        // Use GroupService to delete the group
        await this.groupService.deleteGroup(groupId, userId);

        res.status(HTTP_STATUS.NO_CONTENT).send();
    };

    /**
     * List all groups for the authenticated user
     */
    listGroups = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        const { limit, cursor, order, statusFilter } = validateListGroupsQuery(req.query);

        const response = await this.groupService.listGroups(userId, {
            limit,
            cursor,
            orderBy: {
                field: 'updatedAt',
                direction: order,
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
        const groupId = validateGroupId(req.params.groupId);

        const queryParams = validateGroupFullDetailsQuery(req.query);

        const result = await this.groupService.getGroupFullDetails(groupId, userId, queryParams);

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
        const groupId = validateGroupId(req.params.groupId);

        // Validate request body
        const { displayName } = validateUpdateDisplayName(req.body);

        // Update the display name using FirestoreWriter directly
        await this.groupService.updateGroupMemberDisplayName(groupId, userId, displayName);

        res.status(HTTP_STATUS.NO_CONTENT).send();
    };
}
