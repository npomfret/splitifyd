import type { EmailVerificationRequest, LoginRequest, LoginResponse, PasswordResetRequest, UserRegistration } from '@billsplit-wl/shared';
import { toEmail } from '@billsplit-wl/shared';
import type { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { ErrorDetail, Errors } from '../errors';
import { logger } from '../logger';
import type { IAuthService } from '../services/auth';
import type { TenantRegistryService } from '../services/tenant/TenantRegistryService';
import type { UserService } from '../services/UserService2';
import { HostResolver } from '../utils/HostResolver';
import { validateEmailVerificationRequest, validateLoginRequest, validatePasswordResetRequest, validateRegisterRequest } from './validation';

export class AuthHandlers {
    private readonly hostResolver = new HostResolver();

    constructor(
        private readonly authService: IAuthService,
        private readonly tenantRegistry: TenantRegistryService,
        private readonly userService: UserService,
    ) {}

    /**
     * Authenticate a user with email and password.
     * Returns a custom token that the client uses to sign in with Firebase Auth.
     *
     * Security: Returns generic INVALID_CREDENTIALS for both wrong email and wrong password
     * to prevent email enumeration attacks.
     */
    login = async (req: Request, res: Response): Promise<void> => {
        const validated = validateLoginRequest(req.body as LoginRequest);

        // Verify the password
        const isValid = await this.authService.verifyPassword(
            toEmail(validated.email),
            validated.password,
        );

        if (!isValid) {
            // Generic error - don't reveal if email exists or not
            throw Errors.authInvalid();
        }

        // Get the user to obtain UID
        const user = await this.authService.getUserByEmail(toEmail(validated.email));
        if (!user) {
            // This shouldn't happen if verifyPassword returned true, but handle it
            throw Errors.authInvalid();
        }

        // Create custom token for client-side Firebase Auth sign-in
        const customToken = await this.authService.createCustomToken(user.uid);

        const response: LoginResponse = {
            success: true,
            customToken,
        };

        res.status(HTTP_STATUS.OK).json(response);
    };

    /**
     * Send a password reset email to the specified email address.
     * Returns 204 No Content even for non-existent emails to prevent enumeration.
     */
    sendPasswordResetEmail = async (req: Request, res: Response): Promise<void> => {
        const validated = validatePasswordResetRequest(req.body as PasswordResetRequest);

        // Record the domain used by the requester. Reject suspicious host/header mismatches.
        // This will be used later when generating a tenant-correct reset link.
        const hostInfo = this.hostResolver.resolve(req);
        const tenantContext = await this.tenantRegistry.resolveTenant({ host: hostInfo.host });
        if (tenantContext.source !== 'domain') {
            throw Errors.invalidRequest(ErrorDetail.HOST_MISMATCH);
        }

        const legal = tenantContext.config?.brandingTokens?.tokens?.legal;
        if (!legal?.appName || !legal.supportEmail) {
            throw Errors.serviceError(ErrorDetail.TENANT_MISSING_CONFIG);
        }

        const protoHeader = Array.isArray(req.headers['x-forwarded-proto'])
            ? req.headers['x-forwarded-proto'][0]
            : (req.headers['x-forwarded-proto'] as string | undefined);
        const protocol = protoHeader?.split(',')[0]?.trim().toLowerCase() === 'http' ? 'http' : 'https';
        const baseUrl = `${protocol}://${hostInfo.publicHost}`;

        // The service handles non-existent emails silently
        await this.authService.sendPasswordResetEmail(toEmail(validated.email), {
            baseUrl,
            appName: legal.appName,
            supportEmail: toEmail(legal.supportEmail),
        });

        res.status(HTTP_STATUS.NO_CONTENT).send();
    };

    /**
     * Register a new user and send a welcome email.
     * Returns 201 Created with the user data on success.
     */
    register = async (req: Request, res: Response): Promise<void> => {
        // Validate request body (includes signupHostname)
        const validated = validateRegisterRequest(req.body as UserRegistration);

        // Validate request host from headers
        const hostInfo = this.hostResolver.resolve(req);

        // Compare server-validated host with client-provided hostname
        // The client hostname is normalized (trimmed, lowercased) by the validator
        if (validated.signupHostname !== hostInfo.host) {
            throw Errors.invalidRequest(ErrorDetail.HOST_MISMATCH);
        }

        // Resolve tenant from the validated host
        const tenantContext = await this.tenantRegistry.resolveTenant({ host: hostInfo.host });

        // Register the user with the resolved tenant ID
        const result = await this.userService.registerUser(validated, tenantContext.tenantId);

        // Attempt to send welcome email (non-blocking - don't fail registration if email fails)
        try {
            if (tenantContext.source === 'domain') {
                const legal = tenantContext.config?.brandingTokens?.tokens?.legal;
                if (legal?.appName && legal.supportEmail) {
                    const protoHeader = Array.isArray(req.headers['x-forwarded-proto'])
                        ? req.headers['x-forwarded-proto'][0]
                        : (req.headers['x-forwarded-proto'] as string | undefined);
                    const protocol = protoHeader?.split(',')[0]?.trim().toLowerCase() === 'http' ? 'http' : 'https';
                    const baseUrl = `${protocol}://${hostInfo.publicHost}`;

                    await this.authService.sendWelcomeEmail(toEmail(validated.email), {
                        baseUrl,
                        appName: legal.appName,
                        supportEmail: toEmail(legal.supportEmail),
                        displayName: result.user.displayName,
                    });
                }
            }
        } catch (error) {
            // Log but don't fail registration - welcome email is best-effort
            logger.warn('Failed to send welcome email', {
                error: error instanceof Error ? error.message : String(error),
                userId: result.user.uid,
            });
        }

        res.status(HTTP_STATUS.CREATED).json(result);
    };

    /**
     * Send an email verification email to the specified email address.
     * Returns 204 No Content even for non-existent emails to prevent enumeration.
     */
    sendEmailVerification = async (req: Request, res: Response): Promise<void> => {
        const validated = validateEmailVerificationRequest(req.body as EmailVerificationRequest);

        const hostInfo = this.hostResolver.resolve(req);
        const tenantContext = await this.tenantRegistry.resolveTenant({ host: hostInfo.host });
        if (tenantContext.source !== 'domain') {
            throw Errors.invalidRequest(ErrorDetail.HOST_MISMATCH);
        }

        const legal = tenantContext.config?.brandingTokens?.tokens?.legal;
        if (!legal?.appName || !legal.supportEmail) {
            throw Errors.serviceError(ErrorDetail.TENANT_MISSING_CONFIG);
        }

        const protoHeader = Array.isArray(req.headers['x-forwarded-proto'])
            ? req.headers['x-forwarded-proto'][0]
            : (req.headers['x-forwarded-proto'] as string | undefined);
        const protocol = protoHeader?.split(',')[0]?.trim().toLowerCase() === 'http' ? 'http' : 'https';
        const baseUrl = `${protocol}://${hostInfo.publicHost}`;

        // Get user to obtain display name
        const user = await this.authService.getUserByEmail(toEmail(validated.email));
        const displayName = user?.displayName ?? 'User';

        // The service handles non-existent emails silently
        await this.authService.sendEmailVerification(toEmail(validated.email), {
            baseUrl,
            appName: legal.appName,
            supportEmail: toEmail(legal.supportEmail),
            displayName,
        });

        res.status(HTTP_STATUS.NO_CONTENT).send();
    };
}
