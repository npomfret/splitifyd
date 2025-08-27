import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { firestoreDb } from '../firebase';
import { FirestoreCollections, UserRoles, AuthErrors, UserThemeColor } from '@splitifyd/shared';
import { logger } from '../logger';
import { Errors, ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { createServerTimestamp } from '../utils/dateHelpers';
import { getCurrentPolicyVersions } from '../auth/policy-helpers';
import { assignThemeColor } from '../user-management/assign-theme-color';
import { validateRegisterRequest } from '../auth/validation';
import { validateUpdateUserProfile, validateChangePassword, validateDeleteUser } from '../user/validation';

/**
 * User profile interface for consistent user data across the application
 */
export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string | null;
    emailVerified: boolean;
    themeColor?: string;
    preferredLanguage?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

/**
 * Result of a successful user registration
 */
export interface RegisterUserResult {
    success: boolean;
    message: string;
    user: {
        uid: string;
        email: string | undefined;
        displayName: string | undefined;
    };
}

/**
 * Firestore user document structure for registration
 */
interface FirestoreUserDocument {
    email: string;
    displayName: string;
    role: typeof UserRoles.USER | typeof UserRoles.ADMIN;
    createdAt: admin.firestore.Timestamp;
    updatedAt: admin.firestore.Timestamp;
    acceptedPolicies: Record<string, string>;
    themeColor: UserThemeColor;
    termsAcceptedAt?: admin.firestore.Timestamp;
    cookiePolicyAcceptedAt?: admin.firestore.Timestamp;
}

/**
 * Service for fetching user profiles from Firebase Auth with request-level caching
 */
export class UserService {
    private cache = new Map<string, UserProfile>();

    /**
     * Validates that a user record has all required fields
     * @throws Error if required fields are missing
     */
    private validateUserRecord(userRecord: admin.auth.UserRecord): asserts userRecord is admin.auth.UserRecord & { email: string; displayName: string } {
        if (!userRecord.email || !userRecord.displayName) {
            throw new Error(`User ${userRecord.uid} missing required fields: email and displayName are mandatory`);
        }
    }

    /**
     * Creates a UserProfile from Firebase Auth record and Firestore data
     */
    private createUserProfile(userRecord: admin.auth.UserRecord & { email: string; displayName: string }, firestoreData: any): UserProfile {
        return {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            photoURL: userRecord.photoURL || null,
            emailVerified: userRecord.emailVerified,
            themeColor: firestoreData?.themeColor,
            preferredLanguage: firestoreData?.preferredLanguage,
            createdAt: firestoreData?.createdAt,
            updatedAt: firestoreData?.updatedAt,
        };
    }

    /**
     * Get a single user's profile by their ID
     * @param userId - The Firebase UID of the user
     * @returns The user's profile data
     * @throws If user is not found or an error occurs
     */
    async getUser(userId: string): Promise<UserProfile> {
        // Check cache first
        if (this.cache.has(userId)) {
            return this.cache.get(userId)!;
        }

        try {
            // Get user from Firebase Auth
            const userRecord = await admin.auth().getUser(userId);

            // Ensure required fields are present
            this.validateUserRecord(userRecord);

            // Get additional user data from Firestore
            const userDoc = await firestoreDb.collection(FirestoreCollections.USERS).doc(userId).get();
            const userData = userDoc.data();

            const profile = this.createUserProfile(userRecord, userData);

            // Cache the result
            this.cache.set(userId, profile);

            return profile;
        } catch (error) {
            // Check if error is from Firebase Auth (user not found)
            if ((error as any).code === 'auth/user-not-found') {
                logger.error('User not found in Firebase Auth', { userId });
                throw Errors.NOT_FOUND('User not found');
            }

            logger.error('Failed to get user profile', { error, userId });
            throw error;
        }
    }

    /**
     * Get multiple user profiles by UIDs (batch operation)
     */
    async getUsers(uids: string[]): Promise<Map<string, UserProfile>> {
        const result = new Map<string, UserProfile>();
        const uncachedUids: string[] = [];

        // Check cache for each UID
        for (const uid of uids) {
            if (this.cache.has(uid)) {
                result.set(uid, this.cache.get(uid)!);
            } else {
                uncachedUids.push(uid);
            }
        }

        // Fetch uncached users in batches (Firebase Auth supports up to 100 users per batch)
        if (uncachedUids.length > 0) {
            const batchSize = 100;
            for (let i = 0; i < uncachedUids.length; i += batchSize) {
                const batch = uncachedUids.slice(i, i + batchSize);
                await this.fetchUserBatch(batch, result);
            }
        }

        return result;
    }

    /**
     * Fetch a batch of users and add to result map
     */
    private async fetchUserBatch(uids: string[], result: Map<string, UserProfile>): Promise<void> {
        const getUsersResult = await admin.auth().getUsers(uids.map((uid) => ({ uid })));

        // Process found users
        for (const userRecord of getUsersResult.users) {
            // Ensure required fields are present
            this.validateUserRecord(userRecord);

            // Fetch Firestore data for this user
            const userDoc = await firestoreDb.collection(FirestoreCollections.USERS).doc(userRecord.uid).get();
            const userData = userDoc.data();

            const profile = this.createUserProfile(userRecord, userData);

            // Cache and add to result
            this.cache.set(userRecord.uid, profile);
            result.set(userRecord.uid, profile);
        }

        // Handle not found users - log warning but don't throw error
        // Let calling code handle missing users gracefully
    }

    /**
     * Update a user's profile
     * @param userId - The Firebase UID of the user
     * @param requestBody - The raw request body containing profile update data
     * @param language - The user's preferred language for validation messages
     * @returns The updated user profile
     * @throws ApiError if update fails
     */
    async updateProfile(userId: string, requestBody: unknown, language: string = 'en'): Promise<UserProfile> {
        // Validate the request body with localized error messages
        const validatedData = validateUpdateUserProfile(requestBody, language);

        try {
            // Build update object for Firebase Auth
            const authUpdateData: admin.auth.UpdateRequest = {};
            if (validatedData.displayName !== undefined) {
                authUpdateData.displayName = validatedData.displayName;
            }
            if (validatedData.photoURL !== undefined) {
                authUpdateData.photoURL = validatedData.photoURL === null ? null : validatedData.photoURL;
            }

            // Update Firebase Auth
            await admin.auth().updateUser(userId, authUpdateData);

            // Build update object for Firestore
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

            // Update Firestore user document
            await firestoreDb.collection(FirestoreCollections.USERS).doc(userId).update(firestoreUpdate);

            // Clear cache for this user to ensure fresh data
            this.cache.delete(userId);

            // Return the updated profile
            return await this.getUser(userId);
        } catch (error: unknown) {
            // Check if error is from Firebase Auth (user not found)
            if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found') {
                logger.error('User not found in Firebase Auth', { userId });
                throw Errors.NOT_FOUND('User not found');
            }

            logger.error('Failed to update user profile', { error: error as Error, userId });
            throw error;
        }
    }

    /**
     * Change a user's password
     * @param userId - The Firebase UID of the user
     * @param requestBody - The raw request body containing password change data
     * @returns Success message
     * @throws ApiError if password change fails
     */
    async changePassword(userId: string, requestBody: unknown): Promise<{ message: string }> {
        // Validate the request body
        const validatedData = validateChangePassword(requestBody);

        try {
            // Get user to ensure they exist
            const userRecord = await admin.auth().getUser(userId);
            if (!userRecord.email) {
                throw Errors.INVALID_INPUT('User email not found');
            }

            // TODO: In a production environment, we should verify the current password
            // by attempting to sign in with it using the Firebase Client SDK.
            // For now, we're updating the password directly as this is a backend service.
            // Consider implementing a more secure password verification flow.

            // Update password in Firebase Auth
            await admin.auth().updateUser(userId, {
                password: validatedData.newPassword,
            });

            // Update Firestore to track password change
            await firestoreDb.collection(FirestoreCollections.USERS).doc(userId).update({
                updatedAt: createServerTimestamp(),
                passwordChangedAt: createServerTimestamp(),
            });

            logger.info('Password changed successfully', { userId });

            return {
                message: 'Password changed successfully',
            };
        } catch (error: unknown) {
            // Check if error is from Firebase Auth (user not found)
            if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found') {
                logger.error('User not found in Firebase Auth', { userId });
                throw Errors.NOT_FOUND('User not found');
            }

            logger.error('Failed to change password', { error: error as Error, userId });
            throw error;
        }
    }

    /**
     * Delete a user account
     * @param userId - The Firebase UID of the user to delete
     * @param requestBody - The raw request body containing deletion confirmation
     * @returns Success message
     * @throws ApiError if deletion fails or user has active groups
     */
    async deleteAccount(userId: string, requestBody: unknown): Promise<{ message: string }> {
        // Validate the request body - ensures confirmDelete is true
        validateDeleteUser(requestBody);

        try {
            // Check if user has any groups or outstanding balances
            // This is a simplified check - in production you'd want more thorough validation
            const groupsSnapshot = await firestoreDb
                .collection(FirestoreCollections.GROUPS)
                .where(`data.members.${userId}`, '!=', null)
                .get();

            if (!groupsSnapshot.empty) {
                throw Errors.INVALID_INPUT('Cannot delete account while member of groups. Please leave all groups first.');
            }

            // Delete user data from Firestore first (before Auth deletion)
            await firestoreDb.collection(FirestoreCollections.USERS).doc(userId).delete();

            // Delete user from Firebase Auth
            await admin.auth().deleteUser(userId);

            logger.info('User account deleted successfully', { userId });

            return {
                message: 'Account deleted successfully',
            };
        } catch (error: unknown) {
            // Check if error is from Firebase Auth (user not found)
            if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found') {
                logger.error('User not found in Firebase Auth', { userId });
                throw Errors.NOT_FOUND('User not found');
            }

            logger.error('Failed to delete user account', { error: error as Error, userId });
            throw error;
        }
    }

    /**
     * Register a new user in the system
     * @param requestBody - The raw request body containing user registration data
     * @returns A RegisterUserResult with the newly created user information
     * @throws ApiError if registration fails
     */
    async registerUser(requestBody: unknown): Promise<RegisterUserResult> {
        // Validate the request body
        const { email, password, displayName, termsAccepted, cookiePolicyAccepted } = validateRegisterRequest(requestBody);
        
        let userRecord: admin.auth.UserRecord | null = null;

        try {
            // Create the user in Firebase Auth
            userRecord = await admin.auth().createUser({
                email,
                password,
                displayName,
            });

            // Get current policy versions for user acceptance
            const currentPolicyVersions = await getCurrentPolicyVersions();

            // Assign theme color for new user
            const themeColor = await assignThemeColor(userRecord.uid);

            // Create user document in Firestore
            const userDoc: FirestoreUserDocument = {
                email,
                displayName,
                role: UserRoles.USER, // Default role for new users
                createdAt: createServerTimestamp(),
                updatedAt: createServerTimestamp(),
                acceptedPolicies: currentPolicyVersions, // Capture current policy versions
                themeColor, // Add automatic theme color assignment
            };

            // Only set acceptance timestamps if the user actually accepted the terms
            if (termsAccepted) {
                userDoc.termsAcceptedAt = createServerTimestamp();
            }
            if (cookiePolicyAccepted) {
                userDoc.cookiePolicyAcceptedAt = createServerTimestamp();
            }

            await firestoreDb.collection(FirestoreCollections.USERS).doc(userRecord.uid).set(userDoc);
            
            logger.info('user-registered', { id: userRecord.uid });

            return {
                success: true,
                message: 'Account created successfully',
                user: {
                    uid: userRecord.uid,
                    email: userRecord.email,
                    displayName: userRecord.displayName,
                },
            };
        } catch (error: unknown) {
            // If user was created but firestore failed, clean up the orphaned auth record
            if (userRecord) {
                try {
                    await admin.auth().deleteUser(userRecord.uid);
                } catch (cleanupError) {
                    // Add cleanup failure context to the error
                    logger.error('Failed to cleanup orphaned auth user', cleanupError, {
                        userId: userRecord.uid,
                    });
                }
            }

            // Handle specific auth errors
            if (error && typeof error === 'object' && 'code' in error && error.code === AuthErrors.EMAIL_EXISTS) {
                throw new ApiError(
                    HTTP_STATUS.CONFLICT,
                    AuthErrors.EMAIL_EXISTS_CODE,
                    'An account with this email already exists'
                );
            }

            // Re-throw the error for the handler to catch
            throw error;
        }
    }
}

// Export a singleton instance for use across the application
export const userService = new UserService();
