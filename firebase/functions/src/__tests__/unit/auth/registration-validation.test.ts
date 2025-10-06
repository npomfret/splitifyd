import { describe, it, expect } from 'vitest';
import { validateRegisterRequest } from '../../../auth/validation';
import { HTTP_STATUS } from '../../../constants';
import { ApiError } from '../../../utils/errors';
import { UserRegistrationBuilder } from '@splitifyd/test-support';
import type { UserRegistration } from '@splitifyd/shared';

/**
 * Registration Validation Unit Tests
 *
 * This file provides comprehensive unit test coverage for user registration validation
 * that replaces the slower integration tests. These tests focus on the validation logic
 * using direct function calls rather than HTTP API endpoints.
 *
 * These tests replace validation scenarios from:
 * - firebase/functions/src/__tests__/integration/auth-and-registration.test.ts
 */
describe('Registration Validation - Unit Tests (Replacing Integration)', () => {
    const validRegistrationData: UserRegistration = new UserRegistrationBuilder()
        .withEmail('test@example.com')
        .withPassword('SecurePass123!')
        .withDisplayName('Test User')
        .withTermsAccepted(true)
        .withCookiePolicyAccepted(true)
        .build();

    describe('Email Validation', () => {
        it('should accept valid email formats', () => {
            const validEmails = ['user@example.com', 'test.email@domain.org', 'user+tag@example.com', 'user123@test-domain.net', 'a@b.co'];

            for (const email of validEmails) {
                const data = new UserRegistrationBuilder()
                    .withEmail(email)
                    .withPassword(validRegistrationData.password)
                    .withDisplayName(validRegistrationData.displayName)
                    .withTermsAccepted(validRegistrationData.termsAccepted)
                    .withCookiePolicyAccepted(validRegistrationData.cookiePolicyAccepted)
                    .build();
                expect(() => validateRegisterRequest(data)).not.toThrow();
            }
        });

        it('should reject invalid email formats', () => {
            const invalidEmails = ['invalid-email', '@domain.com', 'user@', 'user..double@domain.com', 'user@domain', '', 'user@.com', 'user@domain.', 'user space@domain.com'];

            for (const email of invalidEmails) {
                const data = new UserRegistrationBuilder()
                    .withEmail(email)
                    .withPassword(validRegistrationData.password)
                    .withDisplayName(validRegistrationData.displayName)
                    .withTermsAccepted(validRegistrationData.termsAccepted)
                    .withCookiePolicyAccepted(validRegistrationData.cookiePolicyAccepted)
                    .build();
                expect(() => validateRegisterRequest(data)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: expect.stringMatching(/INVALID_EMAIL_FORMAT|MISSING_EMAIL/),
                        message: expect.stringMatching(/Invalid email format|Email is required/),
                    }),
                );
            }
        });

        it('should normalize email to lowercase and trim whitespace', () => {
            const data = new UserRegistrationBuilder().from(validRegistrationData).withEmail('  TEST@EXAMPLE.COM  ').build();
            const result = validateRegisterRequest(data);
            expect(result.email).toBe('test@example.com');
        });
    });

    describe('Password Validation', () => {
        it('should accept strong passwords', () => {
            const strongPasswords = ['SecurePass123!', 'MyP@ssw0rd2024', 'Tr0ub4dor&3', 'Complex!Pass1', 'Str0ng&Secure!'];

            for (const password of strongPasswords) {
                const data = new UserRegistrationBuilder().from(validRegistrationData).withPassword(password).build();
                expect(() => validateRegisterRequest(data)).not.toThrow();
            }
        });

        it('should reject weak passwords', () => {
            const weakPasswords = [
                '123456', // too simple
                'password', // no uppercase, numbers, or special chars
                'abc', // too short
                '', // empty
                '12345', // too short, no letters
                'qwerty', // common weak password
                'password123', // no special chars or uppercase
                'PASSWORD123!', // no lowercase
                'password!', // no numbers or uppercase
                'Password123', // no special characters
                'Pass1!', // too short
            ];

            for (const password of weakPasswords) {
                const data = new UserRegistrationBuilder().from(validRegistrationData).withPassword(password).build();
                expect(() => validateRegisterRequest(data)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: expect.stringMatching(/WEAK_PASSWORD|MISSING_PASSWORD/),
                        message: expect.stringMatching(/Password must contain at least 8 characters|Password is required/),
                    }),
                );
            }
        });

        it('should provide specific error message for password requirements', () => {
            const data = new UserRegistrationBuilder().from(validRegistrationData).withPassword('weak').build();
            expect(() => validateRegisterRequest(data)).toThrow(
                new ApiError(
                    HTTP_STATUS.BAD_REQUEST,
                    'WEAK_PASSWORD',
                    'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character',
                ),
            );
        });
    });

    describe('Display Name Validation', () => {
        it('should accept valid display names', () => {
            const validNames = [
                'John Doe',
                'User123',
                'Test-User',
                'user_name',
                'User.Name',
                'AB', // minimum length
                'A'.repeat(50), // maximum length
            ];

            for (const displayName of validNames) {
                const data = new UserRegistrationBuilder().from(validRegistrationData).withDisplayName(displayName).build();
                expect(() => validateRegisterRequest(data)).not.toThrow();
            }
        });

        it('should reject invalid display names', () => {
            const invalidNames = [
                '', // empty
                'A', // too short
                'A'.repeat(51), // too long (over 50 chars)
                'A'.repeat(256), // way too long
                'User@Name', // invalid character @
                'User#Name', // invalid character #
                'User$Name', // invalid character $
                'User%Name', // invalid character %
                'User&Name', // invalid character &
                'User*Name', // invalid character *
                'User(Name)', // invalid characters ()
            ];

            for (const displayName of invalidNames) {
                const data = new UserRegistrationBuilder().from(validRegistrationData).withDisplayName(displayName).build();
                expect(() => validateRegisterRequest(data)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: expect.stringMatching(/DISPLAY_NAME_TOO_SHORT|DISPLAY_NAME_TOO_LONG|INVALID_DISPLAY_NAME_CHARS|MISSING_DISPLAY_NAME/),
                    }),
                );
            }
        });

        it('should provide specific error messages for display name issues', () => {
            // Too short
            expect(() => validateRegisterRequest(new UserRegistrationBuilder().from(validRegistrationData).withDisplayName('A').build())).toThrow(
                expect.objectContaining({
                    code: 'DISPLAY_NAME_TOO_SHORT',
                    message: 'Display name must be at least 2 characters',
                }),
            );

            // Too long
            expect(() => validateRegisterRequest(new UserRegistrationBuilder().from(validRegistrationData).withDisplayName('A'.repeat(51)).build())).toThrow(
                expect.objectContaining({
                    code: 'DISPLAY_NAME_TOO_LONG',
                    message: 'Display name cannot exceed 50 characters',
                }),
            );

            // Invalid characters
            expect(() => validateRegisterRequest(new UserRegistrationBuilder().from(validRegistrationData).withDisplayName('User@Name').build())).toThrow(
                expect.objectContaining({
                    code: 'INVALID_DISPLAY_NAME_CHARS',
                    message: 'Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods',
                }),
            );
        });

        it('should trim whitespace from display names', () => {
            const data = new UserRegistrationBuilder().from(validRegistrationData).withDisplayName('  Test User  ').build();
            const result = validateRegisterRequest(data);
            expect(result.displayName).toBe('Test User');
        });
    });

    describe('Required Fields Validation', () => {
        it('should require all mandatory fields', () => {
            const incompleteData = [
                { password: 'Password123!', displayName: 'Test User', termsAccepted: true, cookiePolicyAccepted: true }, // missing email
                { email: 'test@example.com', displayName: 'Test User', termsAccepted: true, cookiePolicyAccepted: true }, // missing password
                { email: 'test@example.com', password: 'Password123!', termsAccepted: true, cookiePolicyAccepted: true }, // missing displayName
                { email: 'test@example.com', password: 'Password123!', displayName: 'Test User', cookiePolicyAccepted: true }, // missing termsAccepted
                { email: 'test@example.com', password: 'Password123!', displayName: 'Test User', termsAccepted: true }, // missing cookiePolicyAccepted
                {}, // missing all
            ];

            for (const data of incompleteData) {
                expect(() => validateRegisterRequest(data as any)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: expect.stringMatching(/MISSING_EMAIL|MISSING_PASSWORD|MISSING_DISPLAY_NAME|MISSING_TERMS_ACCEPTANCE|MISSING_COOKIE_POLICY_ACCEPTANCE/),
                    }),
                );
            }
        });
    });

    describe('Terms and Policy Acceptance Validation', () => {
        it('should require terms acceptance to be exactly true', () => {
            const invalidTermsValues = [
                false,
                null,
                undefined,
                'true', // string instead of boolean
                1, // number instead of boolean
                0, // number instead of boolean
            ];

            for (const termsAccepted of invalidTermsValues) {
                const data = new UserRegistrationBuilder()
                    .from(validRegistrationData)
                    .withTermsAccepted(termsAccepted as any)
                    .build();
                expect(() => validateRegisterRequest(data as any)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: expect.stringMatching(/TERMS_NOT_ACCEPTED|MISSING_TERMS_ACCEPTANCE/),
                    }),
                );
            }
        });

        it('should require cookie policy acceptance to be exactly true', () => {
            const invalidCookiePolicyValues = [
                false,
                null,
                undefined,
                'true', // string instead of boolean
                1, // number instead of boolean
                0, // number instead of boolean
            ];

            for (const cookiePolicyAccepted of invalidCookiePolicyValues) {
                const data = new UserRegistrationBuilder()
                    .from(validRegistrationData)
                    .withCookiePolicyAccepted(cookiePolicyAccepted as any)
                    .build();
                expect(() => validateRegisterRequest(data as any)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: expect.stringMatching(/COOKIE_POLICY_NOT_ACCEPTED|MISSING_COOKIE_POLICY_ACCEPTANCE/),
                    }),
                );
            }
        });

        it('should provide specific error messages for policy acceptance', () => {
            // Terms not accepted
            expect(() => validateRegisterRequest(new UserRegistrationBuilder().from(validRegistrationData).withTermsAccepted(false).build())).toThrow(
                expect.objectContaining({
                    code: 'TERMS_NOT_ACCEPTED',
                    message: 'You must accept the Terms of Service',
                }),
            );

            // Cookie policy not accepted
            expect(() => validateRegisterRequest(new UserRegistrationBuilder().from(validRegistrationData).withCookiePolicyAccepted(false).build())).toThrow(
                expect.objectContaining({
                    code: 'COOKIE_POLICY_NOT_ACCEPTED',
                    message: 'You must accept the Cookie Policy',
                }),
            );
        });
    });

    describe('Validation Error Handling', () => {
        it('should throw ApiError with proper structure', () => {
            const data = new UserRegistrationBuilder().from(validRegistrationData).withEmail('invalid-email').build();

            try {
                validateRegisterRequest(data);
                throw new Error('Expected validation to throw an error');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect(error).toHaveProperty('statusCode', HTTP_STATUS.BAD_REQUEST);
                expect(error).toHaveProperty('code');
                expect(error).toHaveProperty('message');
            }
        });

        it('should report the first validation error when multiple errors exist', () => {
            // Data with multiple validation errors
            const data = {
                email: 'invalid-email', // invalid format
                password: 'weak', // too weak
                displayName: '', // empty
                termsAccepted: false, // not accepted
                cookiePolicyAccepted: false, // not accepted
            };

            // Should only report the first error (email in this case due to Joi validation order)
            expect(() => validateRegisterRequest(data as any)).toThrow(
                expect.objectContaining({
                    code: 'INVALID_EMAIL_FORMAT',
                }),
            );
        });
    });

    describe('Valid Registration Data Processing', () => {
        it('should return processed and normalized data for valid input', () => {
            const inputData = {
                email: '  TEST@EXAMPLE.COM  ',
                password: 'SecurePass123!',
                displayName: '  Test User  ',
                termsAccepted: true,
                cookiePolicyAccepted: true,
            };

            const result = validateRegisterRequest(inputData);

            expect(result).toEqual({
                email: 'test@example.com', // normalized
                password: 'SecurePass123!', // unchanged
                displayName: 'Test User', // trimmed
                termsAccepted: true,
                cookiePolicyAccepted: true,
            });
        });

        it('should preserve password exactly as provided (no normalization)', () => {
            const data = new UserRegistrationBuilder().from(validRegistrationData).withPassword('  MyP@ssw0rd123!  ').build();
            const result = validateRegisterRequest(data);
            expect(result.password).toBe('  MyP@ssw0rd123!  '); // Passwords should not be trimmed
        });
    });

    describe('Security Considerations', () => {
        it('should reject common weak passwords', () => {
            const commonWeakPasswords = ['password123', 'admin123', 'qwerty123', '12345678', 'password!', 'Password1'];

            for (const password of commonWeakPasswords) {
                const data = new UserRegistrationBuilder().from(validRegistrationData).withPassword(password).build();
                expect(() => validateRegisterRequest(data)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'WEAK_PASSWORD',
                    }),
                );
            }
        });

        it('should enforce minimum password complexity', () => {
            // Test each complexity requirement individually
            const insufficientPasswords = [
                'ONLYUPPERCASE123!', // no lowercase
                'onlylowercase123!', // no uppercase
                'OnlyLetters!', // no numbers
                'OnlyAlphaNum123', // no special characters
            ];

            for (const password of insufficientPasswords) {
                const data = new UserRegistrationBuilder().from(validRegistrationData).withPassword(password).build();
                expect(() => validateRegisterRequest(data)).toThrow(
                    expect.objectContaining({
                        code: 'WEAK_PASSWORD',
                    }),
                );
            }
        });
    });
});
