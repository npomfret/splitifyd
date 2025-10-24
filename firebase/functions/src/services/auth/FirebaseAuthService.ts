/**
 * Firebase Auth Service Implementation
 *
 * Concrete implementation of IAuthService using Firebase Admin Auth.
 * Provides type-safe, validated access to Firebase Auth operations with
 * consistent error handling, logging, and performance monitoring.
 *
 * Design Principles:
 * - Follows the same patterns as FirestoreReader/Writer
 * - Consistent error mapping from Firebase to application errors
 * - Comprehensive logging with context
 * - Input validation using Joi schemas
 * - Performance monitoring
 */

import type { Auth } from 'firebase-admin/auth';
import type { CreateRequest, DecodedIdToken, GetUsersResult, UpdateRequest, UserRecord } from 'firebase-admin/auth';

import { IAuthService } from './IAuthService';

// ========================================================================
// Internal Types - Implementation Details Only
// ========================================================================

/**
 * Auth operation context for logging and debugging (internal implementation detail)
 */
interface AuthOperationContext {
    operation: string;
    userId?: string;
    correlationId?: string;
    requestId?: string;
    userAgent?: string;
    ipAddress?: string;
}

// Internal types used only by FirebaseAuthService for validated data casting
interface ValidatedCreateUserRequest extends CreateRequest {
    email: Email;
    password: string;
    displayName: DisplayName;
    emailVerified?: boolean;
    phoneNumber?: string;
    photoURL?: string;
    disabled?: boolean;
}

interface ValidatedUpdateUserRequest extends UpdateRequest {
    displayName?: string;
    email?: string;
    phoneNumber?: string | null;
    photoURL?: string | null;
    password?: string;
    emailVerified?: boolean;
    disabled?: boolean;
}
import { HTTP_STATUS } from '../../constants';
import { logger } from '../../logger';
import { measureDb } from '../../monitoring/measure';
import { ApiError, Errors } from '../../utils/errors';
import { LoggerContext } from '../../utils/logger-context';
import { AuthErrorCode, FIREBASE_AUTH_ERROR_MAP } from './auth-types';
import { validateBatchUserIds, validateCreateUser, validateCustomClaims, validateIdToken, validateUpdateUser, validateUserId } from './auth-validation';
import {DisplayName} from "@splitifyd/shared";
import type {Email} from "@splitifyd/shared";

export interface IdentityToolkitConfig {
    apiKey: string;
    baseUrl: string;
}

interface IdentityToolkitErrorResponse {
    error?: {
        code?: number;
        message?: string;
        status?: string;
        errors?: Array<{
            message?: string;
            domain?: string;
            reason?: string;
        }>;
    };
}

const SIGN_IN_WITH_PASSWORD_ENDPOINT = '/v1/accounts:signInWithPassword';

export class FirebaseAuthService implements IAuthService {
    constructor(
        private readonly auth: Auth,
        identityToolkit: IdentityToolkitConfig,
        private readonly enableValidation: boolean = true,
        private readonly enableMetrics: boolean = true,
    ) {
        this.identityToolkitConfig = {
            apiKey: identityToolkit.apiKey,
            baseUrl: identityToolkit.baseUrl.replace(/\/$/, ''),
        };
    }

    private readonly identityToolkitConfig: IdentityToolkitConfig;

    /**
     * Create operation context for logging
     */
    private createContext(operation: string, userId?: string): AuthOperationContext {
        return {
            operation,
            userId,
            correlationId: LoggerContext.get().correlationId,
        };
    }

    /**
     * Map Firebase Auth errors to application errors
     */
    private mapFirebaseError(error: any, context: AuthOperationContext): ApiError {
        if (error instanceof ApiError) {
            return error;
        }

        const firebaseCode = error.code;
        const appErrorCode = FIREBASE_AUTH_ERROR_MAP[firebaseCode];

        if (appErrorCode) {
            logger.error(`Firebase Auth error: ${firebaseCode}`, error, context);

            switch (appErrorCode) {
                case AuthErrorCode.USER_NOT_FOUND:
                    return Errors.NOT_FOUND('User not found');
                case AuthErrorCode.EMAIL_ALREADY_EXISTS:
                    return new ApiError(HTTP_STATUS.CONFLICT, appErrorCode, 'An account with this email already exists');
                case AuthErrorCode.INVALID_EMAIL:
                    return new ApiError(HTTP_STATUS.BAD_REQUEST, appErrorCode, 'Invalid email format');
                case AuthErrorCode.WEAK_PASSWORD:
                    return new ApiError(HTTP_STATUS.BAD_REQUEST, appErrorCode, 'Password does not meet requirements');
                case AuthErrorCode.INVALID_TOKEN:
                    return new ApiError(HTTP_STATUS.UNAUTHORIZED, appErrorCode, 'Invalid authentication token');
                case AuthErrorCode.TOKEN_EXPIRED:
                    return new ApiError(HTTP_STATUS.UNAUTHORIZED, appErrorCode, 'Authentication token has expired');
                case AuthErrorCode.INSUFFICIENT_PERMISSIONS:
                    return new ApiError(HTTP_STATUS.FORBIDDEN, appErrorCode, 'Insufficient permissions');
                case AuthErrorCode.TOO_MANY_REQUESTS:
                    return new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, appErrorCode, 'Too many requests');
                default:
                    return new ApiError(HTTP_STATUS.INTERNAL_ERROR, appErrorCode, error.message);
            }
        }

