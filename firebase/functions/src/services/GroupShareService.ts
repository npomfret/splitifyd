import { randomBytes } from 'crypto';
import { firestoreDb } from '../firebase';
import { ApiError } from '../utils/errors';
import { logger, LoggerContext } from '../logger';
import { HTTP_STATUS } from '../constants';
import { FirestoreCollections, ShareLink, MemberRoles, MemberStatuses } from '@splitifyd/shared';
import { getUpdatedAtTimestamp, checkAndUpdateWithTimestamp } from '../utils/optimistic-locking';
import { isGroupOwner as checkIsGroupOwner, isGroupMember, getThemeColorForMember } from '../utils/groupHelpers';
import { PerformanceMonitor } from '../utils/performance-monitor';

export class GroupShareService {
    private generateShareToken(): string {
        const bytes = randomBytes(12);
        const base64url = bytes.toString('base64url');
        return base64url.substring(0, 16);
    }

    private async findShareLinkByToken(token: string): Promise<{ groupId: string; shareLink: ShareLink }> {
        const groupsSnapshot = await firestoreDb.collectionGroup('shareLinks').where('token', '==', token).where('isActive', '==', true).limit(1).get();

        if (groupsSnapshot.empty) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_LINK', 'Invalid or expired share link');
        }

        const shareLinkDoc = groupsSnapshot.docs[0];
        const groupId = shareLinkDoc.ref.parent.parent!.id;
        const shareLink: ShareLink = {
            id: shareLinkDoc.id,
            ...(shareLinkDoc.data() as Omit<ShareLink, 'id'>),
        };

        return { groupId, shareLink };
    }


    async generateShareableLink(userId: string, groupId: string): Promise<{
        shareablePath: string;
        linkId: string;
    }> {
        return PerformanceMonitor.monitorServiceCall(
            'GroupShareService',
            'generateShareableLink',
            async () => this._generateShareableLink(userId, groupId),
            { userId, groupId }
        );
    }

    private async _generateShareableLink(userId: string, groupId: string): Promise<{
        shareablePath: string;
        linkId: string;
    }> {
        if (!groupId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
        }

        const groupRef = firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        const groupData = groupDoc.data()!;
        const group = { id: groupId, ...groupData.data };

        if (!checkIsGroupOwner(group, userId) && !isGroupMember(group, userId)) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'UNAUTHORIZED', 'Only group members can generate share links');
        }

        const shareToken = this.generateShareToken();

        await firestoreDb.runTransaction(async (transaction) => {
            const freshGroupDoc = await transaction.get(groupRef);
            if (!freshGroupDoc.exists) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }

            const shareLinksRef = firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId).collection('shareLinks');
            const shareLinkDoc = shareLinksRef.doc();

            const shareLinkData: Omit<ShareLink, 'id'> = {
                token: shareToken,
                createdBy: userId,
                createdAt: new Date().toISOString(),
                isActive: true,
            };

            transaction.set(shareLinkDoc, shareLinkData);
        });

        const shareablePath = `/join?linkId=${shareToken}`;

        LoggerContext.setBusinessContext({ groupId });
        logger.info('share-link-created', { id: shareToken, groupId, createdBy: userId });

        return {
            shareablePath,
            linkId: shareToken,
        };
    }

    async previewGroupByLink(userId: string, linkId: string): Promise<{
        groupId: string;
        groupName: string;
        groupDescription: string;
        memberCount: number;
        isAlreadyMember: boolean;
    }> {
        if (!linkId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_LINK_ID', 'Link ID is required');
        }

        const { groupId } = await this.findShareLinkByToken(linkId);

        const groupDoc = await firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId).get();
        if (!groupDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        const groupData = groupDoc.data()!;

        if (!groupData.data) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_GROUP', 'Group data is invalid');
        }

        const group = { id: groupId, ...groupData.data };
        const isAlreadyMember = isGroupMember(group, userId);

        return {
            groupId: groupDoc.id,
            groupName: groupData.data.name,
            groupDescription: groupData.data.description || '',
            memberCount: Object.keys(groupData.data.members).length,
            isAlreadyMember,
        };
    }

    async joinGroupByLink(userId: string, userEmail: string, linkId: string): Promise<{
        groupId: string;
        groupName: string;
        message: string;
        success: boolean;
    }> {
        return PerformanceMonitor.monitorServiceCall(
            'GroupShareService',
            'joinGroupByLink',
            async () => this._joinGroupByLink(userId, userEmail, linkId),
            { userId, linkId }
        );
    }

    private async _joinGroupByLink(userId: string, userEmail: string, linkId: string): Promise<{
        groupId: string;
        groupName: string;
        message: string;
        success: boolean;
    }> {
        if (!linkId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_LINK_ID', 'Link ID is required');
        }

        const userName = userEmail.split('@')[0];
        const { groupId, shareLink } = await this.findShareLinkByToken(linkId);

        const result = await firestoreDb.runTransaction(async (transaction) => {
            const groupRef = firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId);
            const groupSnapshot = await transaction.get(groupRef);

            if (!groupSnapshot.exists) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }

            const groupData = groupSnapshot.data()!;
            const originalUpdatedAt = getUpdatedAtTimestamp(groupData);

            if (userId in groupData.data.members) {
                throw new ApiError(HTTP_STATUS.CONFLICT, 'ALREADY_MEMBER', 'You are already a member of this group');
            }

            const group = { id: groupId, ...groupData.data };
            if (checkIsGroupOwner(group, userId)) {
                throw new ApiError(HTTP_STATUS.CONFLICT, 'ALREADY_MEMBER', 'You are already the owner of this group');
            }

            const memberIndex = Object.keys(groupData.data.members).length;

            const newMember = {
                role: MemberRoles.MEMBER,
                status: MemberStatuses.ACTIVE,
                theme: getThemeColorForMember(memberIndex),
                joinedAt: new Date().toISOString(),
                invitedBy: shareLink.createdBy,
            };

            const updatedMembers = {
                ...groupData.data.members,
                [userId]: newMember,
            };

            await checkAndUpdateWithTimestamp(
                transaction,
                groupRef,
                {
                    'data.members': updatedMembers,
                },
                originalUpdatedAt,
            );

            return {
                groupName: groupData.data!.name!,
                invitedBy: shareLink.createdBy,
            };
        });

        logger.info('User joined group via share link', {
            groupId,
            userId,
            userName,
            linkId: linkId.substring(0, 4) + '...',
            invitedBy: result.invitedBy,
        });

        return {
            groupId,
            groupName: result.groupName,
            message: 'Successfully joined group',
            success: true,
        };
    }
}