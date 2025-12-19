import { ClientUser, SystemUserRoles, toISOString, UserProfile, UserProfileResponse, UserRegistration } from '@billsplit-wl/shared';
import { GroupMember, GroupMembershipDTO, GroupMembersResponse } from '@billsplit-wl/shared';
import { GroupId } from '@billsplit-wl/shared';
import { DisplayName } from '@billsplit-wl/shared';
import type { Email, UserId } from '@billsplit-wl/shared';
import { normalizeDisplayNameForComparison } from '@billsplit-wl/shared';
import { toDisplayName } from '@billsplit-wl/shared';
import { toEmail, toUserId } from '@billsplit-wl/shared';
import { UpdateRequest, UserRecord } from 'firebase-admin/auth';
import { validateRegisterRequest } from '../auth/validation';
import { ApiError, ErrorDetail, Errors } from '../errors';
import { logger } from '../logger';
import { measureDb } from '../monitoring/measure';
import type { UserDocument } from '../schemas';
import { validateChangeEmail, validateChangePassword, validateUpdateUserProfile } from '../user/validation';
import { createPhantomGroupMember } from '../utils/groupMembershipHelpers';
import { LoggerContext } from '../utils/logger-context';
import { withMinimumDuration } from '../utils/timing';
import type { IAuthService } from './auth';
import type { FirestoreUserCreateData, IFirestoreReader, IFirestoreWriter } from './firestore';

const REGISTRATION_FAILURE_MESSAGE = 'Unable to create account. If you already registered, try signing in.';

/**
 * Result of a successful user registration
 */
export interface RegisterUserResult {
    success: boolean;
    message: string;
    user: {
        uid: UserId;
        displayName: DisplayName;
    };
}

/**
 * Result of validating an email change request.
 * Contains the information needed to send a verification email.
 */
export interface ValidatedEmailChange {
    currentEmail: Email;
    newEmail: Email;
    displayName: string;
}

/**
 * Service for fetching user profiles from Firebase Auth
 */
