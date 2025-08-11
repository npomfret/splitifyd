import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { validateRegisterRequest } from './validation';
import { getCurrentPolicyVersions } from './policy-helpers';
import { FirestoreCollections, UserRoles, AuthErrors } from '../shared/shared-types';
import { createServerTimestamp } from '../utils/dateHelpers';

export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, displayName, termsAccepted, cookiePolicyAccepted } = validateRegisterRequest(req.body);
  let userRecord: admin.auth.UserRecord | null = null;

  try {
    // Create the user
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
    });

    // Get current policy versions for user acceptance
    const currentPolicyVersions = await getCurrentPolicyVersions();

    // Create user document in Firestore
    const firestore = admin.firestore();
    const userDoc: any = {
      email,
      displayName,
      role: UserRoles.USER, // Default role for new users
      createdAt: createServerTimestamp(),
      updatedAt: createServerTimestamp(),
      acceptedPolicies: currentPolicyVersions // Capture current policy versions
    };
    
    // Only set acceptance timestamps if the user actually accepted the terms
    if (termsAccepted) {
      userDoc.termsAcceptedAt = createServerTimestamp();
    }
    if (cookiePolicyAccepted) {
      userDoc.cookiePolicyAcceptedAt = createServerTimestamp();
    }
    
    await firestore.collection(FirestoreCollections.USERS).doc(userRecord.uid).set(userDoc);
    logger.info('User registration completed', { 
      email,
      userId: userRecord.uid 
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Account created successfully',
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName
      }
    });
  } catch (error: unknown) {
    // If user was created but firestore failed, clean up the orphaned auth record
    if (userRecord) {
      logger.error('Registration failed after auth user created, cleaning up', { 
        userId: userRecord.uid,
        error: error instanceof Error ? error : new Error(String(error)) 
      });
      
      try {
        await admin.auth().deleteUser(userRecord.uid);
        logger.info('Successfully cleaned up orphaned auth user', { userId: userRecord.uid });
      } catch (cleanupError) {
        // Log the cleanup failure but throw the original error
        logger.error('Failed to cleanup orphaned auth user', { 
          userId: userRecord.uid,
          cleanupError: cleanupError
        });
      }
    }

    // Handle specific auth errors
    if (error && typeof error === 'object' && 'code' in error && error.code === AuthErrors.EMAIL_EXISTS) {
      res.status(HTTP_STATUS.CONFLICT).json({
        error: {
          code: AuthErrors.EMAIL_EXISTS_CODE,
          message: 'An account with this email already exists'
        }
      });
      return;
    }
    
    // Let all other errors bubble up to global error handler
    throw error;
  }
};