        // Unknown Firebase error
        logger.error(`Unknown Firebase Auth error: ${firebaseCode}`, error, context);
        return new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'AUTH_UNKNOWN_ERROR', 'Authentication service error');
    }

    /**
     * Resolve and cache Identity Toolkit configuration (base URL + API key).
     */
    private resolveIdentityToolkitConfig(): IdentityToolkitConfig {
        const { apiKey, baseUrl } = this.identityToolkitConfig;

        if (!apiKey || apiKey.trim().length === 0) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'AUTH_CONFIGURATION_ERROR', 'Identity Toolkit API key is not configured');
        }

        if (!baseUrl || baseUrl.trim().length === 0) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'AUTH_CONFIGURATION_ERROR', 'Identity Toolkit base URL is not configured');
        }

        return this.identityToolkitConfig;
    }

    /**
     * Execute operation with error handling and metrics
     */
    private async executeWithMetrics<T>(operationName: string, operation: () => Promise<T>, context: AuthOperationContext): Promise<T> {
        if (this.enableMetrics) {
            return measureDb(operationName, async () => {
                try {
                    return await operation();
                } catch (error) {
                    throw this.mapFirebaseError(error, context);
                }
            });
        } else {
            try {
                return await operation();
            } catch (error) {
                throw this.mapFirebaseError(error, context);
            }
        }
    }

    // ========================================================================
    // User Management Operations
    // ========================================================================

    async createUser(userData: CreateRequest): Promise<UserRecord> {
        const context = this.createContext('createUser');

        // Validate input if enabled
        const validatedData: ValidatedCreateUserRequest = this.enableValidation ? validateCreateUser(userData) : (userData as ValidatedCreateUserRequest);

        LoggerContext.update({
            operation: 'createUser',
            email: validatedData.email,
        });

        return this.executeWithMetrics(
            'FirebaseAuthService.createUser',
            async () => {
                logger.info('Creating user in Firebase Auth', {
                    ...context,
                    email: validatedData.email,
                    displayName: validatedData.displayName,
                });

                const userRecord = await this.auth.createUser(validatedData);

                logger.info('User created successfully in Firebase Auth', {
                    ...context,
                    userId: userRecord.uid,
                    email: userRecord.email,
                    displayName: userRecord.displayName,
                });

                return userRecord;
            },
            context,
        );
    }

    async getUser(uid: string): Promise<UserRecord | null> {
        const context = this.createContext('getUser', uid);

        // Validate input if enabled
        const validatedUid = this.enableValidation ? validateUserId(uid) : uid;

        LoggerContext.update({
            operation: 'getUser',
            userId: validatedUid,
        });

        return this.executeWithMetrics(
            'FirebaseAuthService.getUser',
            async () => {
                try {
                    const userRecord = await this.auth.getUser(validatedUid);
                    return userRecord;
                } catch (error: any) {
                    // Handle user not found gracefully
                    if (error.code === 'auth/user-not-found') {
                        return null;
                    }
                    throw error;
                }
            },
            context,
        );
    }

    async getUsers(uids: { uid: string; }[]): Promise<GetUsersResult> {
        const context = this.createContext('getUsers');

        // Extract UIDs and validate if enabled
        const uidList = uids.map((u) => u.uid);
        const validatedUids = this.enableValidation ? validateBatchUserIds(uidList) : uidList;

        LoggerContext.update({
            operation: 'getUsers',
            userCount: validatedUids.length,
        });

        return this.executeWithMetrics(
            'FirebaseAuthService.getUsers',
            async () => {
                const result = await this.auth.getUsers(uids);

                return result;
            },
            context,
        );
    }

    async updateUser(uid: string, updates: UpdateRequest): Promise<UserRecord> {
        const context = this.createContext('updateUser', uid);

        // Validate input if enabled
        const validatedUid = this.enableValidation ? validateUserId(uid) : uid;
        const validatedUpdates: ValidatedUpdateUserRequest = this.enableValidation ? validateUpdateUser(updates) : (updates as ValidatedUpdateUserRequest);

        LoggerContext.update({
            operation: 'updateUser',
            userId: validatedUid,
        });

        return this.executeWithMetrics(
            'FirebaseAuthService.updateUser',
            async () => {
                const userRecord = await this.auth.updateUser(validatedUid, validatedUpdates);

                logger.info('User updated successfully', {
                    ...context,
                    userId: userRecord.uid,
                    updatedFields: Object.keys(validatedUpdates),
                });

                return userRecord;
            },
            context,
        );
    }

    async deleteUser(uid: string): Promise<void> {
        const context = this.createContext('deleteUser', uid);

        // Validate input if enabled
        const validatedUid = this.enableValidation ? validateUserId(uid) : uid;

        LoggerContext.update({
            operation: 'deleteUser',
            userId: validatedUid,
        });

        return this.executeWithMetrics(
            'FirebaseAuthService.deleteUser',
            async () => {
                await this.auth.deleteUser(validatedUid);

                logger.info('User deleted successfully', {
                    ...context,
                    userId: validatedUid,
                });
            },
            context,
        );
    }

    // ========================================================================
    // Token Operations
    // ========================================================================

    async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
        const context = this.createContext('verifyIdToken');

        // Validate input if enabled
        const validatedToken = this.enableValidation ? validateIdToken(idToken) : idToken;

        LoggerContext.update({
            operation: 'verifyIdToken',
        });

        return this.executeWithMetrics(
            'FirebaseAuthService.verifyIdToken',
            async () => {
                const decodedToken = await this.auth.verifyIdToken(validatedToken, true); // checkRevoked = true

                logger.info('Token verified successfully', {
                    ...context,
                    userId: decodedToken.uid,
                    iss: decodedToken.iss,
                    aud: decodedToken.aud,
                });

                return decodedToken;
            },
            context,
        );
    }

    async createCustomToken(uid: string, additionalClaims?: object): Promise<string> {
        const context = this.createContext('createCustomToken', uid);

        // Validate input if enabled
        const validatedUid = this.enableValidation ? validateUserId(uid) : uid;
        const validatedClaims = this.enableValidation && additionalClaims ? validateCustomClaims(additionalClaims) : additionalClaims;

        LoggerContext.update({
            operation: 'createCustomToken',
            userId: validatedUid,
        });

        return this.executeWithMetrics(
            'FirebaseAuthService.createCustomToken',
            async () => {
                const token = await this.auth.createCustomToken(validatedUid, validatedClaims);

                logger.info('Custom token created successfully', {
                    ...context,
                    userId: validatedUid,
                    hasClaims: !!validatedClaims,
                });

                return token;
            },
            context,
        );
    }

    // ========================================================================
    // Utility Operations
    // ========================================================================

    async verifyPassword(email: Email, password: string): Promise<boolean> {
        const context = this.createContext('verifyPassword', email);

        LoggerContext.update({
            operation: 'verifyPassword',
            email,
        });

        return this.executeWithMetrics(
            'FirebaseAuthService.verifyPassword',
            async () => {
                const config = this.resolveIdentityToolkitConfig();
                const requestUrl = `${config.baseUrl}${SIGN_IN_WITH_PASSWORD_ENDPOINT}?key=${config.apiKey}`;

                const payload = {
                    email,
                    password,
                    returnSecureToken: false,
                };

                let response: Response;

                try {
                    response = await fetch(requestUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload),
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    logger.error('Password verification request failed', { ...context, errorMessage });
                    throw new ApiError(HTTP_STATUS.SERVICE_UNAVAILABLE, AuthErrorCode.SERVICE_UNAVAILABLE, 'Password verification service unavailable');
                }

                if (response.ok) {
                    logger.info('Password verification succeeded', { ...context });
                    return true;
                }

                let errorBody: IdentityToolkitErrorResponse | undefined;

                try {
                    errorBody = await response.json();
                } catch {
                    // Ignore JSON parsing failures; we'll fall back to status code
                }

                const rawMessage = errorBody?.error?.message ?? `HTTP_${response.status}`;
                const message = rawMessage.toUpperCase();

                if (message === 'INVALID_PASSWORD' || message === 'EMAIL_NOT_FOUND' || message === 'USER_DISABLED') {
                    logger.info('Password verification failed due to invalid credentials', { ...context, reason: message });
                    return false;
                }

                if (message === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
                    logger.warn('Password verification rate limited', { ...context });
                    throw new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, AuthErrorCode.TOO_MANY_REQUESTS, 'Too many password verification attempts. Please try again later.');
                }

                logger.error('Password verification failed with unexpected error', {
                    ...context,
                    status: response.status,
                    message: rawMessage,
                });

                throw new ApiError(
                    response.status >= 500 ? HTTP_STATUS.INTERNAL_ERROR : response.status,
                    AuthErrorCode.SERVICE_UNAVAILABLE,
                    'Authentication service error',
                );
            },
            context,
        );
    }
}
