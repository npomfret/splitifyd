import { Response } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { AuthenticatedRequest } from '../auth/middleware';
import { firestoreDb } from '../firebase';
import { validateUserAuth } from '../auth/utils';
import { Errors, ApiError } from '../utils/errors';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { FirestoreCollections, SecurityPresets, MemberRoles, PermissionChangeLog } from '@splitifyd/shared';
import { PermissionEngine, permissionCache } from '../permissions';
import { transformGroupDocument } from './handlers';
import { createServerTimestamp } from '../utils/dateHelpers';

const getGroupsCollection = () => {
    return firestoreDb.collection(FirestoreCollections.GROUPS);
};

/**
 * Apply a security preset to a group
 */
export const applySecurityPreset = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const groupId = req.params.id;
    const { preset } = req.body;

    if (!groupId) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
    }

    if (!preset || !Object.values(SecurityPresets).includes(preset)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PRESET', 'Valid security preset is required');
    }

    // Get group and check permissions
    const groupDoc = await getGroupsCollection().doc(groupId).get();
    if (!groupDoc.exists) {
        throw Errors.NOT_FOUND('Group');
    }

    const group = transformGroupDocument(groupDoc);

    // Security preset changes should always require admin role, regardless of current group permissions
    const member = group.members[userId];
    if (!member || member.role !== MemberRoles.ADMIN) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to change security presets');
    }

    const newPermissions = PermissionEngine.getDefaultPermissions(preset);
    const now = new Date().toISOString();

    const updateData: any = {
        'data.securityPreset': preset,
        'data.presetAppliedAt': now,
        'data.permissions': newPermissions,
        updatedAt: createServerTimestamp(),
    };

    // Add to permission history
    const changeLog: PermissionChangeLog = {
        timestamp: now,
        changedBy: userId,
        changeType: 'preset',
        changes: { preset, permissions: newPermissions },
    };

    updateData['data.permissionHistory'] = FieldValue.arrayUnion(changeLog);

    await groupDoc.ref.update(updateData);

    // Invalidate permission cache for this group
    permissionCache.invalidateGroup(groupId);

    logger.info('Security preset applied', { groupId, preset, userId });

    res.json({
        message: 'Security preset applied successfully',
        preset,
        permissions: newPermissions,
    });
};

/**
 * Update individual group permissions
 */
export const updateGroupPermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const groupId = req.params.id;
    const { permissions } = req.body;

    if (!groupId) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
    }

    if (!permissions || typeof permissions !== 'object') {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PERMISSIONS', 'Valid permissions object is required');
    }

    // Get group and check permissions
    const groupDoc = await getGroupsCollection().doc(groupId).get();
    if (!groupDoc.exists) {
        throw Errors.NOT_FOUND('Group');
    }

    const group = transformGroupDocument(groupDoc);

    // Check if user can manage settings
    if (!PermissionEngine.checkPermission(group, userId, 'settingsManagement')) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to manage group settings');
    }

    const now = new Date().toISOString();
    const updatedPermissions = { ...group.permissions, ...permissions };

    const updateData: any = {
        'data.securityPreset': SecurityPresets.CUSTOM,
        'data.permissions': updatedPermissions,
        updatedAt: createServerTimestamp(),
    };

    // Add to permission history
    const changeLog: PermissionChangeLog = {
        timestamp: now,
        changedBy: userId,
        changeType: 'custom',
        changes: { permissions },
    };

    updateData['data.permissionHistory'] = FieldValue.arrayUnion(changeLog);

    await groupDoc.ref.update(updateData);

    // Invalidate permission cache for this group
    permissionCache.invalidateGroup(groupId);

    logger.info('Group permissions updated', { groupId, permissions, userId });

    res.json({
        message: 'Permissions updated successfully',
        permissions: updatedPermissions,
    });
};

/**
 * Change a member's role
 */
export const setMemberRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const groupId = req.params.id;
    const targetUserId = req.params.memberId;
    const { role } = req.body;

    if (!groupId || !targetUserId) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_PARAMETERS', 'Group ID and member ID are required');
    }

    if (!role || !Object.values(MemberRoles).includes(role)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_ROLE', 'Valid member role is required');
    }

    // Get group and check permissions
    const groupDoc = await getGroupsCollection().doc(groupId).get();
    if (!groupDoc.exists) {
        throw Errors.NOT_FOUND('Group');
    }

    const group = transformGroupDocument(groupDoc);

    // Check if target member exists
    if (!group.members[targetUserId]) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'MEMBER_NOT_FOUND', 'Target member not found in group');
    }

    // Check if user can change roles
    const roleChangeResult = PermissionEngine.canChangeRole(group, userId, targetUserId, role);
    if (!roleChangeResult.allowed) {
        // Use different status code for different types of role change failures
        const isLastAdminError = roleChangeResult.reason?.includes('last admin');
        const statusCode = isLastAdminError ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.FORBIDDEN;
        throw new ApiError(statusCode, 'NOT_AUTHORIZED', roleChangeResult.reason || 'Cannot change member role');
    }

    const now = new Date().toISOString();
    const oldRole = group.members[targetUserId].role;

    const updateData: any = {
        [`data.members.${targetUserId}.role`]: role,
        [`data.members.${targetUserId}.lastPermissionChange`]: now,
        updatedAt: createServerTimestamp(),
    };

    // Add to permission history
    const changeLog: PermissionChangeLog = {
        timestamp: now,
        changedBy: userId,
        changeType: 'role',
        changes: { userId: targetUserId, oldRole, newRole: role },
    };

    updateData['data.permissionHistory'] = FieldValue.arrayUnion(changeLog);

    await groupDoc.ref.update(updateData);

    // Invalidate permission cache for this group and user
    permissionCache.invalidateGroup(groupId);
    permissionCache.invalidateUser(targetUserId);

    logger.info('Member role changed', { groupId, targetUserId, oldRole, newRole: role, changedBy: userId });

    res.json({
        message: 'Member role updated successfully',
        userId: targetUserId,
        oldRole,
        newRole: role,
    });
};

/**
 * Get user's permissions for a group (for UI display)
 */
export const getUserPermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const groupId = req.params.id;

    if (!groupId) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
    }

    // Get group
    const groupDoc = await getGroupsCollection().doc(groupId).get();
    if (!groupDoc.exists) {
        throw Errors.NOT_FOUND('Group');
    }

    const group = transformGroupDocument(groupDoc);

    // Check if user is a member
    if (!group.members[userId]) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_MEMBER', 'You are not a member of this group');
    }

    const permissions = PermissionEngine.getUserPermissions(group, userId);
    const userRole = group.members[userId].role;

    res.json({
        userId,
        role: userRole,
        permissions,
        groupSecurityPreset: group.securityPreset,
    });
};
