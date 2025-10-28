import { RegisteredUser, SystemUserRoles, toISOString, UserProfileResponse, UserRegistration } from '@splitifyd/shared';
import { GroupMember, GroupMembershipDTO, GroupMembersResponse } from '@splitifyd/shared';
import { GroupId } from '@splitifyd/shared';
import { DisplayName } from '@splitifyd/shared';
import type { Email, UserId } from '@splitifyd/shared';
import { UpdateRequest, UserRecord } from 'firebase-admin/auth';
import { validateRegisterRequest } from '../auth/validation';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import { measureDb } from '../monitoring/measure';
import { validateChangeEmail, validateChangePassword, validateUpdateUserProfile } from '../user/validation';
import { ApiError, Errors } from '../utils/errors';
import { LoggerContext } from '../utils/logger-context';
import { withMinimumDuration } from '../utils/timing';
import type { IAuthService } from './auth';
import type { FirestoreUserCreateData, IFirestoreReader, IFirestoreWriter } from './firestore';
import { createPhantomGroupMember } from '../utils/groupMembershipHelpers';

const MIN_REGISTRATION_DURATION_MS = 600;
const REGISTRATION_FAILURE_ERROR_CODE = 'REGISTRATION_FAILED';
const REGISTRATION_FAILURE_MESSAGE = 'Unable to create account. If you already registered, try signing in.';

/**
 * Result of a successful user registration
 */
interface RegisterUserResult {
    success: boolean;
    message: string;
    user: {
        uid: string;
        displayName: DisplayName | undefined;
    };
}

/**
 * Service for fetching user profiles from Firebase Auth
 */
