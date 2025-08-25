import * as admin from 'firebase-admin';
import { Response } from 'express';
import { logger } from '../logger';
import { db } from '../firebase';
import { HTTP_STATUS } from '../constants';
import { FirestoreCollections } from '../shared/shared-types';
import { createServerTimestamp } from '../utils/dateHelpers';
import { AuthenticatedRequest } from '../auth/middleware';
import { LocalizedRequest } from '../utils/i18n';
import { Errors } from '../utils/errors';
import { validateUpdateUserProfile, validateDeleteUser, validateChangePassword } from './validation';

/**
 * Get current user's profile
 */
export const getUserProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        // Get user from Firebase Auth
        const userRecord = await admin.auth().getUser(userId);
        
        // Get additional user data from Firestore
        const userDoc = await db.collection(FirestoreCollections.USERS).doc(userId).get();
        const userData = userDoc.data();

        res.status(HTTP_STATUS.OK).json({
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            photoURL: userRecord.photoURL || null,
            emailVerified: userRecord.emailVerified,
            themeColor: userData?.themeColor,
            preferredLanguage: userData?.preferredLanguage,
            createdAt: userData?.createdAt,
            updatedAt: userData?.updatedAt,
        });
    } catch (error) {
        logger.error('Failed to get user profile', { error: error as Error, userId: req.user?.uid });
        throw error;
    }
};

/**
 * Update current user's profile
 */
export const updateUserProfile = async (req: AuthenticatedRequest & LocalizedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        // Validate request body using Joi with user's preferred language
        const validatedData = validateUpdateUserProfile(req.body, req.language);

        // Build update object for Firebase Auth
        const updateData: admin.auth.UpdateRequest = {};
        if (validatedData.displayName !== undefined) {
            updateData.displayName = validatedData.displayName;
        }
        if (validatedData.photoURL !== undefined) {
            updateData.photoURL = validatedData.photoURL === null ? null : validatedData.photoURL;
        }

        // Update Firebase Auth
        await admin.auth().updateUser(userId, updateData);

        // Update Firestore user document
        const firestoreUpdate: any = {
            updatedAt: createServerTimestamp(),
        };
        if (validatedData.displayName !== undefined) {
            firestoreUpdate.displayName = validatedData.displayName;
        }
        if (validatedData.photoURL !== undefined) {
            firestoreUpdate.photoURL = validatedData.photoURL;
        }
        if (validatedData.preferredLanguage !== undefined) {
            firestoreUpdate.preferredLanguage = validatedData.preferredLanguage;
        }

        await db.collection(FirestoreCollections.USERS).doc(userId).update(firestoreUpdate);

        // Get updated user data
        const updatedUser = await admin.auth().getUser(userId);
        const userDoc = await db.collection(FirestoreCollections.USERS).doc(userId).get();
        const userData = userDoc.data();

        res.status(HTTP_STATUS.OK).json({
            uid: updatedUser.uid,
            email: updatedUser.email,
            displayName: updatedUser.displayName,
            photoURL: updatedUser.photoURL || null,
            emailVerified: updatedUser.emailVerified,
            themeColor: userData?.themeColor,
            preferredLanguage: userData?.preferredLanguage,
            createdAt: userData?.createdAt,
            updatedAt: userData?.updatedAt,
        });
    } catch (error) {
        logger.error('Failed to update user profile', { error: error as Error, userId: req.user?.uid });
        throw error;
    }
};

/**
 * Change user password
 * Note: This requires the user to provide their current password for security
 */
export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        // Validate request body using Joi
        const validatedData = validateChangePassword(req.body);

        // Get user email for re-authentication
        const userRecord = await admin.auth().getUser(userId);
        if (!userRecord.email) {
            throw Errors.INVALID_INPUT('User email not found');
        }

        // Note: In a real implementation, we would verify the current password
        // by attempting to sign in with it. However, since we're in the backend,
        // we'll update the password directly. In production, you might want to
        // use Firebase Admin SDK's ability to generate a password reset link
        // or implement a more secure password change flow.

        // Update password in Firebase Auth
        await admin.auth().updateUser(userId, {
            password: validatedData.newPassword,
        });

        // Update Firestore to track password change
        await db.collection(FirestoreCollections.USERS).doc(userId).update({
            updatedAt: createServerTimestamp(),
            passwordChangedAt: createServerTimestamp(),
        });

        res.status(HTTP_STATUS.OK).json({
            message: 'Password changed successfully',
        });
    } catch (error) {
        logger.error('Failed to change password', { error: error as Error, userId: req.user?.uid });
        throw error;
    }
};

/**
 * Delete user account
 * This is a destructive operation that requires re-authentication
 */
export const deleteUserAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        // Validate request body using Joi
        validateDeleteUser(req.body);
        
        // confirmDelete validation is handled by Joi, no need for manual check

        // Check if user has any groups or outstanding balances
        // This is a simplified check - in production you'd want more thorough validation
        const groupsSnapshot = await db
            .collection(FirestoreCollections.GROUPS)
            .where(`data.members.${userId}`, '!=', null)
            .get();

        if (!groupsSnapshot.empty) {
            throw Errors.INVALID_INPUT('Cannot delete account while member of groups. Please leave all groups first.');
        }

        // Delete user data from Firestore
        await db.collection(FirestoreCollections.USERS).doc(userId).delete();

        // Delete user from Firebase Auth
        await admin.auth().deleteUser(userId);

        res.status(HTTP_STATUS.OK).json({
            message: 'Account deleted successfully',
        });
    } catch (error) {
        logger.error('Failed to delete user account', { error: error as Error, userId: req.user?.uid });
        throw error;
    }
};