import { Response } from 'express';
import { randomBytes } from 'crypto';
import { firestoreDb } from '../firebase';
import { ApiError } from '../utils/errors';
import { logger, LoggerContext } from '../logger';
import { HTTP_STATUS } from '../constants';
import { AuthenticatedRequest } from '../auth/middleware';
import { FirestoreCollections, ShareLink, MemberRoles, MemberStatuses } from '@splitifyd/shared';
import { getUpdatedAtTimestamp, checkAndUpdateWithTimestamp } from '../utils/optimistic-locking';
import { isGroupOwner as checkIsGroupOwner, isGroupMember, getThemeColorForMember } from '../utils/groupHelpers';

const generateShareToken = (): string => {
    const bytes = randomBytes(12);
    const base64url = bytes.toString('base64url');
    return base64url.substring(0, 16);
};

/**
 * Find ShareLink by token in the shareLinks subcollection
 */
const findShareLinkByToken = async (token: string): Promise<{ groupId: string; shareLink: ShareLink }> => {
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
};

interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

const validateRequest = (body: any, rules: Record<string, { type: string; required: boolean }>): ValidationResult => {
    const errors: string[] = [];

    for (const [field, rule] of Object.entries(rules)) {
        if (rule.required && (!body[field] || body[field] === '')) {
            errors.push(`${field} is required`);
        } else if (body[field] !== undefined && typeof body[field] !== rule.type) {
            errors.push(`${field} must be of type ${rule.type}`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

export async function generateShareableLink(req: AuthenticatedRequest, res: Response): Promise<void> {
    const validationRules = {
        groupId: { type: 'string', required: true },
    };

    const validation = validateRequest(req.body, validationRules);
    if (!validation.isValid) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', `Invalid request: ${validation.errors.join(', ')}`);
    }

    const { groupId } = req.body;
    const userId = req.user!.uid;

    try {
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

        const shareToken = generateShareToken();

        // Create ShareLink document in subcollection
        await firestoreDb.runTransaction(async (transaction) => {
            const freshGroupDoc = await transaction.get(groupRef);
            if (!freshGroupDoc.exists) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }

            // Create ShareLink document in subcollection
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

        // Server only returns the path, webapp will construct the full URL
        const shareablePath = `/join?linkId=${shareToken}`;

        LoggerContext.setBusinessContext({ groupId });
        logger.info('share-link-created', { id: shareToken, groupId, createdBy: userId });

        res.status(HTTP_STATUS.OK).json({
            shareablePath,
            linkId: shareToken,
        });
    } catch (error) {
        if (error instanceof ApiError) throw error;

        logger.error('Error generating shareable link', error, {
            groupId,
            userId,
        });

        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INTERNAL_ERROR', 'Failed to generate shareable link');
    }
}

export async function previewGroupByLink(req: AuthenticatedRequest, res: Response): Promise<void> {
    const validationRules = {
        linkId: { type: 'string', required: true },
    };

    const validation = validateRequest(req.body, validationRules);
    if (!validation.isValid) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', `Invalid request: ${validation.errors.join(', ')}`);
    }

    const { linkId } = req.body;
    const userId = req.user!.uid;

    try {
        const { groupId } = await findShareLinkByToken(linkId);

        const groupDoc = await firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId).get();
        if (!groupDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        const groupData = groupDoc.data()!;

        if (!groupData.data) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_GROUP', 'Group data is invalid');
        }

        // Check if user is already a member
        const group = { id: groupId, ...groupData.data };
        const isAlreadyMember = isGroupMember(group, userId);

        // Return group preview data
        res.status(HTTP_STATUS.OK).json({
            groupId: groupDoc.id,
            groupName: groupData.data.name,
            groupDescription: groupData.data.description || '',
            memberCount: Object.keys(groupData.data.members).length,
            isAlreadyMember,
        });
    } catch (error) {
        if (error instanceof ApiError) throw error;

        logger.error('Error previewing group by link', error, {
            linkId: linkId.substring(0, 4) + '...',
            userId,
        });

        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INTERNAL_ERROR', 'Failed to preview group');
    }
}

export async function joinGroupByLink(req: AuthenticatedRequest, res: Response): Promise<void> {
    const validationRules = {
        linkId: { type: 'string', required: true },
    };

    const validation = validateRequest(req.body, validationRules);
    if (!validation.isValid) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', `Invalid request: ${validation.errors.join(', ')}`);
    }

    const { linkId } = req.body;
    const userId = req.user!.uid;
    const userEmail = req.user!.email;
    const userName = userEmail.split('@')[0];

    try {
        const { groupId, shareLink } = await findShareLinkByToken(linkId);

        const result = await firestoreDb.runTransaction(async (transaction) => {
            const groupRef = firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId);
            const groupSnapshot = await transaction.get(groupRef);

            if (!groupSnapshot.exists) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }

            const groupData = groupSnapshot.data()!;
            const originalUpdatedAt = getUpdatedAtTimestamp(groupData);

            // Check if user is already a member using the members map
            if (userId in groupData.data.members) {
                throw new ApiError(HTTP_STATUS.CONFLICT, 'ALREADY_MEMBER', 'You are already a member of this group');
            }

            // Check if user is the group owner
            const group = { id: groupId, ...groupData.data };
            if (checkIsGroupOwner(group, userId)) {
                throw new ApiError(HTTP_STATUS.CONFLICT, 'ALREADY_MEMBER', 'You are already the owner of this group');
            }

            // Calculate next theme index based on current member count
            const memberIndex = Object.keys(groupData.data.members).length;

            // Create new member with theme assignment and invite attribution
            const newMember = {
                role: MemberRoles.MEMBER,
                status: MemberStatuses.ACTIVE,
                theme: getThemeColorForMember(memberIndex),
                joinedAt: new Date().toISOString(),
                invitedBy: shareLink.createdBy,
            };

            // Add new member to members map
            const updatedMembers = {
                ...groupData.data.members,
                [userId]: newMember,
            };

            // 🎯 FIXED: Use the proper transaction function with correct read/write order
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

        res.status(HTTP_STATUS.OK).json({
            groupId,
            groupName: result.groupName,
            message: 'Successfully joined group',
            success: true,
        });
    } catch (error) {
        if (error instanceof ApiError) throw error;

        logger.error('Error joining group by link', error, {
            linkId: linkId.substring(0, 4) + '...',
            userId,
        });

        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INTERNAL_ERROR', 'Failed to join group');
    }
}
