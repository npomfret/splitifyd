import type { LoginRequest, LoginResponse, PasswordResetRequest } from '@billsplit-wl/shared';
import { toEmail } from '@billsplit-wl/shared';
import type { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { Errors } from '../errors';
import type { IAuthService } from '../services/auth';
import { validateLoginRequest, validatePasswordResetRequest } from './validation';

export class AuthHandlers {
    constructor(private readonly authService: IAuthService) {}

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

        // The service handles non-existent emails silently
        await this.authService.sendPasswordResetEmail(toEmail(validated.email));

        res.status(HTTP_STATUS.NO_CONTENT).send();
    };
}
