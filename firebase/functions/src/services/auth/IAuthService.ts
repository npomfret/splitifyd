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

import type { Email, UserId } from '@billsplit-wl/shared';
import type { CreateRequest, DecodedIdToken, UpdateRequest, UserRecord } from 'firebase-admin/auth';

export interface PasswordResetEmailContext {
    /**
     * Public base URL for the tenant domain (scheme + host, optional port).
     * Example: https://demo.sidebadger.me or http://localhost:5002
     */
    baseUrl: string;
    /**
     * Tenant app name for email copy.
     */
    appName: string;
    /**
     * Support email for the tenant (also used as sender for now).
     */
    supportEmail: Email;
}

export interface WelcomeEmailContext {
    /**
     * Public base URL for the tenant domain (scheme + host, optional port).
     * Example: https://demo.sidebadger.me or http://localhost:5002
     */
    baseUrl: string;
    /**
     * Tenant app name for email copy.
     */
    appName: string;
    /**
     * Support email for the tenant.
     */
    supportEmail: Email;
    /**
     * User's display name for personalization.
     */
    displayName: string;
}

export interface EmailVerificationEmailContext {
    /**
     * Public base URL for the tenant domain (scheme + host, optional port).
     * Example: https://demo.sidebadger.me or http://localhost:5002
     */
    baseUrl: string;
    /**
     * Tenant app name for email copy.
     */
    appName: string;
    /**
     * Support email for the tenant.
     */
    supportEmail: Email;
    /**
     * User's display name for personalization.
     */
    displayName: string;
}

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
    getUser(uid: UserId): Promise<UserRecord | null>;

    /**
     * Get a user by email
     * @param email - Firebase user email address
     * @returns UserRecord or null if not found
     * @throws ApiError if operation fails
     */
    getUserByEmail(email: Email): Promise<UserRecord | null>;

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
    // Utility Operations
    // ========================================================================

    /**
     * Verify a user's password
     * @param email - User email address
     * @param password - Password to verify
     * @returns True if password is correct, false otherwise
     * @throws ApiError if user not found or operation fails
     */
    verifyPassword(email: Email, password: string): Promise<boolean>;

    /**
     * Send a password reset email to a user
     * @param email - User email address
     * @param context - Tenant-aware email context (domain, app name, support email)
     * @returns Promise that resolves when email is sent (or silently succeeds for non-existent emails)
     * @throws ApiError if operation fails (excluding non-existent emails)
     */
    sendPasswordResetEmail(email: Email, context: PasswordResetEmailContext): Promise<void>;

    /**
     * Send a welcome email to a newly registered user
     * @param email - User email address
     * @param context - Tenant-aware email context (domain, app name, support email, display name)
     * @returns Promise that resolves when email is sent
     * @throws ApiError if operation fails
     */
    sendWelcomeEmail(email: Email, context: WelcomeEmailContext): Promise<void>;

    /**
     * Send an email verification email to a user
     * @param email - User email address
     * @param context - Tenant-aware email context (domain, app name, support email, display name)
     * @returns Promise that resolves when email is sent
     * @throws ApiError if operation fails
     */
    sendEmailVerification(email: Email, context: EmailVerificationEmailContext): Promise<void>;
}