export class UserService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly authService: IAuthService,
        private readonly minRegistrationDurationMs: number,
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
     * Creates a ClientUser from Firebase Auth record and Firestore data
     * Returns minimal client-facing profile suitable for regular API endpoints
     */
    private createUserProfile(userRecord: UserRecord & { email: Email; displayName: DisplayName; }, firestoreData: UserDocument): ClientUser {
        return {
            uid: toUserId(userRecord.uid),
            displayName: userRecord.displayName,
            email: userRecord.email,
            photoURL: userRecord.photoURL || null,
            emailVerified: userRecord.emailVerified,
            role: firestoreData.role,
            preferredLanguage: firestoreData.preferredLanguage,
        };
    }

    /**
     * Get a single user's profile by their ID
     * Returns minimal client-facing profile suitable for regular API endpoints
     * @param userId - The Firebase UID of the user
     * @returns The user's profile data as ClientUser
     * @throws If user is not found or an error occurs
     */
    async getUser(userId: UserId): Promise<ClientUser> {
        return measureDb('UserService2.getUser', async () => this._getUser(userId));
    }

    private async _getUser(userId: UserId): Promise<ClientUser> {
        LoggerContext.update({ userId });

        try {
            // Get user from Firebase Auth
            const userRecord = await this.authService.getUser(userId);

            // Check if user exists
            if (!userRecord) {
                logger.error('User not found in Firebase Auth', new Error(`User ${userId} not found`));
                throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
            }

            // Ensure required fields are present
            this.validateUserRecord(userRecord);

            // Get additional user data from Firestore via reader
            const userData = await this.firestoreReader.getUser(userId);

            // User MUST exist in both Auth and Firestore - data consistency check
            if (!userData) {
                logger.error('Data consistency error: user exists in Auth but missing Firestore document', new Error(`User ${userId} has no Firestore document`));
                throw Errors.serviceError(ErrorDetail.DATABASE_ERROR);
            }

            const profile = this.createUserProfile(userRecord, userData);

            return profile;
        } catch (error) {
            // Check if error is from Firebase Auth (user not found)
            const firebaseError = error as { code?: string; };
            if (firebaseError.code === 'auth/user-not-found') {
                logger.error('User not found in Firebase Auth', error as Error);
                throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
            }

            logger.error('Failed to get user profile', error as Error);
            throw error;
        }
    }

    /**
     * Get complete user profile with all Firestore fields for internal server use
     * This includes createdAt, updatedAt, acceptedPolicies, etc.
     * Use this for backend business logic that needs full user data.
     *
     * @param userId - The Firebase UID of the user
     * @returns The complete user profile as UserProfile
     * @throws If user is not found or an error occurs
     * @see getUser for client-facing minimal profile (ClientUser)
     */
    async getUserProfile(userId: UserId): Promise<UserProfile> {
        return measureDb('UserService2.getUserProfile', async () => this._getUserProfile(userId));
    }

    private async _getUserProfile(userId: UserId): Promise<UserProfile> {
        LoggerContext.update({ userId });

        try {
            // Get user from Firebase Auth
            const userRecord = await this.authService.getUser(userId);

            // Check if user exists
            if (!userRecord) {
                logger.error('User not found in Firebase Auth', new Error(`User ${userId} not found`));
                throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
            }

            // Ensure required fields are present
            this.validateUserRecord(userRecord);

            // Get additional user data from Firestore via reader
            const userData = await this.firestoreReader.getUser(userId);

            // User MUST exist in both Auth and Firestore - data consistency check
            if (!userData) {
                logger.error('Data consistency error: user exists in Auth but missing Firestore document', new Error(`User ${userId} has no Firestore document`));
                throw Errors.serviceError(ErrorDetail.DATABASE_ERROR);
            }

            // Return complete UserProfile with all fields
            return {
                uid: toUserId(userRecord.uid),
                displayName: userRecord.displayName,
                email: userRecord.email,
                photoURL: userRecord.photoURL || null,
                emailVerified: userRecord.emailVerified,
                role: userData.role,
                createdAt: userData.createdAt,
                updatedAt: userData.updatedAt,
                preferredLanguage: userData.preferredLanguage,
                acceptedPolicies: userData.acceptedPolicies,
            };
        } catch (error) {
            // Check if error is from Firebase Auth (user not found)
            const firebaseError = error as { code?: string; };
            if (firebaseError.code === 'auth/user-not-found') {
                logger.error('User not found in Firebase Auth', error as Error);
                throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
            }

            logger.error('Failed to get complete user profile', error as Error);
            throw error;
        }
    }

    /**
     * Efficiently resolve multiple group member profiles in a single batch operation
     * @param groupId The group ID
     * @param userIds Array of user IDs to resolve
     * @returns Array of GroupMember profiles (in same order as userIds)
     */
    async resolveGroupMemberProfiles(groupId: GroupId, userIds: UserId[]): Promise<GroupMember[]> {
        if (userIds.length === 0) {
            return [];
        }

        // Batch fetch all members in a single database call
        const memberDataMap = await this.firestoreReader.getGroupMembers(groupId, userIds);

        // Map userIds to profiles, maintaining order and handling missing members
        return userIds.map((userId) => {
            const memberData = memberDataMap.get(userId);

            // If member not found (e.g., user left the group), create phantom member
            if (!memberData) {
                return createPhantomGroupMember(userId, toDisplayName(userId));
            }

            // Extract initials from display name
            const initials = memberData
                .groupDisplayName
                .split(' ')
                .filter(Boolean)
                .map((n: string) => n[0])
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
                groupDisplayName: memberData.groupDisplayName,
            };
        });
    }

    async resolveGroupMemberProfile(groupId: GroupId, userId: UserId): Promise<GroupMember> {
        const memberData = await this.firestoreReader.getGroupMember(groupId, userId);

        if (!memberData) { // when does this happen? maybe when a user has left the group
            return createPhantomGroupMember(userId, toDisplayName(userId));
        }

        const initials = memberData!
            .groupDisplayName
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
            groupDisplayName: memberData!.groupDisplayName,
        };
    }

    /**
     * Check if a display name conflicts with existing group members.
     * Uses base58 normalization to detect confusable characters (0/O, I/l, etc.).
     * The original display name is stored as-is; normalization is only for comparison.
     *
     * @param groupId - The group to check
     * @param displayName - The display name to check
     * @returns Object containing existing members and conflict status
     *
     * @example
     * // These would all be considered conflicts:
     * checkDisplayNameConflict(groupId, "Alice") // conflicts with existing "Alice"
     * checkDisplayNameConflict(groupId, "Al1ce") // conflicts with existing "Alice" (1 → i)
     * checkDisplayNameConflict(groupId, "ALICE") // conflicts with existing "Alice" (case-insensitive)
     * checkDisplayNameConflict(groupId, "B0b")   // conflicts with existing "Bob" (0 → o)
     */
    async checkDisplayNameConflict(
        groupId: GroupId,
        displayName: DisplayName,
    ): Promise<{
        existingMembers: GroupMembershipDTO[];
        displayNameConflict: boolean;
    }> {
        const existingMembers = await this.firestoreReader.getAllGroupMembers(groupId);
        const normalizedNewName = normalizeDisplayNameForComparison(displayName.trim());

        const displayNameConflict = existingMembers.some((member) => {
            const normalizedExistingName = normalizeDisplayNameForComparison(member.groupDisplayName.trim());
            return normalizedExistingName === normalizedNewName;
        });

        return {
            existingMembers,
            displayNameConflict,
        };
    }

    /**
     * Update a user's profile
     * @param userId - The Firebase UID of the user
     * @param requestBody - The raw request body containing profile update data
     * @returns The updated user profile
     * @throws ApiError if update fails
     */
    async getProfile(userId: UserId): Promise<UserProfileResponse> {
        return measureDb('UserService2.getProfile', async () => this._getProfile(userId));
    }

    async updateProfile(userId: UserId, requestBody: unknown): Promise<void> {
        await measureDb('UserService2.updateProfile', async () => this._updateProfile(userId, requestBody));
    }

    private async _getProfile(userId: UserId): Promise<UserProfileResponse> {
        const registeredUser = await this.getUser(userId);
        return {
            displayName: registeredUser.displayName,
            role: registeredUser.role ?? SystemUserRoles.SYSTEM_USER,
            email: registeredUser.email,
            emailVerified: registeredUser.emailVerified,
            preferredLanguage: registeredUser.preferredLanguage,
        };
    }

    private async _updateProfile(userId: UserId, requestBody: unknown): Promise<UserProfileResponse> {
        LoggerContext.update({ userId, operation: 'update-profile' });

        const validatedData = validateUpdateUserProfile(requestBody);

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
                throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
            }

            logger.error('Failed to update user profile', error as unknown as Error);
            throw error;
        }
    }

    /**
     * Change a user's password
     * @param userId - The Firebase UID of the user
     * @param requestBody - The raw request body containing password change data
     * @throws ApiError if password change fails
     */
    async changePassword(userId: UserId, requestBody: unknown): Promise<void> {
        LoggerContext.update({ userId, operation: 'change-password' });

        // Validate the request body
        const validatedData = validateChangePassword(requestBody);

        try {
            // Get user to ensure they exist
            const userRecord = await this.authService.getUser(userId);
            if (!userRecord) {
                throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
            }
            if (!userRecord.email) {
                throw Errors.invalidRequest('User email not found');
            }

            // Verify current password
            const isCurrentPasswordValid = await this.authService.verifyPassword(toEmail(userRecord.email), validatedData.currentPassword);
            if (!isCurrentPasswordValid) {
                throw Errors.authInvalid(ErrorDetail.INVALID_PASSWORD);
            }

            // Update password in Firebase Auth
            await this.authService.updateUser(userId, {
                password: validatedData.newPassword,
            });

            logger.info('Password changed successfully');
        } catch (error: unknown) {
            // Check if error is from Firebase Auth (user not found)
            if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found') {
                logger.error('User not found in Firebase Auth', error as unknown as Error);
                throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
            }

            logger.error('Failed to change password', error as unknown as Error);
            throw error;
        }
    }

    /**
     * Validates email change request and returns info needed to send verification email.
     * Does NOT actually change the email - that happens when the user clicks the verification link.
     * @param userId - Firebase UID of the user
     * @param requestBody - Raw request payload containing current password and new email
     * @returns Validated email change data including current email, new email, and display name
     */
    async validateEmailChange(userId: UserId, requestBody: unknown): Promise<ValidatedEmailChange> {
        LoggerContext.update({ userId, operation: 'validate-email-change' });

        const validatedData = validateChangeEmail(requestBody);

        try {
            const userRecord = await this.authService.getUser(userId);
            if (!userRecord || !userRecord.email) {
                throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
            }

            if (userRecord.email.toLowerCase() === validatedData.newEmail.toLowerCase()) {
                throw Errors.invalidRequest('New email must be different from current email');
            }

            const isCurrentPasswordValid = await this.authService.verifyPassword(toEmail(userRecord.email), validatedData.currentPassword);
            if (!isCurrentPasswordValid) {
                throw Errors.authInvalid(ErrorDetail.INVALID_PASSWORD);
            }

            return {
                currentEmail: toEmail(userRecord.email),
                newEmail: toEmail(validatedData.newEmail),
                displayName: userRecord.displayName ?? 'User',
            };
        } catch (error: unknown) {
            if (error instanceof ApiError) {
                throw error;
            }

            if (error && typeof error === 'object' && 'code' in error && (error as { code?: string; }).code === 'auth/user-not-found') {
                const err = error instanceof Error ? error : new Error(String(error));
                logger.error('User not found in Firebase Auth during email change validation', err);
                throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
            }

            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('Failed to validate email change', err);
            throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
        }
    }

    async getGroupMembersResponseFromSubcollection(groupId: GroupId): Promise<GroupMembersResponse> {
        const memberDocs = await this.firestoreReader.getAllGroupMembers(groupId);

        const members: GroupMember[] = memberDocs.map((memberDoc: GroupMembershipDTO): GroupMember => {
            return {
                uid: memberDoc.uid,
                initials: this.getInitials(memberDoc.groupDisplayName),
                themeColor: memberDoc.theme,
                // Group membership metadata (required for permissions)
                joinedAt: memberDoc.joinedAt, // Already ISO string from DTO
                memberRole: memberDoc.memberRole,
                invitedBy: memberDoc.invitedBy,
                memberStatus: memberDoc.memberStatus,
                groupDisplayName: memberDoc.groupDisplayName,
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
            this.minRegistrationDurationMs,
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

    async createUserDirect(userRegistration: UserRegistration): Promise<ClientUser> {
        let userRecord: UserRecord | null = null;

        try {
            // Create the user in Firebase Auth - extract only Firebase Auth fields
            userRecord = await this.authService.createUser({
                email: userRegistration.email,
                password: userRegistration.password,
                displayName: userRegistration.displayName,
            });

            // Add userId to context now that user is created
            LoggerContext.update({ userId: userRecord.uid.toString() });

            // Get current policy versions for user acceptance
            const currentPolicyVersions = await this.getCurrentPolicyVersions();

            // todo: acceptedPolicies should come from the ui

            // Create user document in Firestore (only fields that belong in the document)
            // Note: uid is the document ID, not a field. emailVerified is managed by Firebase Auth.
            const now = toISOString(new Date().toISOString());
            const userDoc: FirestoreUserCreateData = {
                role: SystemUserRoles.SYSTEM_USER, // Default role for new users
                createdAt: now,
                updatedAt: now,
                acceptedPolicies: currentPolicyVersions, // Capture current policy versions
            };

            // FirestoreWriter handles validation and conversion to Firestore format
            await this.firestoreWriter.createUser(toUserId(userRecord.uid), userDoc);

            // Initialize notification document for new user

            return {
                uid: toUserId(userRecord.uid),
                displayName: userRecord.displayName ?? userRegistration.displayName,
                email: (userRecord.email ?? userRegistration.email) as Email,
                emailVerified: userRecord.emailVerified ?? false,
                photoURL: userRecord.photoURL ?? null,
                role: SystemUserRoles.SYSTEM_USER,
            } as ClientUser;
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

    private async getCurrentPolicyVersions(): Promise<Record<string, Record<string, string>>> {
        try {
            const policies = await this.firestoreReader.getAllPolicies();
            const now = toISOString(new Date().toISOString());

            const acceptedPolicies: Record<string, Record<string, string>> = {};

            policies.forEach((policy) => {
                if (policy.currentVersionHash) {
                    acceptedPolicies[policy.id] = { [policy.currentVersionHash]: now };
                }
            });

            // Allow registration when no policies exist (bootstrap scenario)
            // The admin user needs to be created before policies can be seeded via API
            return acceptedPolicies;
        } catch (error) {
            logger.error('Failed to get current policy versions', error);
            // Registration must fail if policies cannot be retrieved - compliance requirement
            throw Errors.unavailable(ErrorDetail.POLICY_SERVICE_ERROR);
        }
    }

    private toGenericRegistrationError(error: unknown): ApiError {
        const code = this.extractErrorCode(error);

        if (code && this.isSensitiveRegistrationErrorCode(code)) {
            logger.warn('Registration failed due to sensitive auth error', { code });
            return Errors.invalidRequest(REGISTRATION_FAILURE_MESSAGE);
        }

        if (error instanceof ApiError) {
            return error;
        }

        logger.error('Unexpected error during user registration', error as Error);
        return Errors.serviceError(REGISTRATION_FAILURE_MESSAGE);
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
