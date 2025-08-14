import { Response } from 'express';
import * as admin from 'firebase-admin';
import { AuthenticatedRequest } from '../auth/middleware';
import { Errors } from '../utils/errors';
import { userService } from '../services/userService';
import { validateGroupId } from './validation';
import { logger } from '../logger';
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
 * Leave a group
 * Removes the current user from the group
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
    const docRef = admin.firestore().collection(FirestoreCollections.GROUPS).doc(groupId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw Errors.NOT_FOUND('Group');
    }
    
    const group = transformGroupDocument(doc);
    
    // Check if user is a member
    if (!group.memberIds.includes(userId)) {
      throw Errors.INVALID_INPUT({ message: 'You are not a member of this group' });
    }
    
    // Can't leave if you're the only member
    if (group.memberIds.length === 1) {
      throw Errors.INVALID_INPUT({ message: 'Cannot leave group - you are the only member' });
    }
    
    // Remove user from members list
    const updatedMembers = group.memberIds.filter(id => id !== userId);
    
    // Update group
    await docRef.update({
      'data.memberIds': updatedMembers,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.info('User left group', { userId, groupId });
    
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
 * Remove a member from a group
 * Only group creators can remove other members
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
  const memberId = req.params.memberId;
  
  if (!memberId) {
    throw Errors.MISSING_FIELD('memberId');
  }
  
  try {
    const docRef = admin.firestore().collection(FirestoreCollections.GROUPS).doc(groupId);
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
    if (!group.memberIds.includes(memberId)) {
      throw Errors.INVALID_INPUT({ message: 'User is not a member of this group' });
    }
    
    // Can't remove yourself as creator
    if (memberId === userId) {
      throw Errors.INVALID_INPUT({ message: 'Cannot remove yourself as the group creator' });
    }
    
    // Remove member from group
    const updatedMembers = group.memberIds.filter(id => id !== memberId);
    
    // Update group
    await docRef.update({
      'data.memberIds': updatedMembers,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.info('Member removed from group', { userId, groupId, memberId });
    
    res.json({
      success: true,
      message: 'Member successfully removed from the group'
    });
  } catch (error) {
    logger.error('Error in removeGroupMember', { 
      error: error instanceof Error ? error : new Error(String(error)),
      groupId,
      userId,
      memberId
    });
    throw error;
  }
};
