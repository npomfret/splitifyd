import { AdminUserProfile, SystemUserRoles, toDisplayName, toEmail, toUserId } from '@billsplit-wl/shared';
import type { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { ApiError, Errors, ErrorDetail } from '../errors';
import { logger } from '../logger';
import type { IAuthService } from '../services/auth';
import type { IFirestoreReader, IFirestoreWriter } from '../services/firestore';
import { validateUserIdParam } from '../validation/common';

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
            throw Errors.serviceError('INVALID_USER_DATA');
        }
        if (!userRecord.displayName) {
            throw Errors.serviceError('INVALID_USER_DATA');
        }

        // Get Firestore user data - MUST exist for data consistency
        const firestoreData = await this.firestoreReader.getUser(toUserId(userId));
        if (!firestoreData) {
            logger.error('Data consistency error: user exists in Auth but missing Firestore document', {
                userId,
            });
            throw Errors.serviceError('DATA_CONSISTENCY_ERROR');
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
        const userId = validateUserIdParam(req.params);
        const { disabled } = req.body;

        // Validate payload - only 'disabled' field is allowed
        if (typeof disabled !== 'boolean') {
            throw Errors.validationError('disabled', ErrorDetail.MISSING_FIELD);
        }

        // Prevent unwanted fields
        const allowedFields = ['disabled'];
        const providedFields = Object.keys(req.body);
        const invalidFields = providedFields.filter(field => !allowedFields.includes(field));
        if (invalidFields.length > 0) {
            throw Errors.invalidRequest('INVALID_FIELDS');
        }

        // Prevent self-disable
        const requestingUser = (req as any).user;
        if (requestingUser && requestingUser.uid === userId) {
            throw Errors.conflict('CANNOT_DISABLE_SELF');
        }

        try {
            // Check if user exists
            const existingUser = await this.authService.getUser(userId);
            if (!existingUser) {
                throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
            }

            // Update user
            await this.authService.updateUser(userId, { disabled });

            // Log the action for audit trail
            const action = disabled ? 'disabled' : 'enabled';
            logger.info(`Admin ${action} user`, {
                actorUid: requestingUser?.uid,
                targetUid: userId,
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
                targetUid: userId,
                disabled,
            });

            throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
        }
    };

    /**
     * Get Firebase Auth user record (raw)
     * GET /admin/users/:userId/auth
     */
    getUserAuth = async (req: Request, res: Response): Promise<void> => {
        const userId = validateUserIdParam(req.params);

        try {
            const userRecord = await this.authService.getUser(userId);
            if (!userRecord) {
                throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
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
                targetUid: userId,
            });

            throw Errors.serviceError(ErrorDetail.AUTH_SERVICE_ERROR);
        }
    };

    /**
     * Get Firestore user document (raw)
     * GET /admin/users/:userId/firestore
     */
    getUserFirestore = async (req: Request, res: Response): Promise<void> => {
        const userId = validateUserIdParam(req.params);

        try {
            const firestoreData = await this.firestoreReader.getUser(userId);
            if (!firestoreData) {
                throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
            }

            // Return raw Firestore document
            res.json(firestoreData);
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }

            logger.error('Failed to get user firestore document', error as Error, {
                targetUid: userId,
            });

            throw Errors.serviceError(ErrorDetail.DATABASE_ERROR);
        }
    };

    /**
     * Update user role (system_admin, tenant_admin, or regular user)
     * PUT /admin/users/:userId/role
     */
    updateUserRole = async (req: Request, res: Response): Promise<void> => {
        const userId = validateUserIdParam(req.params);
        const { role } = req.body;

        // Validate role - must be a valid SystemUserRole or null (to remove role)
        const validRoles = Object.values(SystemUserRoles);
        if (role !== null && !validRoles.includes(role)) {
            throw Errors.validationError('role', 'INVALID_ROLE');
        }

        // Prevent unwanted fields
        const allowedFields = ['role'];
        const providedFields = Object.keys(req.body);
        const invalidFields = providedFields.filter(field => !allowedFields.includes(field));
        if (invalidFields.length > 0) {
            throw Errors.invalidRequest('INVALID_FIELDS');
        }

        // Prevent self-role change
        const requestingUser = (req as any).user;
        if (requestingUser && requestingUser.uid === userId) {
            throw Errors.conflict('CANNOT_CHANGE_OWN_ROLE');
        }

        try {
            // Check if user exists
            const existingUser = await this.authService.getUser(userId);
            if (!existingUser) {
                throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
            }

            // Update Firestore role instead of custom claims
            // When role is null, default to SYSTEM_USER
            await this.firestoreWriter.updateUser(userId, { role: role ?? SystemUserRoles.SYSTEM_USER });

            // Log the action for audit trail
            const newRole = role ?? SystemUserRoles.SYSTEM_USER;
            logger.info('Admin updated user role in Firestore', {
                actorUid: requestingUser?.uid,
                targetUid: userId,
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
                targetUid: userId,
                role,
            });

            throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
        }
    };

    /**
     * Update user profile (displayName, email) in Firebase Auth
     * PUT /admin/users/:userId/profile
     */
    updateUserProfile = async (req: Request, res: Response): Promise<void> => {
        const userId = validateUserIdParam(req.params);
        const { displayName, email } = req.body;

        // Validate at least one field is provided
        if (displayName === undefined && email === undefined) {
            throw Errors.validationError('body', ErrorDetail.MISSING_FIELD);
        }

        // Prevent unwanted fields
        const allowedFields = ['displayName', 'email'];
        const providedFields = Object.keys(req.body);
        const invalidFields = providedFields.filter(field => !allowedFields.includes(field));
        if (invalidFields.length > 0) {
            throw Errors.invalidRequest('INVALID_FIELDS');
        }

        // Validate displayName if provided
        if (displayName !== undefined && (typeof displayName !== 'string' || displayName.trim().length === 0)) {
            throw Errors.validationError('displayName', ErrorDetail.MISSING_FIELD);
        }

        // Validate email if provided
        if (email !== undefined && (typeof email !== 'string' || !email.includes('@'))) {
            throw Errors.validationError('email', ErrorDetail.INVALID_EMAIL);
        }

        const requestingUser = (req as any).user;

        try {
            // Check if user exists
            const existingUser = await this.authService.getUser(userId);
            if (!existingUser) {
                throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
            }

            // Build update object
            const updates: { displayName?: string; email?: string } = {};
            if (displayName !== undefined) {
                updates.displayName = displayName.trim();
            }
            if (email !== undefined) {
                updates.email = email.trim().toLowerCase();
            }

            // Update Firebase Auth user
            await this.authService.updateUser(userId, updates);

            // Log the action for audit trail
            logger.info('Admin updated user profile', {
                actorUid: requestingUser?.uid,
                targetUid: userId,
                updatedFields: Object.keys(updates),
            });

            res.status(HTTP_STATUS.NO_CONTENT).send();
        } catch (error) {
            // Re-throw ApiError as-is
            if (error instanceof ApiError) {
                throw error;
            }

            logger.error('Failed to update user profile', error as Error, {
                actorUid: requestingUser?.uid,
                targetUid: userId,
            });

            throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
        }
    };
}
