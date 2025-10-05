import { UpdateRequest, UserRecord } from 'firebase-admin/auth';
import { AuthErrors, RegisteredUser, SystemUserRoles, UserRegistration, UserThemeColor } from '@splitifyd/shared';
import { logger } from '../logger';
import { LoggerContext } from '../utils/logger-context';
import { ApiError, Errors } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { assignThemeColor } from '../user-management/assign-theme-color';
import { validateRegisterRequest } from '../auth/validation';
import { validateChangePassword, validateDeleteUser, validateUpdateUserProfile } from '../user/validation';
import { measureDb } from '../monitoring/measure';
import { FirestoreValidationService } from './FirestoreValidationService';
import { NotificationService } from './notification-service';
import type { IFirestoreReader, IFirestoreWriter } from './firestore';
import type { IAuthService } from './auth';
import { GroupMembersResponse, GroupMember, GroupMembershipDTO } from '@splitifyd/shared/src';
// GroupMemberDocument removed - use GroupMembershipDTO from @splitifyd/shared instead

/**
 * Result of a successful user registration
 */
interface RegisterUserResult {
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
    createdAt: string;
    updatedAt: string;
    acceptedPolicies: Record<string, string>;
    themeColor: UserThemeColor;
    termsAcceptedAt?: string;
    cookiePolicyAcceptedAt?: string;
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
     * Creates a RegisteredUser from Firebase Auth record and Firestore data
     */
    private createUserProfile(userRecord: UserRecord & { email: string; displayName: string }, firestoreData: any): RegisteredUser {
        return {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            photoURL: userRecord.photoURL || null,
            emailVerified: userRecord.emailVerified,
            role: firestoreData?.role,
            termsAcceptedAt: firestoreData?.termsAcceptedAt,
            cookiePolicyAcceptedAt: firestoreData?.cookiePolicyAcceptedAt,
            acceptedPolicies: firestoreData?.acceptedPolicies,
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
    async getUser(userId: string): Promise<RegisteredUser> {
        return measureDb('UserService2.getUser', async () => this._getUser(userId));
    }

    private async _getUser(userId: string): Promise<RegisteredUser> {
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
            const firebaseError = error as { code?: string };
            if (firebaseError.code === 'auth/user-not-found') {
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
    async getUsers(uids: string[]): Promise<Map<string, RegisteredUser>> {
        return measureDb('UserService2.getUsers', async () => this._getUsers(uids));
    }

    private async _getUsers(uids: string[]): Promise<Map<string, RegisteredUser>> {
        LoggerContext.update({ operation: 'batch-get-users', userCount: uids.length });

        const result = new Map<string, RegisteredUser>();

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
    private async fetchUserBatch(uids: string[], result: Map<string, RegisteredUser>): Promise<void> {
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
    async updateProfile(userId: string, requestBody: unknown, language: string = 'en'): Promise<RegisteredUser> {
        return measureDb('UserService2.updateProfile', async () => this._updateProfile(userId, requestBody, language));
    }

    private async _updateProfile(userId: string, requestBody: unknown, language: string = 'en'): Promise<RegisteredUser> {
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
            // Note: updatedAt is added automatically by FirestoreWriter
            const firestoreUpdate: any = {};
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
            // FirestoreWriter handles: ISO→Timestamp conversion, updatedAt injection, and validation
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

            // Verify current password
            const isCurrentPasswordValid = await this.authService.verifyPassword(userRecord.email, validatedData.currentPassword);
            if (!isCurrentPasswordValid) {
                throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'INVALID_PASSWORD', 'Current password is incorrect');
            }

            // Update password in Firebase Auth
            await this.authService.updateUser(userId, {
                password: validatedData.newPassword,
            });

            // Update Firestore to track password change
            await this.firestoreWriter.updateUser(userId, {
                passwordChangedAt: new Date().toISOString(),
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

    async getUserGroupsViaSubcollection(userId: string): Promise<string[]> {
        // Use a high limit to maintain backward compatibility
        // This method is expected to return ALL groups for a user
        const paginatedGroups = await this.firestoreReader.getGroupsForUserV2(userId, { limit: 1000 });
        return paginatedGroups.data.map((group: any) => group.id);
    }

    async getGroupMembersResponseFromSubcollection(groupId: string): Promise<GroupMembersResponse> {
        const memberDocs = await this.firestoreReader.getAllGroupMembers(groupId);
        const memberIds = memberDocs.map((doc) => doc.uid);

        const memberProfiles = await this.getUsers(memberIds);

        const members: GroupMember[] = memberDocs.map((memberDoc: GroupMembershipDTO): GroupMember => {
            const profile = memberProfiles.get(memberDoc.uid);

            if (!profile) {
                return {
                    uid: memberDoc.uid,
                    initials: '?',
                    email: '',
                    displayName: 'Unknown User',
                    photoURL: null,
                    themeColor: memberDoc.theme,
                    // Group membership metadata
                    joinedAt: memberDoc.joinedAt, // Already ISO string from DTO
                    memberRole: memberDoc.memberRole,
                    invitedBy: memberDoc.invitedBy,
                    memberStatus: memberDoc.memberStatus,
                };
            }

            return {
                uid: memberDoc.uid,
                initials: this.getInitials(profile.displayName),
                email: profile.email,
                displayName: profile.displayName,
                photoURL: profile.photoURL,
                themeColor: (typeof profile.themeColor === 'object' ? profile.themeColor : memberDoc.theme) as UserThemeColor,
                // Group membership metadata (required for permissions)
                joinedAt: memberDoc.joinedAt, // Already ISO string from DTO
                memberRole: memberDoc.memberRole,
                invitedBy: memberDoc.invitedBy,
                memberStatus: memberDoc.memberStatus,
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
            const currentPolicyVersions = await this.getCurrentPolicyVersions();

            // Assign theme color for new user
            const themeColor = await assignThemeColor();

            // todo: acceptedPolicies should come from the ui

            // Create user document in Firestore (only fields that belong in the document)
            // Note: uid is the document ID, not a field. emailVerified is managed by Firebase Auth.
            const now = new Date().toISOString();
            const userDoc: Omit<RegisteredUser, 'id' | 'uid' | 'emailVerified'> = {
                email: userRegistration.email, // todo: this looks like a security issue
                displayName: userRegistration.displayName,
                photoURL: userRecord.photoURL,
                role: SystemUserRoles.SYSTEM_USER, // Default role for new users
                createdAt: now,
                updatedAt: now,
                acceptedPolicies: currentPolicyVersions, // Capture current policy versions
                themeColor: {
                    ...themeColor,
                    assignedAt: now, // Ensure assignedAt is ISO string, not Timestamp
                },
            };

            // Only set acceptance timestamps if the user actually accepted the terms
            if (userRegistration.termsAccepted) {
                userDoc.termsAcceptedAt = now;
            }
            if (userRegistration.cookiePolicyAccepted) {
                userDoc.cookiePolicyAcceptedAt = now;
            }

            // FirestoreWriter handles validation and conversion to Firestore format
            await this.firestoreWriter.createUser(userRecord.uid, userDoc);

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

    private async getCurrentPolicyVersions(): Promise<Record<string, string>> {
        try {
            const policies = await this.firestoreReader.getAllPolicies();

            const acceptedPolicies: Record<string, string> = {};

            policies.forEach((policy) => {
                if (policy.currentVersionHash) {
                    acceptedPolicies[policy.id] = policy.currentVersionHash;
                }
            });

            return acceptedPolicies;
        } catch (error) {
            logger.error('Failed to get current policy versions', error);
            // Registration must fail if policies cannot be retrieved - compliance requirement
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_SERVICE_UNAVAILABLE', 'Registration temporarily unavailable - unable to retrieve policy versions');
        }
    }

}

// ServiceRegistry handles service instantiation
