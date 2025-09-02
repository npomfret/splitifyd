import {FieldValue} from 'firebase-admin/firestore';
import {firestoreDb} from '../firebase';
import {ApiError, Errors} from '../utils/errors';
import {logger} from '../logger';
import {HTTP_STATUS} from '../constants';
import {FirestoreCollections, MemberRoles, PermissionChangeLog, SecurityPresets} from '@splitifyd/shared';
import {permissionCache, PermissionEngine} from '../permissions';
import {transformGroupDocument} from '../groups/handlers';
import {GroupDocumentSchema} from '../schemas';
import {createServerTimestamp} from '../utils/dateHelpers';
import {z} from 'zod';
import {PerformanceMonitor} from '../utils/performance-monitor';
import {runTransactionWithRetry} from '../utils/firestore-helpers';
import {getMemberFromArray, isAdminInArray} from '../utils/memberHelpers';
import {getGroupMemberService} from './serviceRegistration';

export class GroupPermissionService {
    private getGroupsCollection() {
        return firestoreDb.collection(FirestoreCollections.GROUPS);
    }

    /**
     * Validates a group document after an update operation
     */
    private async validateUpdatedGroupDocument(groupDoc: FirebaseFirestore.DocumentReference, operationContext: string): Promise<void> {
        const updatedDoc = await groupDoc.get();
        if (!updatedDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found after update');
        }

        const data = updatedDoc.data();
        if (!data) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_GROUP_DATA', 'Group document is empty after update');
        }

