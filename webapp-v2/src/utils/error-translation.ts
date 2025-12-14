/**
 * Error Translation Utilities
 *
 * Provides centralized translation of API errors and Firebase auth errors
 * to localized user-facing messages using i18next.
 */

import { ApiError } from '@/app/apiClient';
import type { TFunction } from 'i18next';

/**
 * Translates an API error code to a localized message using explicit switch.
 * This ensures all translation keys are statically analyzable.
 */
function translateApiErrorCode(code: string, t: TFunction): string {
    switch (code) {
        case 'AUTH_REQUIRED':
            return t('apiErrors.AUTH_REQUIRED');
        case 'AUTH_INVALID':
            return t('apiErrors.AUTH_INVALID');
        case 'FORBIDDEN':
            return t('apiErrors.FORBIDDEN');
        case 'NOT_FOUND':
            return t('apiErrors.NOT_FOUND');
        case 'ALREADY_EXISTS':
            return t('apiErrors.ALREADY_EXISTS');
        case 'CONFLICT':
            return t('apiErrors.CONFLICT');
        case 'VALIDATION_ERROR':
            return t('apiErrors.VALIDATION_ERROR');
        case 'INVALID_REQUEST':
            return t('apiErrors.INVALID_REQUEST');
        case 'RATE_LIMITED':
            return t('apiErrors.RATE_LIMITED');
        case 'SERVICE_ERROR':
            return t('apiErrors.SERVICE_ERROR');
        case 'UNAVAILABLE':
            return t('apiErrors.UNAVAILABLE');
        default:
            return '';
    }
}

/**
 * Translates an API error to a localized user-facing message.
 *
 * Uses the error's `code` field to look up a translation in the `apiErrors` namespace.
 * If the error has additional data (like `resource`), it's passed for interpolation.
 *
 * @param error - The error to translate (can be ApiError, Error, or unknown)
 * @param t - The i18next translation function
 * @param fallback - Optional fallback message if no translation is found
 * @returns A localized error message string
 *
 * @example
 * ```typescript
 * try {
 *   await apiClient.getGroup(groupId);
 * } catch (error) {
 *   const message = translateApiError(error, t);
 *   setErrorMessage(message);
 * }
 * ```
 */
export function translateApiError(error: unknown, t: TFunction, fallback?: string): string {
    if (error instanceof ApiError) {
        const translated = translateApiErrorCode(error.code, t);
        if (translated) {
            return translated;
        }
    }

    // For generic Error objects, use the message if no translation available
    if (error instanceof Error && error.message) {
        return error.message;
    }

    // Fallback chain: provided fallback → generic error translation
    return fallback ?? t('common.unknownError');
}

interface FirebaseAuthError {
    code: string;
    message?: string;
}

/**
 * Translates a Firebase Auth error code to a localized message using explicit switch.
 * This ensures all translation keys are statically analyzable.
 */
function translateFirebaseAuthCode(code: string, t: TFunction): string {
    switch (code) {
        case 'auth/user-not-found':
            return t('authErrors.userNotFound');
        case 'auth/wrong-password':
            return t('authErrors.wrongPassword');
        case 'auth/weak-password':
            return t('authErrors.weakPassword');
        case 'auth/invalid-email':
            return t('authErrors.invalidEmail');
        case 'auth/too-many-requests':
            return t('authErrors.tooManyRequests');
        case 'auth/network-request-failed':
            return t('authErrors.networkError');
        case 'auth/email-already-in-use':
            return t('authErrors.emailInUse');
        case 'auth/invalid-credential':
            return t('authErrors.invalidCredential');
        case 'auth/user-disabled':
            return t('authErrors.userDisabled');
        case 'auth/requires-recent-login':
            return t('authErrors.requiresRecentLogin');
        default:
            return '';
    }
}

/**
 * Translates a Firebase Auth error to a localized user-facing message.
 *
 * @param error - The Firebase auth error object with a `code` property
 * @param t - The i18next translation function
 * @returns A localized error message string
 *
 * @example
 * ```typescript
 * try {
 *   await signInWithEmailAndPassword(auth, email, password);
 * } catch (error) {
 *   const message = translateFirebaseAuthError(error, t);
 *   setAuthError(message);
 * }
 * ```
 */
export function translateFirebaseAuthError(error: unknown, t: TFunction): string {
    if (error && typeof error === 'object' && 'code' in error) {
        const authError = error as FirebaseAuthError;
        const translated = translateFirebaseAuthCode(authError.code, t);
        if (translated) {
            return translated;
        }
    }

    // Fallback to generic auth error
    return t('authErrors.generic');
}
