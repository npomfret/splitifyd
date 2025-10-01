import { measureDb } from '../monitoring/measure';
import { FieldValue } from 'firebase-admin/firestore';
import { ApiError, Errors } from '../utils/errors';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { FirestoreCollections, MemberRoles, PermissionChangeLog, SecurityPresets, PermissionLevels } from '@splitifyd/shared';
import { PermissionEngineAsync } from '../permissions/permission-engine-async';
import { createOptimisticTimestamp } from '../utils/dateHelpers';

import type { IFirestoreReader } from './firestore';
import type { IFirestoreWriter } from './firestore';
import type { Group, GroupPermissions } from '@splitifyd/shared';
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
}
