import { FieldValue } from 'firebase-admin/firestore';
import { firestoreDb } from '../firebase';
import { Errors, ApiError } from '../utils/errors';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { FirestoreCollections, SecurityPresets, MemberRoles, PermissionChangeLog } from '@splitifyd/shared';
import { PermissionEngine, permissionCache } from '../permissions';
import { transformGroupDocument } from '../groups/handlers';
import { createServerTimestamp } from '../utils/dateHelpers';

export class GroupPermissionService {
    private getGroupsCollection() {
        return firestoreDb.collection(FirestoreCollections.GROUPS);
    }

    async applySecurityPreset(userId: string, groupId: string, preset: any): Promise<{
        message: string;
        preset: any;
        permissions: any;
    }> {
        if (!groupId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
        }

        if (!preset || !Object.values(SecurityPresets).includes(preset)) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PRESET', 'Valid security preset is required');
        }

        const groupDoc = await this.getGroupsCollection().doc(groupId).get();
        if (!groupDoc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = transformGroupDocument(groupDoc);

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

        const changeLog: PermissionChangeLog = {
            timestamp: now,
            changedBy: userId,
            changeType: 'preset',
            changes: { preset, permissions: newPermissions },
        };

        updateData['data.permissionHistory'] = FieldValue.arrayUnion(changeLog);

        await groupDoc.ref.update(updateData);

        permissionCache.invalidateGroup(groupId);

        logger.info('Security preset applied', { groupId, preset, userId });

        return {
            message: 'Security preset applied successfully',
            preset,
            permissions: newPermissions,
        };
    }

    async updateGroupPermissions(userId: string, groupId: string, permissions: any): Promise<{
        message: string;
        permissions: any;
    }> {
        if (!groupId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
        }

        if (!permissions || typeof permissions !== 'object') {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PERMISSIONS', 'Valid permissions object is required');
        }

        const groupDoc = await this.getGroupsCollection().doc(groupId).get();
        if (!groupDoc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = transformGroupDocument(groupDoc);

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

        const changeLog: PermissionChangeLog = {
            timestamp: now,
            changedBy: userId,
            changeType: 'custom',
            changes: { permissions },
        };

        updateData['data.permissionHistory'] = FieldValue.arrayUnion(changeLog);

        await groupDoc.ref.update(updateData);

        permissionCache.invalidateGroup(groupId);

        logger.info('Group permissions updated', { groupId, permissions, userId });

        return {
            message: 'Permissions updated successfully',
            permissions: updatedPermissions,
        };
    }

    async setMemberRole(userId: string, groupId: string, targetUserId: string, role: any): Promise<{
        message: string;
        userId: string;
        oldRole: any;
        newRole: any;
    }> {
        if (!groupId || !targetUserId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_PARAMETERS', 'Group ID and member ID are required');
        }

        if (!role || !Object.values(MemberRoles).includes(role)) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_ROLE', 'Valid member role is required');
        }

        const groupDoc = await this.getGroupsCollection().doc(groupId).get();
        if (!groupDoc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = transformGroupDocument(groupDoc);

        if (!group.members[targetUserId]) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'MEMBER_NOT_FOUND', 'Target member not found in group');
        }

        const roleChangeResult = PermissionEngine.canChangeRole(group, userId, targetUserId, role);
        if (!roleChangeResult.allowed) {
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

        const changeLog: PermissionChangeLog = {
            timestamp: now,
            changedBy: userId,
            changeType: 'role',
            changes: { userId: targetUserId, oldRole, newRole: role },
        };

        updateData['data.permissionHistory'] = FieldValue.arrayUnion(changeLog);

        await groupDoc.ref.update(updateData);

        permissionCache.invalidateGroup(groupId);
        permissionCache.invalidateUser(targetUserId);

        logger.info('Member role changed', { groupId, targetUserId, oldRole, newRole: role, changedBy: userId });

        return {
            message: 'Member role updated successfully',
            userId: targetUserId,
            oldRole,
            newRole: role,
        };
    }

    async getUserPermissions(userId: string, groupId: string): Promise<{
        userId: string;
        role: any;
        permissions: any;
        groupSecurityPreset: any;
    }> {
        if (!groupId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
        }

        const groupDoc = await this.getGroupsCollection().doc(groupId).get();
        if (!groupDoc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = transformGroupDocument(groupDoc);

        if (!group.members[userId]) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_MEMBER', 'You are not a member of this group');
        }

        const permissions = PermissionEngine.getUserPermissions(group, userId);
        const userRole = group.members[userId].role;

        return {
            userId,
            role: userRole,
            permissions,
            groupSecurityPreset: group.securityPreset,
        };
    }
}