        try {
            const dataWithId = { ...data, id: updatedDoc.id };
            GroupDocumentSchema.parse(dataWithId);
        } catch (error) {
            logger.error('Group document validation failed after update operation', error as Error, {
                groupId: updatedDoc.id,
                operationContext,
                validationErrors: error instanceof z.ZodError ? error.issues : undefined,
            });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_GROUP_DATA', `Group data validation failed after ${operationContext}`);
        }
    }

    async applySecurityPreset(userId: string, groupId: string, preset: any): Promise<{
        message: string;
        preset: any;
        permissions: any;
    }> {
        return PerformanceMonitor.monitorServiceCall(
            'GroupPermissionService',
            'applySecurityPreset',
            async () => this._applySecurityPreset(userId, groupId, preset),
            { userId, groupId, preset }
        );
    }

    private async _applySecurityPreset(userId: string, groupId: string, preset: any): Promise<{
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

        const groupDocRef = this.getGroupsCollection().doc(groupId);
        
        // Initial read outside transaction for permission checks
        const groupDoc = await groupDocRef.get();
        if (!groupDoc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = transformGroupDocument(groupDoc);
        const originalUpdatedAt = groupDoc.data()?.updatedAt; // Store raw Firestore Timestamp for optimistic locking

        // Get members to check permissions
        const membersData = await getGroupMemberService().getGroupMembersResponse(group.members);
        const members = membersData.members;
        
        if (!isAdminInArray(members, userId)) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to change security presets');
        }

        const newPermissions = PermissionEngine.getDefaultPermissions(preset);
        const now = new Date().toISOString();

        // Use transaction with optimistic locking
        await runTransactionWithRetry(
            async (transaction) => {
                // Re-fetch within transaction
                const groupDocInTx = await transaction.get(groupDocRef);
                if (!groupDocInTx.exists) {
                    throw Errors.NOT_FOUND('Group');
                }

                const currentData = groupDocInTx.data();
                if (!currentData) {
                    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_GROUP', 'Group data is missing');
                }

                // Optimistic locking check
                const currentTimestamp = currentData.updatedAt;
                if (!currentTimestamp || !originalUpdatedAt || !currentTimestamp.isEqual(originalUpdatedAt)) {
                    throw new ApiError(HTTP_STATUS.CONFLICT, 'CONCURRENT_UPDATE', 
                        'Group was modified by another user. Please refresh and try again.');
                }

                // Perform the update
                const updateData: any = {
                    securityPreset: preset,
                    presetAppliedAt: now,
                    permissions: newPermissions,
                    updatedAt: createServerTimestamp(),
                };

                const changeLog: PermissionChangeLog = {
                    timestamp: now,
                    changedBy: userId,
                    changeType: 'preset',
                    changes: { preset, permissions: newPermissions },
                };

                updateData['permissionHistory'] = FieldValue.arrayUnion(changeLog);

                transaction.update(groupDocRef, updateData);
            },
            {
                maxAttempts: 3,
                context: {
                    operation: 'applySecurityPreset',
                    userId,
                    groupId,
                    preset
                }
            }
        );
        
        // Validate the group document after update
        await this.validateUpdatedGroupDocument(groupDocRef, 'security preset application');

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
        return PerformanceMonitor.monitorServiceCall(
            'GroupPermissionService',
            'updateGroupPermissions',
            async () => this._updateGroupPermissions(userId, groupId, permissions),
            { userId, groupId }
        );
    }

    private async _updateGroupPermissions(userId: string, groupId: string, permissions: any): Promise<{
        message: string;
        permissions: any;
    }> {
        if (!groupId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
        }

        if (!permissions || typeof permissions !== 'object') {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PERMISSIONS', 'Valid permissions object is required');
        }

        const groupDocRef = this.getGroupsCollection().doc(groupId);
        
        // Initial read outside transaction for permission checks
        const groupDoc = await groupDocRef.get();
        if (!groupDoc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = transformGroupDocument(groupDoc);
        const originalUpdatedAt = groupDoc.data()?.updatedAt; // Store raw Firestore Timestamp for optimistic locking

        if (!PermissionEngine.checkPermission(group, userId, 'settingsManagement')) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to manage group settings');
        }

        const now = new Date().toISOString();
        const updatedPermissions = { ...group.permissions, ...permissions };

        // Use transaction with optimistic locking
        await runTransactionWithRetry(
            async (transaction) => {
                // Re-fetch within transaction
                const groupDocInTx = await transaction.get(groupDocRef);
                if (!groupDocInTx.exists) {
                    throw Errors.NOT_FOUND('Group');
                }

                const currentData = groupDocInTx.data();
                if (!currentData) {
                    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_GROUP', 'Group data is missing');
                }

                // Optimistic locking check
                const currentTimestamp = currentData.updatedAt;
                if (!currentTimestamp || !originalUpdatedAt || !currentTimestamp.isEqual(originalUpdatedAt)) {
                    throw new ApiError(HTTP_STATUS.CONFLICT, 'CONCURRENT_UPDATE', 
                        'Group was modified by another user. Please refresh and try again.');
                }

                // Perform the update
                const updateData: any = {
                    securityPreset: SecurityPresets.CUSTOM,
                    permissions: updatedPermissions,
                    updatedAt: createServerTimestamp(),
                };

                const changeLog: PermissionChangeLog = {
                    timestamp: now,
                    changedBy: userId,
                    changeType: 'custom',
                    changes: { permissions },
                };

                updateData['permissionHistory'] = FieldValue.arrayUnion(changeLog);

                transaction.update(groupDocRef, updateData);
            },
            {
                maxAttempts: 3,
                context: {
                    operation: 'updateGroupPermissions',
                    userId,
                    groupId
                }
            }
        );
        
        // Validate the group document after update
        await this.validateUpdatedGroupDocument(groupDocRef, 'group permissions update');

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
        return PerformanceMonitor.monitorServiceCall(
            'GroupPermissionService',
            'setMemberRole',
            async () => this._setMemberRole(userId, groupId, targetUserId, role),
            { userId, groupId, targetUserId, role }
        );
    }

    private async _setMemberRole(userId: string, groupId: string, targetUserId: string, role: any): Promise<{
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

        const groupDocRef = this.getGroupsCollection().doc(groupId);
        
        // Initial read outside transaction for permission checks
        const groupDoc = await groupDocRef.get();
        if (!groupDoc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = transformGroupDocument(groupDoc);
        const originalUpdatedAt = groupDoc.data()?.updatedAt; // Store raw Firestore Timestamp for optimistic locking

        // Get members to check target user exists
        const members = group.members;
        const groupMembersResponse = await getGroupMemberService().getGroupMembersResponse(members);

        if (!getMemberFromArray(groupMembersResponse.members, targetUserId)) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'MEMBER_NOT_FOUND', 'Target member not found in group');
        }

        const roleChangeResult = PermissionEngine.canChangeRole(members, group.createdBy, userId, targetUserId, role);
        if (!roleChangeResult.allowed) {
            const isLastAdminError = roleChangeResult.reason?.includes('last admin');
            const statusCode = isLastAdminError ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.FORBIDDEN;
            throw new ApiError(statusCode, 'NOT_AUTHORIZED', roleChangeResult.reason || 'Cannot change member role');
        }

        const now = new Date().toISOString();
        const targetMember = getMemberFromArray(groupMembersResponse.members, targetUserId)!;
        const oldRole = targetMember.memberRole;

        // Use transaction with optimistic locking
        await runTransactionWithRetry(
            async (transaction) => {
                // Re-fetch within transaction
                const groupDocInTx = await transaction.get(groupDocRef);
                if (!groupDocInTx.exists) {
                    throw Errors.NOT_FOUND('Group');
                }

                const currentData = groupDocInTx.data();
                if (!currentData) {
                    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_GROUP', 'Group data is missing');
                }

                // Optimistic locking check
                const currentTimestamp = currentData.updatedAt;
                if (!currentTimestamp || !originalUpdatedAt || !currentTimestamp.isEqual(originalUpdatedAt)) {
                    throw new ApiError(HTTP_STATUS.CONFLICT, 'CONCURRENT_UPDATE', 
                        'Group was modified by another user. Please refresh and try again.');
                }

                // Perform the update
                const updateData: any = {
                    [`members.${targetUserId}.role`]: role,
                    [`members.${targetUserId}.lastPermissionChange`]: now,
                    updatedAt: createServerTimestamp(),
                };

                const changeLog: PermissionChangeLog = {
                    timestamp: now,
                    changedBy: userId,
                    changeType: 'role',
                    changes: { userId: targetUserId, oldRole, newRole: role },
                };

                updateData['permissionHistory'] = FieldValue.arrayUnion(changeLog);

                transaction.update(groupDocRef, updateData);
            },
            {
                maxAttempts: 3,
                context: {
                    operation: 'setMemberRole',
                    userId,
                    groupId,
                    targetUserId,
                    role
                }
            }
        );
        
        // Validate the group document after update
        await this.validateUpdatedGroupDocument(groupDocRef, 'member role change');

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

        // Get members to check user membership
        const membersData = await getGroupMemberService().getGroupMembersResponse(group.members);
        const members = membersData.members;
        
        if (!getMemberFromArray(members, userId)) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_MEMBER', 'You are not a member of this group');
        }

        const permissions = PermissionEngine.getUserPermissions(group, userId);
        const userMember = getMemberFromArray(members, userId)!;
        const userRole = userMember.memberRole;

        return {
            userId,
            role: userRole,
            permissions,
            groupSecurityPreset: group.securityPreset,
        };
    }
}