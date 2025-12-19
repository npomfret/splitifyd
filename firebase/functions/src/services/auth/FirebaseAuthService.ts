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
 * - Input validation using shared Zod schemas
 * - Performance monitoring
 */

import type { Auth } from 'firebase-admin/auth';
import type { CreateRequest, DecodedIdToken, UpdateRequest, UserRecord } from 'firebase-admin/auth';

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
import { DisplayName, SEND_OOB_CODE_ENDPOINT, SIGN_IN_WITH_PASSWORD_ENDPOINT, UserId } from '@billsplit-wl/shared';
import type { Email } from '@billsplit-wl/shared';
import { ApiError, ErrorDetail, Errors } from '../../errors';
import { logger } from '../../logger';
import { measureDb } from '../../monitoring/measure';
import { LoggerContext } from '../../utils/logger-context';
import { EmailTemplateService, type EmailMessage, type IEmailService } from '../email';
import { AuthErrorCode, FIREBASE_AUTH_ERROR_MAP } from './auth-types';
import { validateCreateUser, validateCustomClaims, validateEmailAddress, validateIdToken, validateUpdateUser, validateUserId } from './auth-validation';
import type { EmailVerificationEmailContext, PasswordResetEmailContext, WelcomeEmailContext } from './IAuthService';

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

export class FirebaseAuthService implements IAuthService {
    private readonly identityToolkitConfig: IdentityToolkitConfig;
    private readonly emailTemplateService: EmailTemplateService;

