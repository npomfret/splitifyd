import {UpdateRequest, UserRecord} from 'firebase-admin/auth';
import {Timestamp} from 'firebase-admin/firestore';
import {AuthErrors, RegisteredUser, SystemUserRoles, UserRegistration, UserThemeColor} from '@splitifyd/shared';
import {logger} from '../logger';
import {LoggerContext} from '../utils/logger-context';
import {ApiError, Errors} from '../utils/errors';
import {HTTP_STATUS} from '../constants';
import {createOptimisticTimestamp} from '../utils/dateHelpers';
import {getCurrentPolicyVersions} from '../auth/policy-helpers';
import {assignThemeColor} from '../user-management/assign-theme-color';
import {validateRegisterRequest} from '../auth/validation';
import {validateChangePassword, validateDeleteUser, validateUpdateUserProfile} from '../user/validation';
import {measureDb} from '../monitoring/measure';
import {UserDataSchema} from '../schemas';
import {FirestoreValidationService} from './FirestoreValidationService';
import {NotificationService} from './notification-service';
import type {IFirestoreReader, IFirestoreWriter} from './firestore';
import type {IAuthService} from './auth';
import {type GroupMemberDocument, GroupMembersResponse, GroupMemberWithProfile} from '@splitifyd/shared/src';

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
    role: typeof SystemUserRoles.SYSTEM_USER | typeof SystemUserRoles.SYSTEM_ADMIN;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    acceptedPolicies: Record<string, string>;
    themeColor: UserThemeColor;
    termsAcceptedAt?: Timestamp;
    cookiePolicyAcceptedAt?: Timestamp;
}

/**
 * Service for fetching user profiles from Firebase Auth
 */
