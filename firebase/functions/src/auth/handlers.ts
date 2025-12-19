import type { EmailVerificationRequest, LoginRequest, LoginResponse, PasswordResetRequest, UserRegistration } from '@billsplit-wl/shared';
import { toEmail } from '@billsplit-wl/shared';
import type { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { Errors } from '../errors';
import { ErrorDetail } from '../errors';
import { logger } from '../logger';
import type { IAuthService } from '../services/auth';
import type { TenantRegistryService } from '../services/tenant/TenantRegistryService';
import type { UserService } from '../services/UserService2';
import { validateEmailVerificationRequest, validateLoginRequest, validatePasswordResetRequest } from './validation';

interface ValidatedHostInfo {
    /**
     * Normalized host without port (used for validation and tenant lookup).
     */
    host: string;
    /**
     * Public host as supplied by proxy/host headers (includes port when present).
     */
    publicHost: string;
}

export class AuthHandlers {
    constructor(
        private readonly authService: IAuthService,
        private readonly tenantRegistry: TenantRegistryService,
        private readonly userService: UserService,
    ) {}

    private resolveAndValidateRequestHost(req: Request): ValidatedHostInfo {
        const hostHeader = typeof req.headers.host === 'string' ? req.headers.host : undefined;
        const forwardedHostHeader = Array.isArray(req.headers['x-forwarded-host'])
            ? req.headers['x-forwarded-host'].join(',')
            : (req.headers['x-forwarded-host'] as string | undefined);

        const normalizedHostHeader = this.normalizeHostHeaderValue(hostHeader);
        const normalizedForwardedHostHeader = this.normalizeHostHeaderValue(forwardedHostHeader);

        if (normalizedForwardedHostHeader && normalizedHostHeader && normalizedForwardedHostHeader !== normalizedHostHeader) {
            throw Errors.invalidRequest(ErrorDetail.HOST_MISMATCH);
        }

        const candidateHost = normalizedForwardedHostHeader
            ?? normalizedHostHeader
            ?? (typeof req.hostname === 'string' ? req.hostname.trim().toLowerCase() : null)
            ?? null;

        if (!candidateHost) {
            throw Errors.invalidRequest(ErrorDetail.HOST_MISSING);
        }

        const publicHost = this.resolvePublicHost(forwardedHostHeader)
            ?? this.resolvePublicHost(hostHeader)
            ?? candidateHost;

        const originHeader = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
        if (typeof originHeader === 'string') {
            const normalizedOriginHost = this.normalizeUrlHost(originHeader);
            if (normalizedOriginHost && normalizedOriginHost !== candidateHost) {
                throw Errors.invalidRequest(ErrorDetail.HOST_MISMATCH);
            }
        }

        const refererHeader = Array.isArray(req.headers.referer)
            ? req.headers.referer[0]
            : (req.headers.referer as string | undefined);
        if (typeof refererHeader === 'string') {
            const normalizedRefererHost = this.normalizeUrlHost(refererHeader);
            if (normalizedRefererHost && normalizedRefererHost !== candidateHost) {
                throw Errors.invalidRequest(ErrorDetail.HOST_MISMATCH);
            }
        }

        return { host: candidateHost, publicHost };
    }

    private normalizeHostHeaderValue(hostHeaderValue: string | undefined): string | null {
        if (!hostHeaderValue) {
            return null;
        }

        const raw = hostHeaderValue.trim().toLowerCase();
        if (!raw) {
            return null;
        }

        const [first] = raw.split(',');
        const withoutPort = first.trim().replace(/:\d+$/, '');
        return withoutPort || null;
    }

    private resolvePublicHost(hostHeaderValue: string | undefined): string | null {
        if (!hostHeaderValue) {
            return null;
        }

        const raw = hostHeaderValue.trim();
        if (!raw) {
            return null;
        }

        const [first] = raw.split(',');
        return first.trim() || null;
    }

    private normalizeUrlHost(urlValue: string): string | null {
        try {
            const parsed = new URL(urlValue);
            const host = parsed.host.trim().toLowerCase();
            const withoutPort = host.replace(/:\d+$/, '');
            return withoutPort || null;
        } catch {
            return null;
        }
    }

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
        const hostInfo = this.resolveAndValidateRequestHost(req);
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
        // Register the user first
        const result = await this.userService.registerUser(req.body as UserRegistration);

        // Attempt to send welcome email (non-blocking - don't fail registration if email fails)
        try {
            const hostInfo = this.resolveAndValidateRequestHost(req);
            const tenantContext = await this.tenantRegistry.resolveTenant({ host: hostInfo.host });

            if (tenantContext.source === 'domain') {
                const legal = tenantContext.config?.brandingTokens?.tokens?.legal;
                if (legal?.appName && legal.supportEmail) {
                    const protoHeader = Array.isArray(req.headers['x-forwarded-proto'])
                        ? req.headers['x-forwarded-proto'][0]
                        : (req.headers['x-forwarded-proto'] as string | undefined);
                    const protocol = protoHeader?.split(',')[0]?.trim().toLowerCase() === 'http' ? 'http' : 'https';
                    const baseUrl = `${protocol}://${hostInfo.publicHost}`;

                    await this.authService.sendWelcomeEmail(toEmail((req.body as UserRegistration).email), {
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

        const hostInfo = this.resolveAndValidateRequestHost(req);
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