    constructor(
        private readonly auth: Auth,
        identityToolkit: IdentityToolkitConfig,
        private readonly emailService: IEmailService,
        private readonly enableValidation: boolean = true, // todo: wtf is this?
        private readonly enableMetrics: boolean = true,
    ) {
        this.identityToolkitConfig = {
            apiKey: identityToolkit.apiKey,
            baseUrl: identityToolkit.baseUrl.replace(/\/$/, ''),
        };
        this.emailTemplateService = new EmailTemplateService();
    }

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
                    return Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
                case AuthErrorCode.EMAIL_ALREADY_EXISTS:
                    return Errors.alreadyExists('Email', ErrorDetail.EMAIL_ALREADY_EXISTS);
                case AuthErrorCode.INVALID_EMAIL:
                    return Errors.validationError('email', ErrorDetail.INVALID_EMAIL);
                case AuthErrorCode.WEAK_PASSWORD:
                    return Errors.validationError('password', ErrorDetail.INVALID_PASSWORD);
                case AuthErrorCode.INVALID_TOKEN:
                    return Errors.authInvalid(ErrorDetail.TOKEN_INVALID);
                case AuthErrorCode.TOKEN_EXPIRED:
                    return Errors.authInvalid(ErrorDetail.TOKEN_EXPIRED);
                case AuthErrorCode.INSUFFICIENT_PERMISSIONS:
                    return Errors.forbidden(ErrorDetail.INSUFFICIENT_PERMISSIONS);
                case AuthErrorCode.TOO_MANY_REQUESTS:
                    return Errors.rateLimited();
                default:
                    return Errors.serviceError(ErrorDetail.AUTH_SERVICE_ERROR);
            }
        }

        // Unknown Firebase error
        logger.error(`Unknown Firebase Auth error: ${firebaseCode}`, error, context);
        return Errors.serviceError(ErrorDetail.AUTH_SERVICE_ERROR);
    }

    /**
     * Resolve and cache Identity Toolkit configuration (base URL + API key).
     */
    private resolveIdentityToolkitConfig(): IdentityToolkitConfig {
        const { apiKey, baseUrl } = this.identityToolkitConfig;

        if (!apiKey || apiKey.trim().length === 0) {
            throw Errors.serviceError(ErrorDetail.AUTH_SERVICE_ERROR);
        }

        if (!baseUrl || baseUrl.trim().length === 0) {
            throw Errors.serviceError(ErrorDetail.AUTH_SERVICE_ERROR);
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
        const validatedData: ValidatedCreateUserRequest = this.enableValidation
            ? (validateCreateUser(userData) as ValidatedCreateUserRequest)
            : (userData as ValidatedCreateUserRequest);

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

    async getUser(uid: UserId): Promise<UserRecord | null> {
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

    async getUserByEmail(email: Email): Promise<UserRecord | null> {
        const context = this.createContext('getUserByEmail');

        const validatedEmail = this.enableValidation ? validateEmailAddress(email) : email;

        LoggerContext.update({
            operation: 'getUserByEmail',
            email: validatedEmail,
        });

        return this.executeWithMetrics(
            'FirebaseAuthService.getUserByEmail',
            async () => {
                try {
                    return await this.auth.getUserByEmail(validatedEmail);
                } catch (error: any) {
                    if (error.code === 'auth/user-not-found') {
                        return null;
                    }
                    throw error;
                }
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
                    throw Errors.unavailable(ErrorDetail.AUTH_SERVICE_ERROR);
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
                    throw Errors.rateLimited();
                }

                logger.error('Password verification failed with unexpected error', {
                    ...context,
                    status: response.status,
                    message: rawMessage,
                });

                throw response.status >= 500
                    ? Errors.serviceError(ErrorDetail.AUTH_SERVICE_ERROR)
                    : Errors.unavailable(ErrorDetail.AUTH_SERVICE_ERROR);
            },
            context,
        );
    }

    async sendPasswordResetEmail(email: Email, resetContext: PasswordResetEmailContext): Promise<void> {
        const context = this.createContext('sendPasswordResetEmail', email);

        LoggerContext.update({
            operation: 'sendPasswordResetEmail',
            email,
            baseUrl: resetContext.baseUrl,
        });

        return this.executeWithMetrics(
            'FirebaseAuthService.sendPasswordResetEmail',
            async () => {
                const user = await this.getUserByEmail(email);
                if (!user) {
                    logger.info('Password reset email silently succeeded for non-existent email', { ...context });
                    return;
                }

                let firebaseLink: string;
                try {
                    firebaseLink = await this.auth.generatePasswordResetLink(email);
                } catch (error) {
                    const mappedError = this.mapFirebaseError(error, context);
                    logger.error('Password reset link generation failed', mappedError, { ...context });
                    throw mappedError;
                }

                const oobCode = this.extractOobCode(firebaseLink);
                const resetLink = this.buildTenantResetLink(resetContext.baseUrl, oobCode);

                // Extract domain from baseUrl for the template
                const domain = this.extractDomain(resetContext.baseUrl);

                const emailContent = this.emailTemplateService.generatePasswordResetEmail({
                    appName: resetContext.appName,
                    domain,
                    resetLink,
                });

                const messageStream = process.env['__POSTMARK_MESSAGE_STREAM'];
                if (!messageStream) {
                    throw Errors.serviceError(ErrorDetail.EMAIL_SERVICE_ERROR);
                }

                const message: EmailMessage = {
                    to: email,
                    from: resetContext.supportEmail,
                    subject: emailContent.subject,
                    textBody: emailContent.textBody,
                    htmlBody: emailContent.htmlBody,
                    messageStream,
                };

                await this.emailService.sendEmail(message);
            },
            context,
        );
    }

    private extractOobCode(firebaseLink: string): string {
        try {
            const parsed = new URL(firebaseLink);
            const oobCode = parsed.searchParams.get('oobCode');
            if (!oobCode) {
                throw new Error('oobCode missing');
            }
            return oobCode;
        } catch {
            throw Errors.serviceError(ErrorDetail.AUTH_SERVICE_ERROR);
        }
    }

    private buildTenantResetLink(baseUrl: string, oobCode: string): string {
        const normalized = baseUrl.replace(/\/$/, '');
        const params = new URLSearchParams({ mode: 'resetPassword', oobCode });
        return `${normalized}/__/auth/action?${params.toString()}`;
    }

    private extractDomain(baseUrl: string): string {
        try {
            const url = new URL(baseUrl);
            return url.hostname;
        } catch {
            // Fallback to baseUrl if parsing fails
            return baseUrl;
        }
    }

    async sendWelcomeEmail(email: Email, welcomeContext: WelcomeEmailContext): Promise<void> {
        const context = this.createContext('sendWelcomeEmail', email);

        LoggerContext.update({
            operation: 'sendWelcomeEmail',
            email,
            baseUrl: welcomeContext.baseUrl,
        });

        return this.executeWithMetrics(
            'FirebaseAuthService.sendWelcomeEmail',
            async () => {
                const dashboardLink = `${welcomeContext.baseUrl.replace(/\/$/, '')}/dashboard`;

                const emailContent = this.emailTemplateService.generateWelcomeEmail({
                    appName: welcomeContext.appName,
                    displayName: welcomeContext.displayName,
                    dashboardLink,
                });

                const messageStream = process.env['__POSTMARK_MESSAGE_STREAM'];
                if (!messageStream) {
                    throw Errors.serviceError(ErrorDetail.EMAIL_SERVICE_ERROR);
                }

                const message: EmailMessage = {
                    to: email,
                    from: welcomeContext.supportEmail,
                    subject: emailContent.subject,
                    textBody: emailContent.textBody,
                    htmlBody: emailContent.htmlBody,
                    messageStream,
                };

                await this.emailService.sendEmail(message);

                logger.info('Welcome email sent successfully', { ...context, email });
            },
            context,
        );
    }

    async sendEmailVerification(email: Email, verificationContext: EmailVerificationEmailContext): Promise<void> {
        const context = this.createContext('sendEmailVerification', email);

        LoggerContext.update({
            operation: 'sendEmailVerification',
            email,
            baseUrl: verificationContext.baseUrl,
        });

        return this.executeWithMetrics(
            'FirebaseAuthService.sendEmailVerification',
            async () => {
                const user = await this.getUserByEmail(email);
                if (!user) {
                    logger.info('Email verification email silently succeeded for non-existent email', { ...context });
                    return;
                }

                let firebaseLink: string;
                try {
                    firebaseLink = await this.auth.generateEmailVerificationLink(email);
                } catch (error) {
                    const mappedError = this.mapFirebaseError(error, context);
                    logger.error('Email verification link generation failed', mappedError, { ...context });
                    throw mappedError;
                }

                const oobCode = this.extractOobCode(firebaseLink);
                const verificationLink = this.buildTenantVerificationLink(verificationContext.baseUrl, oobCode);

                const domain = this.extractDomain(verificationContext.baseUrl);

                const emailContent = this.emailTemplateService.generateEmailVerificationEmail({
                    appName: verificationContext.appName,
                    displayName: verificationContext.displayName,
                    domain,
                    verificationLink,
                });

                const messageStream = process.env['__POSTMARK_MESSAGE_STREAM'];
                if (!messageStream) {
                    throw Errors.serviceError(ErrorDetail.EMAIL_SERVICE_ERROR);
                }

                const message: EmailMessage = {
                    to: email,
                    from: verificationContext.supportEmail,
                    subject: emailContent.subject,
                    textBody: emailContent.textBody,
                    htmlBody: emailContent.htmlBody,
                    messageStream,
                };

                await this.emailService.sendEmail(message);

                logger.info('Email verification email sent successfully', { ...context, email });
            },
            context,
        );
    }

    private buildTenantVerificationLink(baseUrl: string, oobCode: string): string {
        const normalized = baseUrl.replace(/\/$/, '');
        const params = new URLSearchParams({ mode: 'verifyEmail', oobCode });
        return `${normalized}/__/auth/action?${params.toString()}`;
    }
}
