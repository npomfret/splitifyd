import { Response } from 'express';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { firestoreDb } from '../firebase';
import { AuthenticatedRequest } from '../auth/middleware';
import { Errors } from '../utils/errors';
import { userService } from '../services/UserService2';
import { validateGroupId } from './validation';
import { logger, LoggerContext } from '../logger';
import { FirestoreCollections, Group, GroupMembersResponse, User } from '@splitifyd/shared';
import { calculateGroupBalances } from '../services/balanceCalculator';

/**
 * Transform a Firestore document to a Group
 */
const transformGroupDocument = (doc: admin.firestore.DocumentSnapshot): Group => {
    const data = doc.data();
    if (!data) {
        throw new Error('Invalid group document');
    }

    // Expect consistent document structure
    if (!data.data) {
        throw new Error('Invalid group document structure: missing data field');
    }
    const groupData = data.data;

    return {
        id: doc.id,
        name: groupData.name!,
        description: groupData.description ?? '',
        createdBy: groupData.createdBy!,
        members: groupData.members,
        createdAt: data.createdAt!.toDate().toISOString(),
        updatedAt: data.updatedAt!.toDate().toISOString(),
    } as Group;
};

/**
 * Get initials from a name or email
 */
const getInitials = (nameOrEmail: string): string => {
    const name = nameOrEmail || '';
    const parts = name.split(/[\s@]+/).filter(Boolean);

    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/**
 * Internal function to get group members data
 * Used by both the HTTP handler and consolidated endpoints
 */
export const _getGroupMembersData = async (groupId: string, membersMap: Record<string, any>): Promise<GroupMembersResponse> => {
    const memberIds = Object.keys(membersMap);

    // Fetch member profiles
    const memberProfiles = await userService.getUsers(memberIds);

    // Convert to User format
    const members: User[] = memberIds.map((memberId: string) => {
        const profile = memberProfiles.get(memberId);
        const memberInfo = membersMap[memberId];

        if (!profile) {
            // Return minimal user object for missing profiles
            return {
                uid: memberId,
                name: 'Unknown User',
                initials: '?',
                email: '',
                displayName: 'Unknown User',
                themeColor: memberInfo.theme, // Include theme even for missing profiles
            };
        }

        return {
            uid: memberId,
            name: profile.displayName,
            initials: getInitials(profile.displayName),
            email: profile.email,
            displayName: profile.displayName,
            themeColor: memberInfo.theme, // Include theme color from group members map
        };
    });

    // Sort members alphabetically by display name
    members.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return {
        members,
        hasMore: false,
    };
};

/**
 * Get members of a group
 * Returns member profiles for all users in the group
 */
export const getGroupMembers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
        throw Errors.UNAUTHORIZED();
    }

    const groupId = validateGroupId(req.params.id);

    try {
        // Verify user has access to the group
        const docRef = firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = transformGroupDocument(doc);

        // Check if user is a member
        if (!(userId in group.members)) {
            throw Errors.FORBIDDEN();
        }

        // Use extracted function to get members data with theme information
        const response = await _getGroupMembersData(groupId, group.members);

        res.json(response);
    } catch (error) {
        logger.error('Error in getGroupMembers', error, {
            groupId,
            userId,
        });
        throw error;
    }
};

/**
 * Leave a group
 * Removes the current user from the group
 */
