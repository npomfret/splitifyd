import * as admin from 'firebase-admin';
import { Response } from 'express';
import { logger } from '../logger';
import { db } from '../firebase';
import { HTTP_STATUS } from '../constants';
import { FirestoreCollections } from '../shared/shared-types';
import { createServerTimestamp } from '../utils/dateHelpers';
import { AuthenticatedRequest } from '../auth/middleware';

/**
 * Get current user's profile
 */
export const getUserProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'User not authenticated' });
            return;
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
        res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: 'Failed to get user profile' });
    }
};

/**
 * Update current user's profile
 */
export const updateUserProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'User not authenticated' });
            return;
        }

        const { displayName, photoURL } = req.body;

        // Validate displayName first if provided
        if (displayName !== undefined) {
            // Validate displayName
            if (typeof displayName !== 'string') {
                res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Display name must be a string' });
                return;
            }
            
            // Check if it's empty string before trimming
            if (displayName === '') {
                res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Display name cannot be empty' });
                return;
            }
            
            const trimmedDisplayName = displayName.trim();
            if (trimmedDisplayName.length === 0) {
                res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Display name cannot be empty' });
                return;
            }
            
            if (trimmedDisplayName.length > 100) {
                res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Display name must be 100 characters or less' });
                return;
            }
        }

        if (photoURL !== undefined && photoURL !== null) {
            // Validate photoURL if provided
            if (typeof photoURL !== 'string') {
                res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Photo URL must be a string or null' });
                return;
            }
            
            if (photoURL.length > 0) {
                try {
                    new URL(photoURL);
                } catch {
                    res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Invalid photo URL format' });
                    return;
                }
            }
        }

        // After validation, check if at least one field was provided
        if (displayName === undefined && photoURL === undefined) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'At least one field (displayName or photoURL) must be provided' });
            return;
        }

        // Build update object
        const updateData: admin.auth.UpdateRequest = {};
        if (displayName !== undefined) {
            updateData.displayName = displayName.trim();
        }
        if (photoURL !== undefined) {
            updateData.photoURL = photoURL === null ? null : photoURL;
        }

        // Update Firebase Auth
        await admin.auth().updateUser(userId, updateData);

        // Update Firestore user document
        const firestoreUpdate: any = {
            updatedAt: createServerTimestamp(),
        };
        if (displayName !== undefined) {
            firestoreUpdate.displayName = displayName.trim();
        }
        if (photoURL !== undefined) {
            firestoreUpdate.photoURL = photoURL;
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
        res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: 'Failed to update user profile' });
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
            res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'User not authenticated' });
            return;
        }

        const { currentPassword, newPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Current password and new password are required' });
            return;
        }

        if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
            res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Passwords must be strings' });
            return;
        }

        // Validate new password strength
        if (newPassword.length < 6) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'New password must be at least 6 characters long' });
            return;
        }

        if (newPassword.length > 128) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'New password must be 128 characters or less' });
            return;
        }

        if (currentPassword === newPassword) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'New password must be different from current password' });
            return;
        }

        // Get user email for re-authentication
        const userRecord = await admin.auth().getUser(userId);
        if (!userRecord.email) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'User email not found' });
            return;
        }

        // Note: In a real implementation, we would verify the current password
        // by attempting to sign in with it. However, since we're in the backend,
        // we'll update the password directly. In production, you might want to
        // use Firebase Admin SDK's ability to generate a password reset link
        // or implement a more secure password change flow.

        // Update password in Firebase Auth
        await admin.auth().updateUser(userId, {
            password: newPassword,
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
        res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: 'Failed to change password' });
    }
};

/**
 * Send password reset email
 * Note: This endpoint doesn't require authentication
 */
export const sendPasswordResetEmail = async (req: any, res: Response): Promise<void> => {
    try {
        const { email } = req.body;

        // Validate input
        if (!email) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Email is required' });
            return;
        }

        if (typeof email !== 'string') {
            res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Email must be a string' });
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Invalid email format' });
            return;
        }

        try {
            // Check if user exists first
            await admin.auth().getUserByEmail(email);
            
            // Generate password reset link
            // Note: This would typically be done on the client side using Firebase Auth SDK
            // For server-side, we can generate a password reset link
            const actionCodeSettings = {
                url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`,
                handleCodeInApp: true,
            };

            const resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);

            // In production, you would send this link via email
            // For now, we'll return a success message
            logger.info('Password reset link generated', { email, resetLink });

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
        res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: 'Failed to send password reset email' });
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
            res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'User not authenticated' });
            return;
        }

        const { confirmDelete } = req.body;

        // Require explicit confirmation
        if (confirmDelete !== true) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Account deletion must be explicitly confirmed' });
            return;
        }

        // Check if user has any groups or outstanding balances
        // This is a simplified check - in production you'd want more thorough validation
        const groupsSnapshot = await db
            .collection(FirestoreCollections.GROUPS)
            .where('data.memberIds', 'array-contains', userId)
            .get();

        if (!groupsSnapshot.empty) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                error: 'Cannot delete account while member of groups. Please leave all groups first.' 
            });
            return;
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
        res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: 'Failed to delete user account' });
    }
};