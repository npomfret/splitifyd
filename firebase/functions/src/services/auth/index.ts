/**
 * Auth Service Module Exports
 *
 * Centralized exports for the auth service module.
 * Provides easy access to all auth-related types and implementations.
 */

// Core interface and implementations
export { IAuthService } from './IAuthService';
export { FirebaseAuthService } from './FirebaseAuthService';

// Types and interfaces (only shared/public types)
// Note: Internal implementation types are now co-located within FirebaseAuthService.ts
// Note: AuthErrorCode and FIREBASE_AUTH_ERROR_MAP are unused externally

// Validation functions are used internally and don't need to be exported

// Validation schemas are used internally and don't need to be exported
