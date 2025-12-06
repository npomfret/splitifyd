/**
 * Error Translation Utilities
 *
 * Provides centralized translation of API errors and Firebase auth errors
 * to localized user-facing messages using i18next.
 */

import { ApiError } from '@/app/apiClient';
import type { TFunction } from 'i18next';

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
        // Extract interpolation data from error details
        const interpolationData = error.details && typeof error.details === 'object' ? (error.details as Record<string, unknown>) : {};

        // Try to translate using the error code
        const translated = t(`apiErrors.${error.code}`, {
            ...interpolationData,
            defaultValue: '',
        });

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

/**
 * Firebase Auth error code to translation key mapping
 */
const FIREBASE_AUTH_ERROR_MAP: Record<string, string> = {
    'auth/user-not-found': 'authErrors.userNotFound',
    'auth/wrong-password': 'authErrors.wrongPassword',
    'auth/weak-password': 'authErrors.weakPassword',
    'auth/invalid-email': 'authErrors.invalidEmail',
    'auth/too-many-requests': 'authErrors.tooManyRequests',
    'auth/network-request-failed': 'authErrors.networkError',
    'auth/email-already-in-use': 'authErrors.emailInUse',
    'auth/invalid-credential': 'authErrors.invalidCredential',
    'auth/user-disabled': 'authErrors.userDisabled',
    'auth/requires-recent-login': 'authErrors.requiresRecentLogin',
};

interface FirebaseAuthError {
    code: string;
    message?: string;
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
        const translationKey = FIREBASE_AUTH_ERROR_MAP[authError.code];

        if (translationKey) {
            return t(translationKey);
        }
    }

    // Fallback to generic auth error
    return t('authErrors.generic');
}
