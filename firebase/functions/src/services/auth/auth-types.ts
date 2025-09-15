/**
 * Auth Service Types
 *
 * Type definitions and interfaces specific to the auth service implementation.
 * These types complement Firebase Admin Auth types with application-specific needs.
 */

import type { UserRecord, CreateRequest, UpdateRequest } from 'firebase-admin/auth';

/**
 * Result of a user creation operation
 */
export interface CreateUserResult {
    success: boolean;
    user: UserRecord;
    error?: string;
}

/**
 * Result of a user update operation
 */
export interface UpdateUserResult {
    success: boolean;
    user: UserRecord;
    error?: string;
}

/**
 * Result of a user deletion operation
 */
export interface DeleteUserResult {
    success: boolean;
    uid: string;
    error?: string;
}

/**
 * Batch operation result for multiple user operations
 */
export interface BatchUserOperationResult {
    successCount: number;
    failureCount: number;
    results: Array<{
        uid: string;
        success: boolean;
        error?: string;
    }>;
}

/**
 * Enhanced user creation request with validation
 */
export interface ValidatedCreateUserRequest extends CreateRequest {
    email: string;
    password: string;
    displayName: string;
    emailVerified?: boolean;
    phoneNumber?: string;
    photoURL?: string;
    disabled?: boolean;
}

/**
 * Enhanced user update request with validation
 */
export interface ValidatedUpdateUserRequest extends UpdateRequest {
    displayName?: string;
    email?: string;
    phoneNumber?: string | null;
    photoURL?: string | null;
    password?: string;
    emailVerified?: boolean;
    disabled?: boolean;
}

/**
 * Options for listing users
 */
export interface ListUsersOptions {
    maxResults?: number;
    pageToken?: string;
}

/**
 * Token verification options
 */
export interface TokenVerificationOptions {
    checkRevoked?: boolean;
    clockSkewSeconds?: number;
}

/**
 * Custom claims for user roles and permissions
 */
export interface CustomUserClaims {
    role?: string;
    permissions?: string[];
    groupIds?: string[];
    [key: string]: any;
}

/**
 * Auth service configuration options
 */
export interface AuthServiceConfig {
    validateInput?: boolean;
    enableLogging?: boolean;
    enableMetrics?: boolean;
    defaultTimeout?: number;
}

/**
 * Auth operation context for logging and debugging
 */
export interface AuthOperationContext {
    operation: string;
    userId?: string;
    correlationId?: string;
    requestId?: string;
    userAgent?: string;
    ipAddress?: string;
}

/**
 * Auth service performance metrics
 */
export interface AuthServiceMetrics {
    operationName: string;
    duration: number;
    success: boolean;
    timestamp: Date;
    context?: AuthOperationContext;
}

/**
 * Password policy configuration
 */
export interface PasswordPolicy {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    disallowedPasswords?: string[];
}

/**
 * User profile data extracted from UserRecord
 */
export interface UserProfile {
    uid: string;
    email: string | undefined;
    displayName: string | undefined;
    photoURL: string | undefined;
    emailVerified: boolean;
    disabled: boolean;
    metadata: {
        creationTime: string;
        lastSignInTime: string | undefined;
        lastRefreshTime: string | undefined;
    };
    customClaims?: { [key: string]: any };
    providerData: Array<{
        uid: string;
        displayName: string | undefined;
        email: string | undefined;
        photoURL: string | undefined;
        providerId: string;
    }>;
}

/**
 * Auth error codes specific to our application
 */
export enum AuthErrorCode {
    USER_NOT_FOUND = 'AUTH_USER_NOT_FOUND',
    EMAIL_ALREADY_EXISTS = 'AUTH_EMAIL_ALREADY_EXISTS',
    INVALID_EMAIL = 'AUTH_INVALID_EMAIL',
    WEAK_PASSWORD = 'AUTH_WEAK_PASSWORD',
    INVALID_TOKEN = 'AUTH_INVALID_TOKEN',
    TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
    INSUFFICIENT_PERMISSIONS = 'AUTH_INSUFFICIENT_PERMISSIONS',
    OPERATION_NOT_ALLOWED = 'AUTH_OPERATION_NOT_ALLOWED',
    TOO_MANY_REQUESTS = 'AUTH_TOO_MANY_REQUESTS',
    INVALID_UID = 'AUTH_INVALID_UID',
    UID_ALREADY_EXISTS = 'AUTH_UID_ALREADY_EXISTS',
    INVALID_PHONE_NUMBER = 'AUTH_INVALID_PHONE_NUMBER',
    PHONE_NUMBER_ALREADY_EXISTS = 'AUTH_PHONE_NUMBER_ALREADY_EXISTS',
    INVALID_DISPLAY_NAME = 'AUTH_INVALID_DISPLAY_NAME',
    INVALID_PHOTO_URL = 'AUTH_INVALID_PHOTO_URL',
    QUOTA_EXCEEDED = 'AUTH_QUOTA_EXCEEDED',
    SERVICE_UNAVAILABLE = 'AUTH_SERVICE_UNAVAILABLE',
}

/**
 * Mapping of Firebase Auth error codes to our application error codes
 */
export const FIREBASE_AUTH_ERROR_MAP: Record<string, AuthErrorCode> = {
    'auth/user-not-found': AuthErrorCode.USER_NOT_FOUND,
    'auth/email-already-exists': AuthErrorCode.EMAIL_ALREADY_EXISTS,
    'auth/invalid-email': AuthErrorCode.INVALID_EMAIL,
    'auth/weak-password': AuthErrorCode.WEAK_PASSWORD,
    'auth/invalid-id-token': AuthErrorCode.INVALID_TOKEN,
    'auth/id-token-expired': AuthErrorCode.TOKEN_EXPIRED,
    'auth/insufficient-permission': AuthErrorCode.INSUFFICIENT_PERMISSIONS,
    'auth/operation-not-allowed': AuthErrorCode.OPERATION_NOT_ALLOWED,
    'auth/too-many-requests': AuthErrorCode.TOO_MANY_REQUESTS,
    'auth/invalid-uid': AuthErrorCode.INVALID_UID,
    'auth/uid-already-exists': AuthErrorCode.UID_ALREADY_EXISTS,
    'auth/invalid-phone-number': AuthErrorCode.INVALID_PHONE_NUMBER,
    'auth/phone-number-already-exists': AuthErrorCode.PHONE_NUMBER_ALREADY_EXISTS,
    'auth/quota-exceeded': AuthErrorCode.QUOTA_EXCEEDED,
    'auth/service-unavailable': AuthErrorCode.SERVICE_UNAVAILABLE,
};