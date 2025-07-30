import { Response } from 'express';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { ApiError } from '../utils/errors';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { AuthenticatedRequest } from '../auth/middleware';

const generateShareToken = (): string => {
  const bytes = randomBytes(12);
  const base64url = bytes.toString('base64url');
  return base64url.substring(0, 16);
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
    errors
  };
};

export async function generateShareableLink(req: AuthenticatedRequest, res: Response): Promise<void> {
  const validationRules = {
    groupId: { type: 'string', required: true },
  };

  const validation = validateRequest(req.body, validationRules);
  if (!validation.isValid) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      'VALIDATION_ERROR',
      `Invalid request: ${validation.errors.join(', ')}`
    );
  }

  const { groupId } = req.body;
  const userId = req.user!.uid;

  try {
    const groupRef = admin.firestore().collection('documents').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      throw new ApiError(
        HTTP_STATUS.NOT_FOUND,
        'GROUP_NOT_FOUND',
        'Group not found'
      );
    }

    const groupData = groupDoc.data()!;
    
    if (groupData.userId !== userId) {
      const memberIds = groupData.data!.memberIds!;
      const isMember = memberIds.includes(userId);
      
      if (!isMember) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'UNAUTHORIZED',
          'Only group members can generate share links'
        );
      }
    }

    const shareToken = generateShareToken();
    
    await groupRef.update({
      'data.shareableLink': shareToken,
      updatedAt: Timestamp.now(),
    });

    const protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    const shareableUrl = `${baseUrl}/join-group.html?linkId=${shareToken}`;

    logger.info('Shareable link generated', {
      groupId,
      userId,
      shareToken: shareToken.substring(0, 4) + '...',
    });

    res.status(HTTP_STATUS.OK).json({
      shareableUrl,
      linkId: shareToken,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    
    logger.errorWithContext('Error generating shareable link', error as Error, {
      groupId,
      userId,
    });
    
    throw new ApiError(
      HTTP_STATUS.INTERNAL_ERROR,
      'INTERNAL_ERROR',
      'Failed to generate shareable link'
    );
  }
}

export async function joinGroupByLink(req: AuthenticatedRequest, res: Response): Promise<void> {
  const validationRules = {
    linkId: { type: 'string', required: true },
  };

  const validation = validateRequest(req.body, validationRules);
  if (!validation.isValid) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      'VALIDATION_ERROR',
      `Invalid request: ${validation.errors.join(', ')}`
    );
  }

  const { linkId } = req.body;
  const userId = req.user!.uid;
  const userEmail = req.user!.email;
  const userName = userEmail.split('@')[0];

  try {
    const groupsQuery = await admin.firestore()
      .collection('documents')
      .where('data.shareableLink', '==', linkId)
      .limit(1)
      .get();

    if (groupsQuery.empty) {
      throw new ApiError(
        HTTP_STATUS.NOT_FOUND,
        'INVALID_LINK',
        'Invalid or expired share link'
      );
    }

    const groupDoc = groupsQuery.docs[0];
    const groupId = groupDoc.id;

    const result = await admin.firestore().runTransaction(async (transaction) => {
      const groupRef = admin.firestore().collection('documents').doc(groupId);
      const groupSnapshot = await transaction.get(groupRef);
      
      if (!groupSnapshot.exists) {
        throw new ApiError(
          HTTP_STATUS.NOT_FOUND,
          'GROUP_NOT_FOUND',
          'Group not found'
        );
      }

      const groupData = groupSnapshot.data()!;
      if (!groupData.data?.memberIds) {
        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_GROUP', 'Group missing memberIds');
      }
      const currentMemberIds = groupData.data.memberIds;
      
      // Ensure group owner is in memberIds (but no duplicates)
      const allMemberIds = [...currentMemberIds];
      if (!allMemberIds.includes(groupData.userId)) {
        allMemberIds.push(groupData.userId);
      }
      
      // Check if user is already a member
      if (allMemberIds.includes(userId)) {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          'ALREADY_MEMBER',
          'You are already a member of this group'
        );
      }
      
      // Add user to memberIds
      allMemberIds.push(userId);
      
      transaction.update(groupRef, {
        'data.memberIds': allMemberIds,
        updatedAt: Timestamp.now(),
      });

      return {
        groupName: groupData.data!.name!
      };
    });

    logger.info('User joined group via share link', {
      groupId,
      userId,
      userName,
      linkId: linkId.substring(0, 4) + '...',
    });

    res.status(HTTP_STATUS.OK).json({
      groupId,
      groupName: result.groupName,
      message: 'Successfully joined group',
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    
    logger.errorWithContext('Error joining group by link', error as Error, {
      linkId: linkId.substring(0, 4) + '...',
      userId,
    });
    
    throw new ApiError(
      HTTP_STATUS.INTERNAL_ERROR,
      'INTERNAL_ERROR',
      'Failed to join group'
    );
  }
}