export const leaveGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
        throw Errors.UNAUTHORIZED();
    }

    const groupId = validateGroupId(req.params.id);

    try {
        const docRef = firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = transformGroupDocument(doc);

        // Check if user is a member
        if (!(userId in group.members)) {
            throw Errors.INVALID_INPUT({ message: 'You are not a member of this group' });
        }

        // Prevent creator from leaving
        if (group.createdBy === userId) {
            throw Errors.INVALID_INPUT({ message: 'Group creator cannot leave the group' });
        }

        // Can't leave if you're the only member
        const memberIds = Object.keys(group.members);
        if (memberIds.length === 1) {
            throw Errors.INVALID_INPUT({ message: 'Cannot leave group - you are the only member' });
        }

        // Check if user has outstanding balance
        try {
            const groupBalance = await calculateGroupBalances(groupId);
            const balancesByCurrency = groupBalance.balancesByCurrency;

            // Find user's balance across all currencies
            for (const currency in balancesByCurrency) {
                const currencyBalances = balancesByCurrency[currency];
                const userBalance = currencyBalances[userId];

                if (userBalance && Math.abs(userBalance.netBalance) > 0.01) {
                    throw Errors.INVALID_INPUT({ message: 'Cannot leave group with outstanding balance' });
                }
            }
        } catch (balanceError: unknown) {
            // If it's our custom error about outstanding balance, re-throw it
            // Check both the error message and the details message for ApiError
            const errorMessage = balanceError instanceof Error ? balanceError.message : String(balanceError);
            const apiErrorDetails = (balanceError as any)?.details?.message || '';

            if (errorMessage.includes('Cannot leave group with outstanding balance') || apiErrorDetails.includes('Cannot leave group with outstanding balance')) {
                throw balanceError;
            }

            // Allow leaving if balance calculation fails (non-critical)
        }

        // Remove user from members map
        const updatedMembers = { ...group.members };
        delete updatedMembers[userId];

        // Update group
        await docRef.update({
            'data.members': updatedMembers,
            updatedAt: FieldValue.serverTimestamp(),
        });

        LoggerContext.setBusinessContext({ groupId });
        logger.info('member-left', { id: userId, groupId });

        res.json({
            success: true,
            message: 'Successfully left the group',
        });
    } catch (error) {
        logger.error('Error in leaveGroup', error, {
            groupId,
            userId,
        });
        throw error;
    }
};

/**
 * Remove a member from a group
 * Only group creators can remove other members
 */
export const removeGroupMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
        throw Errors.UNAUTHORIZED();
    }

    const groupId = validateGroupId(req.params.id);
    const memberId = req.params.memberId;

    if (!memberId) {
        throw Errors.MISSING_FIELD('memberId');
    }

    try {
        const docRef = firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = transformGroupDocument(doc);

        // Check if user is the group creator
        if (group.createdBy !== userId) {
            throw Errors.FORBIDDEN();
        }

        // Check if member exists in group
        if (!(memberId in group.members)) {
            throw Errors.INVALID_INPUT({ message: 'User is not a member of this group' });
        }

        // Can't remove the creator
        if (memberId === group.createdBy) {
            throw Errors.INVALID_INPUT({ message: 'Group creator cannot be removed' });
        }

        // Check if member has outstanding balance
        try {
            const groupBalance = await calculateGroupBalances(groupId);
            const balancesByCurrency = groupBalance.balancesByCurrency;

            // Find member's balance across all currencies
            for (const currency in balancesByCurrency) {
                const currencyBalances = balancesByCurrency[currency];
                const memberBalance = currencyBalances[memberId];

                if (memberBalance && Math.abs(memberBalance.netBalance) > 0.01) {
                    throw Errors.INVALID_INPUT({ message: 'Cannot remove member with outstanding balance' });
                }
            }
        } catch (balanceError: unknown) {
            // If it's our custom error about outstanding balance, re-throw it
            // Check both the error message and the details message for ApiError
            const errorMessage = balanceError instanceof Error ? balanceError.message : String(balanceError);
            const apiErrorDetails = (balanceError as any)?.details?.message || '';

            if (errorMessage.includes('Cannot remove member with outstanding balance') || apiErrorDetails.includes('Cannot remove member with outstanding balance')) {
                throw balanceError;
            }

            // Allow removal if balance calculation fails (non-critical)
        }

        // Remove member from group members map
        const updatedMembers = { ...group.members };
        delete updatedMembers[memberId];

        // Update group
        await docRef.update({
            'data.members': updatedMembers,
            updatedAt: FieldValue.serverTimestamp(),
        });

        LoggerContext.setBusinessContext({ groupId });
        logger.info('member-removed', { id: memberId, groupId });

        res.json({
            success: true,
            message: 'Member removed successfully',
        });
    } catch (error) {
        logger.error('Error in removeGroupMember', error, {
            groupId,
            userId,
            memberId,
        });
        throw error;
    }
};
