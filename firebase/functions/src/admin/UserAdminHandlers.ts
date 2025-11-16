import type { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import type { IAuthService } from '../services/auth';
import type { IFirestoreWriter } from '../services/firestore/IFirestoreWriter';
import { ApiError } from '../utils/errors';
import { SystemUserRoles } from '@splitifyd/shared';

/**
 * Handler for admin user management operations
 */
export class UserAdminHandlers {
    constructor(
        private readonly authService: IAuthService,
        private readonly firestoreWriter: IFirestoreWriter,
    ) {}

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

    /**
     * Update user role (system_admin, tenant_admin, or regular user)
     * PUT /admin/users/:uid/role
     */
    updateUserRole = async (req: Request, res: Response): Promise<void> => {
        const { uid } = req.params;
        const { role } = req.body;

        // Validate UID
        if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'INVALID_UID',
                'User ID is required and must be a non-empty string',
            );
        }

        // Validate role - must be a valid SystemUserRole or null (to remove role)
        const validRoles = Object.values(SystemUserRoles);
        if (role !== null && !validRoles.includes(role)) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'INVALID_ROLE',
                `Role must be one of: ${validRoles.join(', ')}, or null to remove role`,
            );
        }

        // Prevent unwanted fields
        const allowedFields = ['role'];
        const providedFields = Object.keys(req.body);
        const invalidFields = providedFields.filter(field => !allowedFields.includes(field));
        if (invalidFields.length > 0) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'INVALID_FIELDS',
                `Only "role" field is allowed. Invalid fields: ${invalidFields.join(', ')}`,
            );
        }

        // Prevent self-role change
        const requestingUser = (req as any).user;
        if (requestingUser && requestingUser.uid === uid) {
            throw new ApiError(
                HTTP_STATUS.CONFLICT,
                'CANNOT_CHANGE_OWN_ROLE',
                'You cannot change your own role',
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

            // Update Firestore role instead of custom claims
            await this.firestoreWriter.updateUser(uid, { role: role ?? undefined });

            // Fetch updated user to return
            const updatedUser = await this.authService.getUser(uid);
            if (!updatedUser) {
                throw new ApiError(
                    HTTP_STATUS.NOT_FOUND,
                    'USER_NOT_FOUND',
                    `User with UID ${uid} not found after update`,
                );
            }

            // Log the action for audit trail
            const newRole = role ?? SystemUserRoles.SYSTEM_USER;
            logger.info('Admin updated user role in Firestore', {
                actorUid: requestingUser?.uid,
                targetUid: uid,
                newRole,
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

            logger.error('Failed to update user role', error as Error, {
                actorUid: requestingUser?.uid,
                targetUid: uid,
                role,
            });

            throw new ApiError(
                HTTP_STATUS.INTERNAL_ERROR,
                'UPDATE_ROLE_FAILED',
                'Failed to update user role',
            );
        }
    };
}
