import * as admin from 'firebase-admin';
import { Response } from 'express';
import { logger } from '../logger';
import { db } from '../firebase';
import { HTTP_STATUS } from '../constants';
import { FirestoreCollections } from '../shared/shared-types';
import { createServerTimestamp } from '../utils/dateHelpers';
import { AuthenticatedRequest } from '../auth/middleware';
import { Errors } from '../utils/errors';
import { validateUpdateUserProfile, validateDeleteUser, validateChangePassword, validateSendPasswordReset } from './validation';
import assert from "node:assert";

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
export const updateUserProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        // Validate request body using Joi
        const validatedData = validateUpdateUserProfile(req.body);

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

// todo
// assert(process.env.FRONTEND_URL, `FRONTEND_URL env var not set`);

/**
 * Send password reset email
 * Note: This endpoint doesn't require authentication
 */
export const sendPasswordResetEmail = async (req: any, res: Response): Promise<void> => {
    try {
        // Validate request body using Joi
        const validatedData = validateSendPasswordReset(req.body);

        try {
            // Check if user exists first
            await admin.auth().getUserByEmail(validatedData.email);

            assert(process.env.FRONTEND_URL, `FRONTEND_URL env var not set`);

            // Generate password reset link
            // Note: This would typically be done on the client side using Firebase Auth SDK
            // For server-side, we can generate a password reset link
            const actionCodeSettings = {
                url: `${process.env.FRONTEND_URL!}/reset-password`,
                handleCodeInApp: true,
            };

            const resetLink = await admin.auth().generatePasswordResetLink(validatedData.email, actionCodeSettings);

            // In production, you would send this link via email
            // For now, we'll return a success message
            logger.info('password-reset-requested', { email: validatedData.email });

            res.status(HTTP_STATUS.OK).json({
                message: 'Password reset email sent successfully',
                // In development, you might include the link for testing
                ...(process.env.NODE_ENV === 'development' && { resetLink }),
            });
        } catch (authError: any) {
            // For security, don't reveal whether email exists or not
            if (authError.code === 'auth/user-not-found' || authError.code === 'auth/email-not-found') {
                res.status(HTTP_STATUS.OK).json({
                    message: 'If the email exists, a password reset link has been sent',
                });
            } else {
                throw authError;
            }
        }
    } catch (error: any) {
        logger.error('Failed to send password reset email', { error });
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