export class UserService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly authService: IAuthService,
    ) {}

    /**
     * Validates that a user record has all required fields
     * @throws Error if required fields are missing
     */
    private validateUserRecord(userRecord: UserRecord): asserts userRecord is UserRecord & { email: Email; displayName: DisplayName; } {
        if (!userRecord.email || !userRecord.displayName) {
            throw new Error(`User ${userRecord.uid} missing required fields: email and displayName are mandatory`);
        }
    }

    /**
     * Creates a RegisteredUser from Firebase Auth record and Firestore data
     */
    private createUserProfile(userRecord: UserRecord & { email: Email; displayName: DisplayName; }, firestoreData: any): RegisteredUser {
        return {
            uid: userRecord.uid,
            displayName: userRecord.displayName,
            email: userRecord.email,
            photoURL: userRecord.photoURL || null,
            emailVerified: userRecord.emailVerified,
            role: firestoreData?.role,
            termsAcceptedAt: firestoreData?.termsAcceptedAt,
            cookiePolicyAcceptedAt: firestoreData?.cookiePolicyAcceptedAt,
            acceptedPolicies: firestoreData?.acceptedPolicies,
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
    async getUser(userId: UserId): Promise<RegisteredUser> {
        return measureDb('UserService2.getUser', async () => this._getUser(userId));
    }

    private async _getUser(userId: UserId): Promise<RegisteredUser> {
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
            const firebaseError = error as { code?: string; };
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
    async getUsers(uids: UserId[]): Promise<Map<UserId, RegisteredUser>> {
        return measureDb('UserService2.getUsers', async () => this._getUsers(uids));
    }

    private async _getUsers(uids: UserId[]): Promise<Map<UserId, RegisteredUser>> {
        LoggerContext.update({ operation: 'batch-get-users', userCount: uids.length });

        const result = new Map<UserId, RegisteredUser>();

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
    private async fetchUserBatch(uids: UserId[], result: Map<UserId, RegisteredUser>): Promise<void> {
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

    async resolveGroupMemberProfile(
        groupId: GroupId,
        userId: UserId,
        options: { failureContext?: string } = {},
    ): Promise<GroupMember> {
        const failureContext = options.failureContext ?? 'group member resolution';

        const memberData = await this.firestoreReader.getGroupMember(groupId, userId);

        const userProfile = await this.getUser(userId).catch((error) => {
            if (error instanceof ApiError && error.code === 'NOT_FOUND') {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', `User ${userId} not found`);
            }

            logger.error(`Failed to resolve user profile during ${failureContext}`, error as Error, {
                userId,
                groupId,
            });
            throw error;
        });

        // displayName is guaranteed to exist because getUser() validates it
        const displayName = userProfile.displayName;
        const groupDisplayName = memberData?.groupDisplayName ?? displayName;

        if (!memberData) {
            return createPhantomGroupMember(userId, groupDisplayName);
        }

        const initials = groupDisplayName
            .split(' ')
            .filter(Boolean)
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

        return {
            uid: userId,
            initials,
            themeColor: memberData.theme,
            memberRole: memberData.memberRole,
            memberStatus: memberData.memberStatus,
            joinedAt: memberData.joinedAt,
            invitedBy: memberData.invitedBy,
            groupDisplayName,
        };
    }

    /**
     * Update a user's profile
     * @param userId - The Firebase UID of the user
     * @param requestBody - The raw request body containing profile update data
     * @param language - The user's preferred language for validation messages
     * @returns The updated user profile
     * @throws ApiError if update fails
     */
    async getProfile(userId: UserId): Promise<UserProfileResponse> {
        return measureDb('UserService2.getProfile', async () => this._getProfile(userId));
    }

    async updateProfile(userId: UserId, requestBody: unknown, language: string = 'en'): Promise<UserProfileResponse> {
        return measureDb('UserService2.updateProfile', async () => this._updateProfile(userId, requestBody, language));
    }

    private async _getProfile(userId: UserId): Promise<UserProfileResponse> {
        const registeredUser = await this.getUser(userId);
        return {
            displayName: registeredUser.displayName,
            role: registeredUser.role ?? SystemUserRoles.SYSTEM_USER,
            email: registeredUser.email,
            emailVerified: registeredUser.emailVerified,
        };
    }

    private async _updateProfile(userId: UserId, requestBody: unknown, language: string = 'en'): Promise<UserProfileResponse> {
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
            if (validatedData.preferredLanguage !== undefined) {
                firestoreUpdate.preferredLanguage = validatedData.preferredLanguage;
            }

            // Update Firestore user document
            // FirestoreWriter handles: ISO→Timestamp conversion, updatedAt injection, and validation
            if (Object.keys(firestoreUpdate).length > 0) {
                await this.firestoreWriter.updateUser(userId, firestoreUpdate);
            }

            // Return the updated profile
            return this._getProfile(userId);
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
    async changePassword(userId: UserId, requestBody: unknown): Promise<{ message: string; }> {
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
                passwordChangedAt: toISOString(new Date().toISOString()),
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
     * Change a user's email address
     * @param userId - Firebase UID of the user
     * @param requestBody - Raw request payload containing current password and new email
     * @returns Updated user profile
     */
    async changeEmail(userId: UserId, requestBody: unknown): Promise<UserProfileResponse> {
        LoggerContext.update({ userId, operation: 'change-email' });

        const validatedData = validateChangeEmail(requestBody);

        try {
            const userRecord = await this.authService.getUser(userId);
            if (!userRecord || !userRecord.email) {
                throw Errors.NOT_FOUND('User not found');
            }

            if (userRecord.email.toLowerCase() === validatedData.newEmail.toLowerCase()) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'EMAIL_UNCHANGED', 'New email must be different from current email');
            }

            const isCurrentPasswordValid = await this.authService.verifyPassword(userRecord.email, validatedData.currentPassword);
            if (!isCurrentPasswordValid) {
                throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'INVALID_PASSWORD', 'Current password is incorrect');
            }

            await this.authService.updateUser(userId, {
                email: validatedData.newEmail,
                emailVerified: false,
            });

            await this.firestoreWriter.updateUser(userId, {
                email: validatedData.newEmail,
            });

            logger.info('Email changed successfully');

            return this._getProfile(userId);
        } catch (error: unknown) {
            if (error instanceof ApiError) {
                throw error;
            }

            const firebaseCode = this.extractErrorCode(error);
            if (firebaseCode && this.isSensitiveRegistrationErrorCode(firebaseCode)) {
                throw new ApiError(HTTP_STATUS.CONFLICT, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
            }

            if (error && typeof error === 'object' && 'code' in error && (error as { code?: string; }).code === 'auth/user-not-found') {
                const err = error instanceof Error ? error : new Error(String(error));
                logger.error('User not found in Firebase Auth during email change', err);
                throw Errors.NOT_FOUND('User not found');
            }

            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('Failed to change user email', err);
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'EMAIL_CHANGE_FAILED', 'Failed to change email');
        }
    }

    async getGroupMembersResponseFromSubcollection(groupId: GroupId): Promise<GroupMembersResponse> {
        const memberDocs = await this.firestoreReader.getAllGroupMembers(groupId);
        const memberIds = memberDocs.map((doc) => doc.uid);

        const memberProfiles = await this.getUsers(memberIds);

        const members: GroupMember[] = memberDocs.map((memberDoc: GroupMembershipDTO): GroupMember => {
            const profile = memberProfiles.get(memberDoc.uid);
            const fallbackName = memberDoc.groupDisplayName || profile?.displayName || 'Unknown User';

            if (!profile) {
                return {
                    uid: memberDoc.uid,
                    initials: this.getInitials(fallbackName),
                    themeColor: memberDoc.theme,
                    // Group membership metadata
                    joinedAt: memberDoc.joinedAt, // Already ISO string from DTO
                    memberRole: memberDoc.memberRole,
                    invitedBy: memberDoc.invitedBy,
                    memberStatus: memberDoc.memberStatus,
                    groupDisplayName: fallbackName,
                };
            }

            return {
                uid: memberDoc.uid,
                initials: this.getInitials(fallbackName),
                themeColor: memberDoc.theme,
                // Group membership metadata (required for permissions)
                joinedAt: memberDoc.joinedAt, // Already ISO string from DTO
                memberRole: memberDoc.memberRole,
                invitedBy: memberDoc.invitedBy,
                memberStatus: memberDoc.memberStatus,
                groupDisplayName: fallbackName,
            };
        });

        members.sort((a, b) => a.groupDisplayName.localeCompare(b.groupDisplayName));

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
        return withMinimumDuration(
            MIN_REGISTRATION_DURATION_MS,
            () => measureDb('UserService2.registerUser', async () => this._registerUser(requestBody)),
        );
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

            // todo: acceptedPolicies should come from the ui

            // Create user document in Firestore (only fields that belong in the document)
            // Note: uid is the document ID, not a field. emailVerified is managed by Firebase Auth.
            const now = toISOString(new Date().toISOString());
            const userDoc: FirestoreUserCreateData = {
                email: userRegistration.email,
                role: SystemUserRoles.SYSTEM_USER, // Default role for new users
                createdAt: now,
                updatedAt: now,
                acceptedPolicies: currentPolicyVersions, // Capture current policy versions
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

            return {
                uid: userRecord.uid,
                displayName: userRecord.displayName ?? userRegistration.displayName,
                email: (userRecord.email ?? userRegistration.email) as Email,
                emailVerified: userRecord.emailVerified ?? false,
                photoURL: userRecord.photoURL ?? null,
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

            throw this.toGenericRegistrationError(error);
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

    private toGenericRegistrationError(error: unknown): ApiError {
        const code = this.extractErrorCode(error);

        if (code && this.isSensitiveRegistrationErrorCode(code)) {
            logger.warn('Registration failed due to sensitive auth error', { code });
            return new ApiError(HTTP_STATUS.BAD_REQUEST, REGISTRATION_FAILURE_ERROR_CODE, REGISTRATION_FAILURE_MESSAGE);
        }

        if (error instanceof ApiError) {
            return error;
        }

        logger.error('Unexpected error during user registration', error as Error);
        return new ApiError(HTTP_STATUS.INTERNAL_ERROR, REGISTRATION_FAILURE_ERROR_CODE, REGISTRATION_FAILURE_MESSAGE);
    }

    private extractErrorCode(error: unknown): string | null {
        if (!error || typeof error !== 'object') {
            return null;
        }

        const maybeCode = (error as { code?: unknown; }).code;
        return typeof maybeCode === 'string' ? maybeCode : null;
    }

    private isSensitiveRegistrationErrorCode(code: string): boolean {
        return code === 'AUTH_EMAIL_ALREADY_EXISTS' || code === 'EMAIL_ALREADY_EXISTS' || code === 'auth/email-already-exists';
    }
}

// ServiceRegistry handles service instantiation
