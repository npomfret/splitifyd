import { toEmail } from '@billsplit-wl/shared';
import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { HTTP_STATUS } from '../constants';
import { ErrorDetail, Errors } from '../errors';
import type { IAuthService } from '../services/auth';
import type { TenantRegistryService } from '../services/tenant/TenantRegistryService';
import { UserService } from '../services/UserService2';
import { HostResolver } from '../utils/HostResolver';

export class UserHandlers {
    private readonly hostResolver = new HostResolver();

    constructor(
        private readonly userService: UserService,
        private readonly authService: IAuthService,
        private readonly tenantRegistry: TenantRegistryService,
    ) {
    }

    /**
     * Update current user's profile
     */
    getUserProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.authRequired();
        }

        const profile = await this.userService.getProfile(userId);
        res.status(HTTP_STATUS.OK).json(profile);
    };

    /**
     * Update current user's profile
     */
    updateUserProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.authRequired();
        }

        await this.userService.updateProfile(userId, req.body);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    };

    /**
     * Change user password
     * Note: This requires the user to provide their current password for security
     */
    changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.authRequired();
        }

        await this.userService.changePassword(userId, req.body);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    };

    /**
     * Change user email
     * Validates password and sends verification email to new address.
     * The actual email change happens when the user clicks the verification link.
     */
    changeEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.authRequired();
        }

        // Validate password and get the email change data
        const validated = await this.userService.validateEmailChange(userId, req.body);

        // Resolve tenant context from request host
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

        // Send verification email to the new address
        await this.authService.sendEmailChangeVerification(validated.currentEmail, {
            baseUrl,
            appName: legal.appName,
            supportEmail: toEmail(legal.supportEmail),
            displayName: validated.displayName,
            newEmail: validated.newEmail,
        });

        res.status(HTTP_STATUS.NO_CONTENT).send();
    };
}
