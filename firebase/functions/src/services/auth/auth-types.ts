/**
 * Auth Service Types
 *
 * Core auth error codes and mappings shared across the auth service.
 * Internal implementation types are now co-located within FirebaseAuthService.ts.
 */

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
    'auth/argument-error': AuthErrorCode.INVALID_TOKEN, // Malformed JWT (firebase-admin 13.6+)
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