export class UserService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly validationService: FirestoreValidationService,
        private readonly notificationService: NotificationService,
        private readonly authService: IAuthService,
    ) {}

    /**
     * Validates that a user record has all required fields
     * @throws Error if required fields are missing
     */
    private validateUserRecord(userRecord: UserRecord): asserts userRecord is UserRecord & { email: string; displayName: string } {
        if (!userRecord.email || !userRecord.displayName) {
            throw new Error(`User ${userRecord.uid} missing required fields: email and displayName are mandatory`);
        }
    }

    /**
     * Creates a UserProfile from Firebase Auth record and Firestore data
     */
    private createUserProfile(userRecord: UserRecord & { email: string; displayName: string }, firestoreData: any): UserProfile {
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
        return measureDb('UserService2.getUser', async () => this._getUser(userId));
    }

    private async _getUser(userId: string): Promise<UserProfile> {
        LoggerContext.update({ userId });

        try {
            // Get user from Firebase Auth
            const userRecord = await this.authService.getUser(userId);

            // Check if user exists
            if (!userRecord) {
                logger.error('User not found in Firebase Auth', new Error(`User ${userId} not found`));
                throw Errors.NOT_FOUND('User not found');
            }

            // Ensure required fields are present
            this.validateUserRecord(userRecord);

            // Get additional user data from Firestore via reader
            const userData = await this.firestoreReader.getUser(userId);

            // User data is already validated by FirestoreReader

            const profile = this.createUserProfile(userRecord, userData);

            return profile;
        } catch (error) {
            // Check if error is from Firebase Auth (user not found)
            if ((error as any).code === 'auth/user-not-found') {
                logger.error('User not found in Firebase Auth', error as Error);
                throw Errors.NOT_FOUND('User not found');
            }

            logger.error('Failed to get user profile', error as Error);
            throw error;
        }
    }

    /**
     * Get multiple user profiles by UIDs (batch operation)
     */
    async getUsers(uids: string[]): Promise<Map<string, UserProfile>> {
        return measureDb('UserService2.getUsers', async () => this._getUsers(uids));
    }

    private async _getUsers(uids: string[]): Promise<Map<string, UserProfile>> {
        LoggerContext.update({ operation: 'batch-get-users', userCount: uids.length });

        const result = new Map<string, UserProfile>();

        // Fetch all users in batches (Firebase Auth supports up to 100 users per batch)
        if (uids.length > 0) {
            const batchSize = 100;
            for (let i = 0; i < uids.length; i += batchSize) {
                const batch = uids.slice(i, i + batchSize);
                await this.fetchUserBatch(batch, result);
            }
        }

        return result;
    }

    /**
     * Fetch a batch of users and add to result map
     */
    private async fetchUserBatch(uids: string[], result: Map<string, UserProfile>): Promise<void> {
        const getUsersResult = await this.authService.getUsers(uids.map((uid) => ({ uid })));

        // Process found users
        for (const userRecord of getUsersResult.users) {
            // Ensure required fields are present
            this.validateUserRecord(userRecord);

            // Fetch Firestore data for this user via reader
            const userData = await this.firestoreReader.getUser(userRecord.uid);

            const profile = this.createUserProfile(userRecord, userData);

            // Add to result
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
        return measureDb('UserService2.updateProfile', async () => this._updateProfile(userId, requestBody, language));
    }

    private async _updateProfile(userId: string, requestBody: unknown, language: string = 'en'): Promise<UserProfile> {
        LoggerContext.update({ userId, operation: 'update-profile' });

        // Validate the request body with localized error messages
        const validatedData = validateUpdateUserProfile(requestBody, language);

        try {
            // Build update object for Firebase Auth
            const authUpdateData: UpdateRequest = {};
            if (validatedData.displayName !== undefined) {
                authUpdateData.displayName = validatedData.displayName;
            }
            if (validatedData.photoURL !== undefined) {
                authUpdateData.photoURL = validatedData.photoURL === null ? null : validatedData.photoURL;
            }

            // Update Firebase Auth
            await this.authService.updateUser(userId, authUpdateData);

            // Build update object for Firestore
            const firestoreUpdate: any = {
                updatedAt: createOptimisticTimestamp(),
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

            // Validate update object before applying to Firestore
            try {
                this.validationService.validateBeforeWrite(UserDataSchema, firestoreUpdate, 'UserData', {
                    documentId: userId,
                    collection: 'users',
                    userId,
                    operation: 'updateProfile',
                });
            } catch (error) {
                logger.error('User document update validation failed', error as Error, {
                    userId,
                    updateData: firestoreUpdate,
                });
                throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_USER_DATA', 'User document update validation failed');
            }

            // Update Firestore user document
            await this.firestoreWriter.updateUser(userId, firestoreUpdate);

            // Return the updated profile
            return await this.getUser(userId);
        } catch (error: unknown) {
            // Check if error is from Firebase Auth (user not found)
            if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found') {
                logger.error('User not found in Firebase Auth', error as unknown as Error);
                throw Errors.NOT_FOUND('User not found');
            }

            logger.error('Failed to update user profile', error as unknown as Error);
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
        LoggerContext.update({ userId, operation: 'change-password' });

        // Validate the request body
        const validatedData = validateChangePassword(requestBody);

        try {
            // Get user to ensure they exist
            const userRecord = await this.authService.getUser(userId);
            if (!userRecord) {
                throw Errors.NOT_FOUND('User not found');
            }
            if (!userRecord.email) {
                throw Errors.INVALID_INPUT('User email not found');
            }

            // TODO: In a production environment, we should verify the current password
            // by attempting to sign in with it using the Firebase Client SDK.
            // For now, we're updating the password directly as this is a backend service.
            // Consider implementing a more secure password verification flow.

            // Update password in Firebase Auth
            await this.authService.updateUser(userId, {
                password: validatedData.newPassword,
            });

            // Update Firestore to track password change
            await this.firestoreWriter.updateUser(userId, {
                passwordChangedAt: createOptimisticTimestamp(),
            });

            logger.info('Password changed successfully');

            return {
                message: 'Password changed successfully',
            };
        } catch (error: unknown) {
            // Check if error is from Firebase Auth (user not found)
            if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found') {
                logger.error('User not found in Firebase Auth', error as unknown as Error);
                throw Errors.NOT_FOUND('User not found');
            }

            logger.error('Failed to change password', error as unknown as Error);
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
        LoggerContext.update({ userId, operation: 'delete-account' });

        // Validate the request body - ensures confirmDelete is true
        validateDeleteUser(requestBody);

        try {
            // Check if user has any groups or outstanding balances using scalable query
            // This is a simplified check - in production you'd want more thorough validation
            const userGroupIds = await this.getUserGroupsViaSubcollection(userId);

            if (userGroupIds.length > 0) {
                throw Errors.INVALID_INPUT('Cannot delete account while member of groups. Please leave all groups first.');
            }

            // Delete Firestore documents atomically in a transaction
            await this.firestoreWriter.runTransaction(async (transaction) => {
                // Delete user document
                this.firestoreWriter.deleteInTransaction(transaction, `users/${userId}`);
                
                // Delete user notification document
                this.firestoreWriter.deleteInTransaction(transaction, `user-notifications/${userId}`);
            }, {
                context: {
                    operation: 'delete-user-account',
                    userId,
                }
            });

            // Delete user from Firebase Auth (must be outside transaction)
            await this.authService.deleteUser(userId);

            logger.info('User account deleted successfully');

            return {
                message: 'Account deleted successfully',
            };
        } catch (error: unknown) {
            // Check if error is from Firebase Auth (user not found)
            if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found') {
                logger.error('User not found in Firebase Auth', error as unknown as Error);
                throw Errors.NOT_FOUND('User not found');
            }

            logger.error('Failed to delete user account', error as unknown as Error);
            throw error;
        }
    }

    async getUserGroupsViaSubcollection(userId: string): Promise<string[]> {
        // Use a high limit to maintain backward compatibility
        // This method is expected to return ALL groups for a user
        const paginatedGroups = await this.firestoreReader.getGroupsForUserV2(userId, { limit: 1000 });
        return paginatedGroups.data.map((group: any) => group.id);
    }

    async getGroupMembersResponseFromSubcollection(groupId: string): Promise<GroupMembersResponse> {
        const memberDocs = await this.firestoreReader.getAllGroupMembers(groupId);
        const memberIds = memberDocs.map((doc) => doc.userId);

        const memberProfiles = await this.getUsers(memberIds);

        const members: GroupMemberWithProfile[] = memberDocs.map((memberDoc: GroupMemberDocument): GroupMemberWithProfile => {
            const profile = memberProfiles.get(memberDoc.userId);

            if (!profile) {
                return {
                    uid: memberDoc.userId,
                    initials: '?',
                    email: '',
                    displayName: 'Unknown User',
                    themeColor: memberDoc.theme,
                    // Group membership metadata
                    joinedAt: memberDoc.joinedAt,
                    memberRole: memberDoc.memberRole,
                    invitedBy: memberDoc.invitedBy,
                    memberStatus: memberDoc.memberStatus,
                    lastPermissionChange: memberDoc.lastPermissionChange,
                };
            }

            return {
                uid: memberDoc.userId,
                initials: this.getInitials(profile.displayName),
                email: profile.email,
                displayName: profile.displayName,
                themeColor: (typeof profile.themeColor === 'object' ? profile.themeColor : memberDoc.theme) as UserThemeColor,
                preferredLanguage: profile.preferredLanguage,
                // Group membership metadata
                joinedAt: memberDoc.joinedAt,
                memberRole: memberDoc.memberRole,
                invitedBy: memberDoc.invitedBy,
                memberStatus: memberDoc.memberStatus,
                lastPermissionChange: memberDoc.lastPermissionChange,
            };
        });

        members.sort((a, b) => a.displayName.localeCompare(b.displayName));

        return {
            members,
            hasMore: false,
        };
    }

    private getInitials(nameOrEmail: string): string {
        const name = nameOrEmail || '';
        const parts = name.split(/[\s@]+/).filter(Boolean);

        if (parts.length === 0) return '?';
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    /**
     * Register a new user in the system
     * @param requestBody - The raw request body containing user registration data
     * @returns A RegisterUserResult with the newly created user information
     * @throws ApiError if registration fails
     */
    async registerUser(requestBody: UserRegistration): Promise<RegisterUserResult> {
        return measureDb('UserService2.registerUser', async () => this._registerUser(requestBody));
    }

    private async _registerUser(requestBody: UserRegistration): Promise<RegisterUserResult> {
        LoggerContext.update({ operation: 'register-user' });

        // Validate the request body
        const userRegistration = validateRegisterRequest(requestBody);

        const user = await this.createUserDirect(userRegistration);

        return {
            success: true,
            message: 'Account created successfully',
            user,
        };
    }

    async createUserDirect(userRegistration: UserRegistration): Promise<RegisteredUser> {
        let userRecord: UserRecord | null = null;

        try {
            // Create the user in Firebase Auth - extract only Firebase Auth fields
            userRecord = await this.authService.createUser({
                email: userRegistration.email,
                password: userRegistration.password,
                displayName: userRegistration.displayName,
            });

            // Add userId to context now that user is created
            LoggerContext.update({ userId: userRecord.uid });

            // Get current policy versions for user acceptance
            const currentPolicyVersions = await getCurrentPolicyVersions(this.firestoreReader);

            // Assign theme color for new user
            const themeColor = await assignThemeColor();

            // todo: acceptedPolicies should come from the ui

            // Create user document in Firestore
            const userDoc: FirestoreUserDocument = {
                email: userRegistration.email, // todo: this looks like a security issue
                displayName: userRegistration.displayName,
                role: SystemUserRoles.SYSTEM_USER, // Default role for new users
                createdAt: createOptimisticTimestamp(),
                updatedAt: createOptimisticTimestamp(),
                acceptedPolicies: currentPolicyVersions, // Capture current policy versions
                themeColor, // Add automatic theme color assignment
            };

            // Only set acceptance timestamps if the user actually accepted the terms
            if (userRegistration.termsAccepted) {
                userDoc.termsAcceptedAt = createOptimisticTimestamp();
            }
            if (userRegistration.cookiePolicyAccepted) {
                userDoc.cookiePolicyAcceptedAt = createOptimisticTimestamp();
            }

            // Validate user document before writing to Firestore
            try {
                const validationService = this.validationService;
                validationService.validateBeforeWrite(UserDataSchema, userDoc, 'UserData', {
                    documentId: userRecord.uid,
                    collection: 'users',
                    userId: userRecord.uid,
                    operation: 'registerUser',
                });
            } catch (error) {
                logger.error('User document validation failed during registration', error as Error, {
                    userId: userRecord.uid,
                });
                throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_USER_DATA', 'User document validation failed during registration');
            }

            await this.firestoreWriter.createUser(userRecord.uid, userDoc as any);

            // Initialize notification document for new user
            await this.notificationService.initializeUserNotifications(userRecord.uid);

            return {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
            } as RegisteredUser;
        } catch (error: unknown) {
            // If user was created but firestore failed, clean up the orphaned auth record
            if (userRecord) {
                try {
                    await this.authService.deleteUser(userRecord.uid);
                } catch (cleanupError) {
                    // Add cleanup failure context to the error
                    LoggerContext.update({ userId: userRecord.uid });
                    logger.error('Failed to cleanup orphaned auth user', cleanupError as Error);
                }
            }

            // Handle specific auth errors
            if (error && typeof error === 'object' && 'code' in error && error.code === AuthErrors.EMAIL_EXISTS) {
                throw new ApiError(HTTP_STATUS.CONFLICT, AuthErrors.EMAIL_EXISTS_CODE, 'An account with this email already exists');
            }

            // Re-throw the error for the handler to catch
            throw error;
        }
    }
}

// ServiceRegistry handles service instantiation
