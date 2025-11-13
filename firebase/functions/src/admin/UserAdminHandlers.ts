import type { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import type { IAuthService } from '../services/auth';
import { ApiError } from '../utils/errors';

/**
 * Handler for admin user management operations
 */
export class UserAdminHandlers {
    constructor(private readonly authService: IAuthService) {}

    /**
     * Update user account status (enable/disable)
     * PUT /admin/users/:uid
     */
    updateUser = async (req: Request, res: Response): Promise<void> => {
        const { uid } = req.params;
        const { disabled } = req.body;

        // Validate UID
        if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'INVALID_UID',
                'User ID is required and must be a non-empty string',
            );
        }

        // Validate payload - only 'disabled' field is allowed
        if (typeof disabled !== 'boolean') {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'INVALID_PAYLOAD',
                'Request body must contain a boolean "disabled" field',
            );
        }

        // Prevent unwanted fields
        const allowedFields = ['disabled'];
        const providedFields = Object.keys(req.body);
        const invalidFields = providedFields.filter(field => !allowedFields.includes(field));
        if (invalidFields.length > 0) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'INVALID_FIELDS',
                `Only "disabled" field is allowed. Invalid fields: ${invalidFields.join(', ')}`,
            );
        }

        // Prevent self-disable
        const requestingUser = (req as any).user;
        if (requestingUser && requestingUser.uid === uid) {
            throw new ApiError(
                HTTP_STATUS.CONFLICT,
                'CANNOT_DISABLE_SELF',
                'You cannot disable your own account',
            );
        }

        try {
            // Check if user exists
            const existingUser = await this.authService.getUser(uid);
            if (!existingUser) {
                throw new ApiError(
                    HTTP_STATUS.NOT_FOUND,
                    'USER_NOT_FOUND',
                    `User with UID ${uid} not found`,
                );
            }

            // Update user
            const updatedUser = await this.authService.updateUser(uid, { disabled });

            // Log the action for audit trail
            const action = disabled ? 'disabled' : 'enabled';
            logger.info(`Admin ${action} user`, {
                actorUid: requestingUser?.uid,
                targetUid: uid,
                action,
            });

            // Return updated user record
            res.json({
                uid: updatedUser.uid,
                email: updatedUser.email ?? null,
                emailVerified: updatedUser.emailVerified ?? false,
                displayName: updatedUser.displayName ?? null,
                disabled: updatedUser.disabled ?? false,
                metadata: updatedUser.metadata,
            });
        } catch (error) {
            // Re-throw ApiError as-is
            if (error instanceof ApiError) {
                throw error;
            }

            logger.error('Failed to update user', error as Error, {
                actorUid: requestingUser?.uid,
                targetUid: uid,
                disabled,
            });

            throw new ApiError(
                HTTP_STATUS.INTERNAL_ERROR,
                'UPDATE_FAILED',
                'Failed to update user account',
            );
        }
    };
}
