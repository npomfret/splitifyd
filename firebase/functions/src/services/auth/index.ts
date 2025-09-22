/**
 * Auth Service Module Exports
 *
 * Centralized exports for the auth service module.
 * Provides easy access to all auth-related types and implementations.
 */

// Core interface and implementations
export { IAuthService } from './IAuthService';
export { FirebaseAuthService } from './FirebaseAuthService';

// Types and interfaces
export type {
    CreateUserResult,
    UpdateUserResult,
    DeleteUserResult,
    BatchUserOperationResult,
    ValidatedCreateUserRequest,
    ValidatedUpdateUserRequest,
    ListUsersOptions,
    TokenVerificationOptions,
    CustomUserClaims,
    AuthServiceConfig,
    AuthOperationContext,
    AuthServiceMetrics,
    PasswordPolicy,
    UserProfile,
} from './auth-types';

export { AuthErrorCode, FIREBASE_AUTH_ERROR_MAP } from './auth-types';

// Validation functions
export {
    validateCreateUser,
    validateUpdateUser,
    validateUserId,
    validateEmail,
    validatePhoneNumber,
    validateIdToken,
    validateCustomClaims,
    validateListUsersOptions,
    validateBatchUserIds,
} from './auth-validation';

// Validation schemas (for direct use if needed)
export { createUserSchema, updateUserSchema, userIdSchema, emailSchema, phoneNumberSchema, idTokenSchema, customClaimsSchema, listUsersOptionsSchema, batchUserIdsSchema } from './auth-validation';
