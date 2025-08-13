import { Response } from 'express';
import * as admin from 'firebase-admin';
import { AuthenticatedRequest } from '../auth/middleware';
import { Errors } from '../utils/errors';
import { userService } from '../services/userService';
import { validateGroupId } from './validation';
import { logger } from '../logger';
import { createServerTimestamp } from '../utils/dateHelpers';
import { User, GroupMembersResponse, FirestoreCollections } from '../shared/shared-types';
import { Group } from '../shared/shared-types';

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
    memberIds: groupData.memberIds!,
    createdAt: data.createdAt!.toDate().toISOString(),
    updatedAt: data.updatedAt!.toDate().toISOString(),
  };
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
 * Get members of a group
 * Returns member profiles for all users in the group
 */
export const getGroupMembers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    throw Errors.UNAUTHORIZED();
  }

  const groupId = validateGroupId(req.params.id);
  
  try {
    // Verify user has access to the group
    const docRef = admin.firestore().collection(FirestoreCollections.GROUPS).doc(groupId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw Errors.NOT_FOUND('Group');
    }
    
    const group = transformGroupDocument(doc);
    
    // Check if user is a member
    if (!group.memberIds.includes(userId)) {
      throw Errors.FORBIDDEN();
    }
    
    // Fetch member profiles
    const memberProfiles = await userService.getUsers(group.memberIds);
    
    // Convert to User format
    const members: User[] = group.memberIds.map((memberId: string) => {
      const profile = memberProfiles.get(memberId);
      if (!profile) {
        logger.warn('Member profile not found', { memberId, groupId });
        // Return minimal user object for missing profiles
        return {
          uid: memberId,
          name: 'Unknown User',
          initials: '?',
          email: '',
          displayName: 'Unknown User'
        };
      }
      
      return {
        uid: memberId,
        name: profile.displayName,
        initials: getInitials(profile.displayName),
        email: profile.email,
        displayName: profile.displayName
      };
    });

    // Sort members alphabetically by display name
    members.sort((a, b) => a.displayName.localeCompare(b.displayName));

    const response: GroupMembersResponse = {
      members,
      totalCount: members.length,
      hasMore: false
    };

    res.json(response);
  } catch (error) {
    logger.error('Error in getGroupMembers', { 
      error: error instanceof Error ? error : new Error(String(error)),
      groupId,
      userId
    });
    throw error;
  }
};

/**
 * Leave a group (self-remove)
 * Allows a user to voluntarily leave a group
 */
export const leaveGroup = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    throw Errors.UNAUTHORIZED();
  }

  const groupId = validateGroupId(req.params.id);
  
  try {
    // Fetch the group
    const docRef = admin.firestore().collection(FirestoreCollections.GROUPS).doc(groupId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw Errors.NOT_FOUND('Group');
    }
    
    const group = transformGroupDocument(doc);
    
    // Check if user is a member
    if (!group.memberIds.includes(userId)) {
      throw Errors.NOT_FOUND('Group'); // Return 404 to prevent enumeration
    }
    
    // Check if user is the creator
    if (group.createdBy === userId) {
      throw Errors.INVALID_INPUT('Group creator cannot leave the group. Transfer ownership or delete the group instead.');
    }
    
    // Check for outstanding balances
    const { calculateGroupBalances } = await import('../services/balanceCalculator');
    const balances = await calculateGroupBalances(groupId);
    const userBalance = balances.userBalances[userId];
    
    if (userBalance && Math.abs(userBalance.netBalance) > 0.01) {
      throw Errors.INVALID_INPUT(
        `Cannot leave group with outstanding balance of ${userBalance.netBalance > 0 ? '+' : ''}$${Math.abs(userBalance.netBalance).toFixed(2)}. Please settle your debts first.`
      );
    }
    
    // Remove user from memberIds
    const updatedMemberIds = group.memberIds.filter(id => id !== userId);
    
    // Update the group
    const now = createServerTimestamp();
    await docRef.update({
      'data.memberIds': updatedMemberIds,
      'data.updatedAt': now.toDate().toISOString(),
      updatedAt: now
    });
    
    logger.info(`User ${userId} left group ${groupId}`);
    
    res.json({
      success: true,
      message: 'Successfully left the group'
    });
  } catch (error) {
    logger.error('Error in leaveGroup', { 
      error: error instanceof Error ? error : new Error(String(error)),
      groupId,
      userId
    });
    throw error;
  }
};

/**
 * Remove a member from a group (admin only)
 * Allows group creator to remove another member
 */
export const removeGroupMember = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    throw Errors.UNAUTHORIZED();
  }

  const groupId = validateGroupId(req.params.id);
  const memberToRemove = req.params.memberId;
  
  if (!memberToRemove || typeof memberToRemove !== 'string') {
    throw Errors.MISSING_FIELD('memberId');
  }
  
  try {
    // Fetch the group
    const docRef = admin.firestore().collection(FirestoreCollections.GROUPS).doc(groupId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw Errors.NOT_FOUND('Group');
    }
    
    const group = transformGroupDocument(doc);
    
    // Check if user is the creator (admin)
    if (group.createdBy !== userId) {
      throw Errors.FORBIDDEN();
    }
    
    // Check if member to remove is in the group
    if (!group.memberIds.includes(memberToRemove)) {
      throw Errors.NOT_FOUND('Member not found in group');
    }
    
    // Cannot remove the creator
    if (memberToRemove === group.createdBy) {
      throw Errors.INVALID_INPUT('Cannot remove the group creator');
    }
    
    // Check for outstanding balances
    const { calculateGroupBalances } = await import('../services/balanceCalculator');
    const balances = await calculateGroupBalances(groupId);
    const memberBalance = balances.userBalances[memberToRemove];
    
    if (memberBalance && Math.abs(memberBalance.netBalance) > 0.01) {
      throw Errors.INVALID_INPUT(
        `Cannot remove member with outstanding balance of ${memberBalance.netBalance > 0 ? '+' : ''}$${Math.abs(memberBalance.netBalance).toFixed(2)}. Settle debts first.`
      );
    }
    
    // Remove member from memberIds
    const updatedMemberIds = group.memberIds.filter(id => id !== memberToRemove);
    
    // Update the group
    const now = createServerTimestamp();
    await docRef.update({
      'data.memberIds': updatedMemberIds,
      'data.updatedAt': now.toDate().toISOString(),
      updatedAt: now
    });
    
    logger.info(`Admin ${userId} removed member ${memberToRemove} from group ${groupId}`);
    
    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    logger.error('Error in removeGroupMember', { 
      error: error instanceof Error ? error : new Error(String(error)),
      groupId,
      userId,
      memberToRemove
    });
    throw error;
  }
};