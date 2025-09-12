import { measureDb } from '../monitoring/measure';
import { FieldValue } from 'firebase-admin/firestore';
import { ApiError, Errors } from '../utils/errors';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { FirestoreCollections, MemberRoles, PermissionChangeLog, SecurityPresets, PermissionLevels } from '@splitifyd/shared';
import { PermissionEngineAsync } from '../permissions/permission-engine-async';
import { createOptimisticTimestamp } from '../utils/dateHelpers';

import { getMemberDocFromArray, isAdminInDocArray } from '../utils/memberHelpers';
import type { IFirestoreReader } from './firestore';
import type { IFirestoreWriter } from './firestore';
import type { Group, GroupPermissions, SecurityPreset } from '@splitifyd/shared';
import type { GroupMemberDocument } from '@splitifyd/shared';
import { MemberStatuses } from '@splitifyd/shared';
import type { GroupDocument } from '../schemas';

/**
 * Transform GroupDocument (database schema) to Group (API type) with required defaults
 */
function toGroup(groupDoc: GroupDocument): Group {
    return {
        ...groupDoc,
        securityPreset: groupDoc.securityPreset!,
        permissions: groupDoc.permissions as GroupPermissions,
    };
}

export class GroupPermissionService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
    ) {}

    /**
     * Validates a group document after an update operation
     */
    private async validateUpdatedGroupDocument(groupDoc: FirebaseFirestore.DocumentReference, operationContext: string): Promise<void> {
        const group = await this.firestoreReader.getGroup(groupDoc.id);
        if (!group) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found after update');
        }

        // Group validation is handled by FirestoreReader using GroupDocumentSchema
        // No additional validation needed here since FirestoreReader already validates
        logger.info('Group document validated successfully after operation', {
            groupId: groupDoc.id,
            operationContext,
        });
    }

    async applySecurityPreset(
        userId: string,
        groupId: string,
        preset: any,
    ): Promise<{
        message: string;
        preset: any;
        permissions: any;
    }> {
        return measureDb('GroupPermissionService.applySecurityPreset', async () => this._applySecurityPreset(userId, groupId, preset));
    }

    private async _applySecurityPreset(
        userId: string,
        groupId: string,
        preset: any,
    ): Promise<{
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

        // Initial read outside transaction for permission checks
        const group = await this.firestoreReader.getGroup(groupId);
        if (!group) {
            throw Errors.NOT_FOUND('Group');
        }

        // Get raw document for optimistic locking
        const groupDoc = await this.firestoreReader.getRawGroupDocument(groupId);
        if (!groupDoc) {
            throw Errors.NOT_FOUND('Group');
        }
        const originalUpdatedAt = groupDoc.data()?.updatedAt; // Store raw Firestore Timestamp for optimistic locking

        // Get members to check permissions
        const memberDocs = await this.firestoreReader.getAllGroupMembers(groupId);

        if (!isAdminInDocArray(memberDocs, userId)) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to change security presets');
        }

        const newPermissions = this.getDefaultPermissions(preset);
        const now = new Date().toISOString();
        const firestoreNow = createOptimisticTimestamp();

        // Use transaction with optimistic locking
        await this.firestoreWriter.runTransaction(
            async (transaction) => {
                // Re-fetch within transaction
                const groupDocInTx = await this.firestoreReader.getRawGroupDocumentInTransaction(transaction, groupId);
                if (!groupDocInTx) {
                    throw Errors.NOT_FOUND('Group');
                }

                const currentData = groupDocInTx.data();
                if (!currentData) {
                    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_GROUP', 'Group data is missing');
                }

                // Optimistic locking check
                const currentTimestamp = currentData.updatedAt;
                if (!currentTimestamp || !originalUpdatedAt || !currentTimestamp.isEqual(originalUpdatedAt)) {
                    throw new ApiError(HTTP_STATUS.CONFLICT, 'CONCURRENT_UPDATE', 'Group was modified by another user. Please refresh and try again.');
                }

                // Perform the update
                const updateData: any = {
                    securityPreset: preset,
                    presetAppliedAt: firestoreNow,
                    permissions: newPermissions,
                    updatedAt: createOptimisticTimestamp(),
                };

                const changeLog: PermissionChangeLog = {
                    timestamp: now,
                    changedBy: userId,
                    changeType: 'preset',
                    changes: { preset, permissions: newPermissions },
                };

                updateData['permissionHistory'] = FieldValue.arrayUnion(changeLog);

                this.firestoreWriter.updateInTransaction(transaction, `${FirestoreCollections.GROUPS}/${groupId}`, updateData);
            },
            {
                maxAttempts: 3,
                context: {
                    operation: 'applySecurityPreset',
                    userId,
                    groupId,
                    preset,
                },
            },
        );

        // Validate the group document after update
        await this.validateUpdatedGroupDocument({ id: groupId } as any, 'security preset application');

        // Cache invalidation removed - fetching fresh data on every request

        logger.info('Security preset applied', { groupId, preset, userId });

        return {
            message: 'Security preset applied successfully',
            preset,
            permissions: newPermissions,
        };
    }

    async updateGroupPermissions(
        userId: string,
        groupId: string,
        permissions: any,
    ): Promise<{
        message: string;
        permissions: any;
    }> {
        return measureDb('GroupPermissionService.updateGroupPermissions', async () => this._updateGroupPermissions(userId, groupId, permissions));
    }

    private async _updateGroupPermissions(
        userId: string,
        groupId: string,
        permissions: any,
    ): Promise<{
        message: string;
        permissions: any;
    }> {
        if (!groupId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
        }

        if (!permissions || typeof permissions !== 'object') {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PERMISSIONS', 'Valid permissions object is required');
        }

        // Initial read outside transaction for permission checks
        const group = await this.firestoreReader.getGroup(groupId);
        if (!group) {
            throw Errors.NOT_FOUND('Group');
        }

        // Get raw document for optimistic locking
        const groupDoc = await this.firestoreReader.getRawGroupDocument(groupId);
        if (!groupDoc) {
            throw Errors.NOT_FOUND('Group');
        }
        const originalUpdatedAt = groupDoc.data()?.updatedAt; // Store raw Firestore Timestamp for optimistic locking

        if (!(await PermissionEngineAsync.checkPermission(this.firestoreReader, toGroup(group), userId, 'settingsManagement'))) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to manage group settings');
        }

        const now = new Date().toISOString();
        const updatedPermissions = { ...group.permissions, ...permissions };

        // Use transaction with optimistic locking
        await this.firestoreWriter.runTransaction(
            async (transaction) => {
                // Re-fetch within transaction
                const groupDocInTx = await this.firestoreReader.getRawGroupDocumentInTransaction(transaction, groupId);
                if (!groupDocInTx) {
                    throw Errors.NOT_FOUND('Group');
                }

                const currentData = groupDocInTx.data();
                if (!currentData) {
                    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_GROUP', 'Group data is missing');
                }

                // Optimistic locking check
                const currentTimestamp = currentData.updatedAt;
                if (!currentTimestamp || !originalUpdatedAt || !currentTimestamp.isEqual(originalUpdatedAt)) {
                    throw new ApiError(HTTP_STATUS.CONFLICT, 'CONCURRENT_UPDATE', 'Group was modified by another user. Please refresh and try again.');
                }

                // Perform the update
                const updateData: any = {
                    securityPreset: SecurityPresets.CUSTOM,
                    permissions: updatedPermissions,
                    updatedAt: createOptimisticTimestamp(),
                };

                const changeLog: PermissionChangeLog = {
                    timestamp: now,
                    changedBy: userId,
                    changeType: 'custom',
                    changes: { permissions },
                };

                updateData['permissionHistory'] = FieldValue.arrayUnion(changeLog);

                this.firestoreWriter.updateInTransaction(transaction, `${FirestoreCollections.GROUPS}/${groupId}`, updateData);
            },
            {
                maxAttempts: 3,
                context: {
                    operation: 'updateGroupPermissions',
                    userId,
                    groupId,
                },
            },
        );

        // Validate the group document after update
        await this.validateUpdatedGroupDocument({ id: groupId } as any, 'group permissions update');

        // Cache invalidation removed - fetching fresh data on every request

        logger.info('Group permissions updated', { groupId, permissions, userId });

        return {
            message: 'Permissions updated successfully',
            permissions: updatedPermissions,
        };
    }

    async setMemberRole(
        userId: string,
        groupId: string,
        targetUserId: string,
        role: any,
    ): Promise<{
        message: string;
        userId: string;
        oldRole: any;
        newRole: any;
    }> {
        return measureDb('GroupPermissionService.setMemberRole', async () => this._setMemberRole(userId, groupId, targetUserId, role));
    }

    private async _setMemberRole(
        userId: string,
        groupId: string,
        targetUserId: string,
        role: any,
    ): Promise<{
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

        // Initial read outside transaction for permission checks
        const group = await this.firestoreReader.getGroup(groupId);
        if (!group) {
            throw Errors.NOT_FOUND('Group');
        }

        // Get raw document for optimistic locking
        const groupDoc = await this.firestoreReader.getRawGroupDocument(groupId);
        if (!groupDoc) {
            throw Errors.NOT_FOUND('Group');
        }
        const originalUpdatedAt = groupDoc.data()?.updatedAt; // Store raw Firestore Timestamp for optimistic locking

        // Get members to check target user exists
        const memberDocs = await this.firestoreReader.getAllGroupMembers(groupId);

        if (!getMemberDocFromArray(memberDocs, targetUserId)) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'MEMBER_NOT_FOUND', 'Target member not found in group');
        }

        const roleChangeResult = await PermissionEngineAsync.canChangeRole(this.firestoreReader, groupId, group.createdBy, userId, targetUserId, role);
        if (!roleChangeResult.allowed) {
            const isLastAdminError = roleChangeResult.reason?.includes('last admin');
            const statusCode = isLastAdminError ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.FORBIDDEN;
            throw new ApiError(statusCode, 'NOT_AUTHORIZED', roleChangeResult.reason || 'Cannot change member role');
        }

        const now = new Date().toISOString();
        const targetMember = getMemberDocFromArray(memberDocs, targetUserId)!;
        const oldRole = targetMember.memberRole;

        // Use transaction with optimistic locking
        await this.firestoreWriter.runTransaction(
            async (transaction) => {
                // Re-fetch within transaction
                const groupDocInTx = await this.firestoreReader.getRawGroupDocumentInTransaction(transaction, groupId);
                if (!groupDocInTx) {
                    throw Errors.NOT_FOUND('Group');
                }

                const currentData = groupDocInTx.data();
                if (!currentData) {
                    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_GROUP', 'Group data is missing');
                }

                // Optimistic locking check
                const currentTimestamp = currentData.updatedAt;
                if (!currentTimestamp || !originalUpdatedAt || !currentTimestamp.isEqual(originalUpdatedAt)) {
                    throw new ApiError(HTTP_STATUS.CONFLICT, 'CONCURRENT_UPDATE', 'Group was modified by another user. Please refresh and try again.');
                }

                // Perform the update
                const updateData: any = {
                    updatedAt: createOptimisticTimestamp(),
                };

                const changeLog: PermissionChangeLog = {
                    timestamp: now,
                    changedBy: userId,
                    changeType: 'role',
                    changes: { userId: targetUserId, oldRole, newRole: role },
                };

                updateData['permissionHistory'] = FieldValue.arrayUnion(changeLog);

                this.firestoreWriter.updateInTransaction(transaction, `${FirestoreCollections.GROUPS}/${groupId}`, updateData);

                // Also update the member in the top-level collection in the same transaction
                const { getTopLevelMembershipDocId } = await import('../utils/groupMembershipHelpers');
                const topLevelDocId = getTopLevelMembershipDocId(targetUserId, groupId);
                this.firestoreWriter.updateInTransaction(transaction, `${FirestoreCollections.GROUP_MEMBERSHIPS}/${topLevelDocId}`, {
                    memberRole: role,
                    lastPermissionChange: now,
                    updatedAt: createOptimisticTimestamp(),
                });
            },
            {
                maxAttempts: 3,
                context: {
                    operation: 'setMemberRole',
                    userId,
                    groupId,
                    targetUserId,
                    role,
                },
            },
        );

        // Validate the group document after update
        await this.validateUpdatedGroupDocument({ id: groupId } as any, 'member role change');

        // Cache invalidation removed - fetching fresh data on every request
        // Cache invalidation removed - fetching fresh data on every request

        logger.info('Member role changed', { groupId, targetUserId, oldRole, newRole: role, changedBy: userId });

        return {
            message: 'Member role updated successfully',
            userId: targetUserId,
            oldRole,
            newRole: role,
        };
    }

    async getUserPermissions(
        userId: string,
        groupId: string,
    ): Promise<{
        userId: string;
        role: any;
        permissions: any;
        groupSecurityPreset: any;
    }> {
        if (!groupId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
        }

        const group = await this.firestoreReader.getGroup(groupId);
        if (!group) {
            throw Errors.NOT_FOUND('Group');
        }

        // Get members to check user membership
        const memberDocs = await this.firestoreReader.getAllGroupMembers(groupId);

        if (!getMemberDocFromArray(memberDocs, userId)) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_MEMBER', 'You are not a member of this group');
        }

        const userMember = getMemberDocFromArray(memberDocs, userId)!;
        const userRole = userMember.memberRole;

        // Calculate permissions directly without calling PermissionEngineAsync to avoid service dependencies
        const permissions = this.calculateUserPermissions(toGroup(group), userMember);

        return {
            userId,
            role: userRole,
            permissions,
            groupSecurityPreset: group.securityPreset,
        };
    }

    /**
     * Get default permissions for a security preset
     */
    private getDefaultPermissions(preset: SecurityPreset): GroupPermissions {
        switch (preset) {
            case SecurityPresets.OPEN:
                return {
                    expenseEditing: PermissionLevels.ANYONE,
                    expenseDeletion: PermissionLevels.ANYONE,
                    memberInvitation: PermissionLevels.ANYONE,
                    memberApproval: 'automatic',
                    settingsManagement: PermissionLevels.ANYONE,
                };

            case SecurityPresets.MANAGED:
                return {
                    expenseEditing: PermissionLevels.OWNER_AND_ADMIN,
                    expenseDeletion: PermissionLevels.OWNER_AND_ADMIN,
                    memberInvitation: PermissionLevels.ADMIN_ONLY,
                    memberApproval: 'admin-required',
                    settingsManagement: PermissionLevels.ADMIN_ONLY,
                };

            case SecurityPresets.CUSTOM:
            default:
                // Return open permissions as default fallback
                return this.getDefaultPermissions(SecurityPresets.OPEN);
        }
    }

    /**
     * Calculate user permissions directly without service dependencies
     * Replicates PermissionEngineAsync logic but uses provided member data
     */
    private calculateUserPermissions(group: Group, member: GroupMemberDocument): Record<string, boolean> {
        if (!group.permissions) {
            throw new Error(`Group ${group.id} is missing permissions configuration`);
        }

        // If member is not active, only allow viewing
        if (member.memberStatus !== MemberStatuses.ACTIVE) {
            return {
                canEditAnyExpense: false,
                canDeleteAnyExpense: false,
                canInviteMembers: false,
                canManageSettings: false,
                canApproveMembers: false,
                canViewGroup: false,
            };
        }

        // Viewers have restricted permissions
        if (member.memberRole === MemberRoles.VIEWER) {
            return {
                canEditAnyExpense: false,
                canDeleteAnyExpense: false,
                canInviteMembers: false,
                canManageSettings: false,
                canApproveMembers: false,
                canViewGroup: true,
            };
        }

        // For members and admins, check each permission level
        const permissions = group.permissions;

        return {
            canEditAnyExpense: this.checkPermissionLevel(permissions.expenseEditing, member.memberRole, group.createdBy, member.userId),
            canDeleteAnyExpense: this.checkPermissionLevel(permissions.expenseDeletion, member.memberRole, group.createdBy, member.userId),
            canInviteMembers: this.checkPermissionLevel(permissions.memberInvitation, member.memberRole, group.createdBy, member.userId),
            canManageSettings: this.checkPermissionLevel(permissions.settingsManagement, member.memberRole, group.createdBy, member.userId),
            canApproveMembers: this.checkPermissionLevel(permissions.memberApproval, member.memberRole, group.createdBy, member.userId),
            canViewGroup: true, // All active members can view
        };
    }

    /**
     * Check if a member role meets the required permission level
     */
    private checkPermissionLevel(requiredLevel: string, memberRole: string, groupCreatedBy: string, userId: string): boolean {
        const isOwner = groupCreatedBy === userId;
        const isAdmin = memberRole === MemberRoles.ADMIN;

        switch (requiredLevel) {
            case PermissionLevels.ANYONE:
                return true;
            case PermissionLevels.OWNER_AND_ADMIN:
                return isOwner || isAdmin;
            case PermissionLevels.ADMIN_ONLY:
                return isAdmin;
            case 'automatic':
                return true; // For member approval - automatic approval
            case 'admin-required':
                return isAdmin || isOwner; // For member approval - admin required
            default:
                return false;
        }
    }
}
