import { AdminUserProfile, SystemUserRoles, toDisplayName, toEmail, toUserId } from '@billsplit-wl/shared';
import type { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import type { IAuthService } from '../services/auth';
import type { IFirestoreReader, IFirestoreWriter } from '../services/firestore';
import { ApiError } from '../utils/errors';

/**
 * Handler for admin user management operations
 */
export class UserAdminHandlers {
    constructor(
        private readonly authService: IAuthService,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly firestoreReader: IFirestoreReader,
    ) {}

    /**
     * Build AdminUserProfile from Firebase Auth UserRecord and Firestore data
     */
    private async buildAdminUserProfile(userRecord: any, userId: string): Promise<AdminUserProfile> {
        // Validate required fields
        if (!userRecord.email) {
            throw new ApiError(
                HTTP_STATUS.INTERNAL_ERROR,
                'INVALID_USER_DATA',
                'User record missing required email field',
            );
        }
        if (!userRecord.displayName) {
            throw new ApiError(
                HTTP_STATUS.INTERNAL_ERROR,
                'INVALID_USER_DATA',
                'User record missing required displayName field',
            );
        }

        // Get Firestore user data - MUST exist for data consistency
        const firestoreData = await this.firestoreReader.getUser(toUserId(userId));
        if (!firestoreData) {
            logger.error('Data consistency error: user exists in Auth but missing Firestore document', {
                userId,
            });
            throw new ApiError(
                HTTP_STATUS.INTERNAL_ERROR,
                'DATA_CONSISTENCY_ERROR',
                'User missing Firestore document',
            );
        }

        return {
            uid: toUserId(userRecord.uid),
            displayName: toDisplayName(userRecord.displayName),
            email: toEmail(userRecord.email),
            emailVerified: userRecord.emailVerified ?? false,
            photoURL: userRecord.photoURL || null,
            role: firestoreData.role,
            disabled: userRecord.disabled ?? false,
            metadata: {
                creationTime: userRecord.metadata.creationTime,
                lastSignInTime: userRecord.metadata.lastSignInTime,
            },
            // Firestore fields
            createdAt: firestoreData.createdAt,
            updatedAt: firestoreData.updatedAt,
            preferredLanguage: firestoreData.preferredLanguage,
            acceptedPolicies: firestoreData.acceptedPolicies as any,
        };
    }

    /**
     * Update user account status (enable/disable)
     * PUT /admin/users/:userId
     */
    updateUser = async (req: Request, res: Response): Promise<void> => {
        const { userId: userIdParam } = req.params;
        const { disabled } = req.body;

        // Validate UID
        if (!userIdParam || typeof userIdParam !== 'string' || userIdParam.trim().length === 0) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'INVALID_UID',
                'User ID is required and must be a non-empty string',
            );
        }

        const userId = toUserId(userIdParam);

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
        if (requestingUser && requestingUser.uid === userIdParam) {
            throw new ApiError(
                HTTP_STATUS.CONFLICT,
                'CANNOT_DISABLE_SELF',
                'You cannot disable your own account',
            );
        }

        try {
            // Check if user exists
            const existingUser = await this.authService.getUser(userId);
            if (!existingUser) {
                throw new ApiError(
                    HTTP_STATUS.NOT_FOUND,
                    'USER_NOT_FOUND',
                    `User with UID ${userIdParam} not found`,
                );
            }

            // Update user
            await this.authService.updateUser(userIdParam, { disabled });

            // Log the action for audit trail
            const action = disabled ? 'disabled' : 'enabled';
            logger.info(`Admin ${action} user`, {
                actorUid: requestingUser?.uid,
                targetUid: userIdParam,
                action,
            });

            res.status(HTTP_STATUS.NO_CONTENT).send();
        } catch (error) {
            // Re-throw ApiError as-is
            if (error instanceof ApiError) {
                throw error;
            }

            logger.error('Failed to update user', error as Error, {
                actorUid: requestingUser?.uid,
                targetUid: userIdParam,
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
     * Get Firebase Auth user record (raw)
     * GET /admin/users/:userId/auth
     */
    getUserAuth = async (req: Request, res: Response): Promise<void> => {
        const { userId: userIdParam } = req.params;

        // Validate UID
        if (!userIdParam || typeof userIdParam !== 'string' || userIdParam.trim().length === 0) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'INVALID_UID',
                'User ID is required and must be a non-empty string',
            );
        }

        const userId = toUserId(userIdParam);

        try {
            const userRecord = await this.authService.getUser(userId);
            if (!userRecord) {
                throw new ApiError(
                    HTTP_STATUS.NOT_FOUND,
                    'USER_NOT_FOUND',
                    `User with UID ${userIdParam} not found`,
                );
            }

            // Remove sensitive fields from the auth record
            const sanitizedRecord: any = { ...userRecord };
            delete sanitizedRecord.passwordHash;
            delete sanitizedRecord.passwordSalt;

            // Add security note
            const response = {
                ...sanitizedRecord,
                _note: 'Some fields (passwordHash, passwordSalt) have been removed for security reasons',
            };

            // Return sanitized Firebase Auth user record
            res.json(response);
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }

            logger.error('Failed to get user auth record', error as Error, {
                targetUid: userIdParam,
            });

            throw new ApiError(
                HTTP_STATUS.INTERNAL_ERROR,
                'GET_AUTH_FAILED',
                'Failed to get Firebase Auth user record',
            );
        }
    };

    /**
     * Get Firestore user document (raw)
     * GET /admin/users/:userId/firestore
     */
    getUserFirestore = async (req: Request, res: Response): Promise<void> => {
        const { userId: userIdParam } = req.params;

        // Validate UID
        if (!userIdParam || typeof userIdParam !== 'string' || userIdParam.trim().length === 0) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'INVALID_UID',
                'User ID is required and must be a non-empty string',
            );
        }

        const userId = toUserId(userIdParam);

        try {
            const firestoreData = await this.firestoreReader.getUser(userId);
            if (!firestoreData) {
                throw new ApiError(
                    HTTP_STATUS.NOT_FOUND,
                    'USER_NOT_FOUND',
                    `Firestore user document with UID ${userIdParam} not found`,
                );
            }

            // Return raw Firestore document
            res.json(firestoreData);
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }

            logger.error('Failed to get user firestore document', error as Error, {
                targetUid: userIdParam,
            });

            throw new ApiError(
                HTTP_STATUS.INTERNAL_ERROR,
                'GET_FIRESTORE_FAILED',
                'Failed to get Firestore user document',
            );
        }
    };

    /**
     * Update user role (system_admin, tenant_admin, or regular user)
     * PUT /admin/users/:userId/role
     */
    updateUserRole = async (req: Request, res: Response): Promise<void> => {
        const { userId: userIdParam } = req.params;
        const { role } = req.body;

        // Validate UID
        if (!userIdParam || typeof userIdParam !== 'string' || userIdParam.trim().length === 0) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'INVALID_UID',
                'User ID is required and must be a non-empty string',
            );
        }

        const userId = toUserId(userIdParam);

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
        if (requestingUser && requestingUser.uid === userIdParam) {
            throw new ApiError(
                HTTP_STATUS.CONFLICT,
                'CANNOT_CHANGE_OWN_ROLE',
                'You cannot change your own role',
            );
        }

        try {
            // Check if user exists
            const existingUser = await this.authService.getUser(userId);
            if (!existingUser) {
                throw new ApiError(
                    HTTP_STATUS.NOT_FOUND,
                    'USER_NOT_FOUND',
                    `User with UID ${userIdParam} not found`,
                );
            }

            // Update Firestore role instead of custom claims
            // When role is null, default to SYSTEM_USER
            await this.firestoreWriter.updateUser(userId, { role: role ?? SystemUserRoles.SYSTEM_USER });

            // Log the action for audit trail
            const newRole = role ?? SystemUserRoles.SYSTEM_USER;
            logger.info('Admin updated user role in Firestore', {
                actorUid: requestingUser?.uid,
                targetUid: userIdParam,
                newRole,
            });

            res.status(HTTP_STATUS.NO_CONTENT).send();
        } catch (error) {
            // Re-throw ApiError as-is
            if (error instanceof ApiError) {
                throw error;
            }

            logger.error('Failed to update user role', error as Error, {
                actorUid: requestingUser?.uid,
                targetUid: userIdParam,
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
