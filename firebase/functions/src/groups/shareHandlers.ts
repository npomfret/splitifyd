import { Response } from 'express';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { ApiError } from '../utils/errors';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { AuthenticatedRequest } from '../auth/middleware';

const generateShareToken = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
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
      const members = groupData.data?.members || [];
      const isAdmin = members.some((member: any) => 
        member.uid === userId && member.role === 'admin'
      );
      
      if (!isAdmin) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'UNAUTHORIZED',
          'Only group admins can generate share links'
        );
      }
    }

    const shareToken = generateShareToken();
    
    await groupRef.update({
      'data.shareableLink': shareToken,
      updatedAt: Timestamp.now(),
    });

    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://splitifyd.web.app' 
      : 'http://localhost:5002';
    
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
  const userEmail = req.user!.email || '';
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
    const groupData = groupDoc.data();
    const groupId = groupDoc.id;

    const members = groupData.data?.members || [];
    const isAlreadyMember = members.some((member: any) => member.uid === userId);
    
    if (isAlreadyMember || groupData.userId === userId) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        'ALREADY_MEMBER',
        'You are already a member of this group'
      );
    }

    const newMember = {
      uid: userId,
      name: userName,
      initials: userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      role: 'member',
      joinedAt: new Date().toISOString(),
    };

    const currentMembers = groupData.data?.members || [];
    const currentEmails = groupData.data?.memberEmails || [];
    
    const allMemberIds = [groupData.userId];
    [...currentMembers, newMember].forEach((member: any) => {
      if (!allMemberIds.includes(member.uid)) {
        allMemberIds.push(member.uid);
      }
    });
    
    await groupDoc.ref.update({
      'data.members': [...currentMembers, newMember],
      'data.memberEmails': [...currentEmails, userEmail],
      'data.memberIds': allMemberIds,
      updatedAt: Timestamp.now(),
    });

    logger.info('User joined group via share link', {
      groupId,
      userId,
      userName,
      linkId: linkId.substring(0, 4) + '...',
    });

    res.status(HTTP_STATUS.OK).json({
      groupId,
      groupName: groupData.data?.name || 'Untitled Group',
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