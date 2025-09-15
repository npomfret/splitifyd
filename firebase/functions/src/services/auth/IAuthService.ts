/**
 * Auth Service Interface
 *
 * Centralized interface for all Firebase Auth operations across the application.
 * This interface provides type-safe, validated access to authentication operations with
 * consistent error handling and performance monitoring.
 *
 * Design Principles:
 * - All methods return validated, typed data
 * - Consistent null return for missing users
 * - Consistent error handling and logging
 * - Transaction-aware methods where needed
 * - Follows the same patterns as IFirestoreReader/Writer
 */

import type {
    UserRecord,
    UpdateRequest,
    CreateRequest,
    GetUsersResult,
    DecodedIdToken,
    ListUsersResult,
    DeleteUsersResult
} from 'firebase-admin/auth';

export interface IAuthService {
    // ========================================================================
    // User Management Operations
    // ========================================================================

    /**
     * Create a new user in Firebase Auth
     * @param userData - User creation data (email, password, displayName, etc.)
     * @returns UserRecord with generated UID
     * @throws ApiError if creation fails
     */
    createUser(userData: CreateRequest): Promise<UserRecord>;

    /**
     * Get a user by UID
     * @param uid - Firebase user UID
     * @returns UserRecord or null if not found
     * @throws ApiError if operation fails
     */
    getUser(uid: string): Promise<UserRecord | null>;

    /**
     * Get multiple users by UIDs (batch operation)
     * @param uids - Array of Firebase user UIDs (max 100)
     * @returns GetUsersResult with found/not found users
     * @throws ApiError if operation fails
     */
    getUsers(uids: { uid: string }[]): Promise<GetUsersResult>;

    /**
     * Update user profile in Firebase Auth
     * @param uid - Firebase user UID
     * @param updates - Profile updates (displayName, photoURL, etc.)
     * @returns Updated UserRecord
     * @throws ApiError if update fails or user not found
     */
    updateUser(uid: string, updates: UpdateRequest): Promise<UserRecord>;

    /**
     * Delete a user from Firebase Auth
     * @param uid - Firebase user UID
     * @returns Success confirmation
     * @throws ApiError if deletion fails or user not found
     */
    deleteUser(uid: string): Promise<void>;

    // ========================================================================
    // Token Operations
    // ========================================================================

    /**
     * Verify an ID token and return decoded claims
     * @param idToken - Firebase ID token from client
     * @returns Decoded token with user claims
     * @throws ApiError if token is invalid or expired
     */
    verifyIdToken(idToken: string): Promise<DecodedIdToken>;

    /**
     * Create a custom token for a user (for testing/admin use)
     * @param uid - Firebase user UID
     * @param additionalClaims - Optional custom claims
     * @returns Custom token string
     * @throws ApiError if token creation fails
     */
    createCustomToken(uid: string, additionalClaims?: object): Promise<string>;

    // ========================================================================
    // User Lookup Operations
    // ========================================================================

    /**
     * Get user by email address
     * @param email - User email address
     * @returns UserRecord or null if not found
     * @throws ApiError if operation fails
     */
    getUserByEmail(email: string): Promise<UserRecord | null>;

    /**
     * Get user by phone number
     * @param phoneNumber - User phone number
     * @returns UserRecord or null if not found
     * @throws ApiError if operation fails
     */
    getUserByPhoneNumber(phoneNumber: string): Promise<UserRecord | null>;

    // ========================================================================
    // Administrative Operations
    // ========================================================================

    /**
     * List users with pagination (for admin operations)
     * @param maxResults - Maximum number of users to return (default: 1000)
     * @param pageToken - Token for pagination
     * @returns ListUsersResult with users and pagination info
     * @throws ApiError if operation fails
     */
    listUsers(maxResults?: number, pageToken?: string): Promise<ListUsersResult>;

    /**
     * Delete multiple users in batch
     * @param uids - Array of user UIDs to delete (max 1000)
     * @returns DeleteUsersResult with success/failure counts
     * @throws ApiError if operation fails
     */
    deleteUsers(uids: string[]): Promise<DeleteUsersResult>;

    // ========================================================================
    // Utility Operations
    // ========================================================================

    /**
     * Generate a password reset link for a user
     * @param email - User email address
     * @returns Password reset link
     * @throws ApiError if operation fails
     */
    generatePasswordResetLink(email: string): Promise<string>;

    /**
     * Generate an email verification link for a user
     * @param email - User email address
     * @returns Email verification link
     * @throws ApiError if operation fails
     */
    generateEmailVerificationLink(email: string): Promise<string>;

    /**
     * Set custom user claims (for role-based access)
     * @param uid - Firebase user UID
     * @param customClaims - Custom claims object
     * @returns Success confirmation
     * @throws ApiError if operation fails
     */
    setCustomUserClaims(uid: string, customClaims: object): Promise<void>;

    /**
     * Revoke all refresh tokens for a user (force sign out)
     * @param uid - Firebase user UID
     * @returns Success confirmation
     * @throws ApiError if operation fails
     */
    revokeRefreshTokens(uid: string): Promise<void>;
}