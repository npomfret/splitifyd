import type { UserRegistration } from '@splitifyd/shared';
import { UserRegistrationBuilder } from '@splitifyd/test-support';
import { describe, expect, it } from 'vitest';
import { validateRegisterRequest } from '../../../auth/validation';
import { HTTP_STATUS } from '../../../constants';
import { ApiError } from '../../../utils/errors';
import {toDisplayName, toPassword} from "@splitifyd/shared";

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
        .withPassword('passwordpass')
        .withDisplayName('Test User')
        .withTermsAccepted(true)
        .withCookiePolicyAccepted(true)
        .withPrivacyPolicyAccepted(true)
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
                    .withPrivacyPolicyAccepted(validRegistrationData.privacyPolicyAccepted)
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
                    .withPrivacyPolicyAccepted(validRegistrationData.privacyPolicyAccepted)
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
            const data = new UserRegistrationBuilder()
                .from(validRegistrationData)
                .withEmail('  TEST@EXAMPLE.COM  ')
                .build();
            const result = validateRegisterRequest(data);
            expect(result.email).toBe('test@example.com');
        });
    });

    describe('Password Validation', () => {
        it('should accept any password that meets the minimum length requirement', () => {
            const validPasswords = [
                'passwordpass', // simple lowercase
                'aaaaaaaaaaaa', // repeated characters
                '123456789012', // numbers only
                '!!!!!!!!!!!!', // symbols only
                'MixedCASE1234', // mixed content
                'with spaces 123', // includes spaces
            ];

            for (const password of validPasswords) {
                const data = new UserRegistrationBuilder()
                    .from(validRegistrationData)
                    .withPassword(password)
                    .build();
                expect(() => validateRegisterRequest(data)).not.toThrow();
            }
        });

        it('should reject passwords shorter than 12 characters', () => {
            const tooShortPasswords = [
                'short', // 5 characters
                '12345678901', // 11 characters
                'password', // 8 characters
                '', // empty
                'twelvechars', // 11 characters
            ];

            for (const password of tooShortPasswords) {
                const data = new UserRegistrationBuilder()
                    .from(validRegistrationData)
                    .withPassword(password)
                    .build();
                expect(() => validateRegisterRequest(data)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: expect.stringMatching(/WEAK_PASSWORD|MISSING_PASSWORD/),
                        message: expect.stringMatching(/Password must be at least 12 characters long|Password is required/),
                    }),
                );
            }
        });

        it('should provide specific error message for passwords that are too short', () => {
            const data = new UserRegistrationBuilder()
                .from(validRegistrationData)
                .withPassword('tooshort')
                .build();
            expect(() => validateRegisterRequest(data)).toThrow(
                new ApiError(
                    HTTP_STATUS.BAD_REQUEST,
                    'WEAK_PASSWORD',
                    'Password must be at least 12 characters long',
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
                const data = new UserRegistrationBuilder()
                    .from(validRegistrationData)
                    .withDisplayName(displayName)
                    .build();
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
                const data = new UserRegistrationBuilder()
                    .from(validRegistrationData)
                    .withDisplayName(displayName)
                    .build();
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
            expect(() =>
                validateRegisterRequest(
                    new UserRegistrationBuilder()
                        .from(validRegistrationData)
                        .withDisplayName('A')
                        .build(),
                )
            )
                .toThrow(
                    expect.objectContaining({
                        code: 'DISPLAY_NAME_TOO_SHORT',
                        message: 'Display name must be at least 2 characters',
                    }),
                );

            // Too long
            expect(() =>
                validateRegisterRequest(
                    new UserRegistrationBuilder()
                        .from(validRegistrationData)
                        .withDisplayName('A'.repeat(51))
                        .build(),
                )
            )
                .toThrow(
                    expect.objectContaining({
                        code: 'DISPLAY_NAME_TOO_LONG',
                        message: 'Display name cannot exceed 50 characters',
                    }),
                );

            // Invalid characters
            expect(() =>
                validateRegisterRequest(
                    new UserRegistrationBuilder()
                        .from(validRegistrationData)
                        .withDisplayName('User@Name')
                        .build(),
                )
            )
                .toThrow(
                    expect.objectContaining({
                        code: 'INVALID_DISPLAY_NAME_CHARS',
                        message: 'Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods',
                    }),
                );
        });

        it('should trim whitespace from display names', () => {
            const data = new UserRegistrationBuilder()
                .from(validRegistrationData)
                .withDisplayName('  Test User  ')
                .build();
            const result = validateRegisterRequest(data);
            expect(result.displayName).toBe('Test User');
        });
    });

    describe('Required Fields Validation', () => {
        it('should require all mandatory fields', () => {
            const incompleteData = [
                { password: 'passwordpass', displayName: 'Test User', termsAccepted: true, cookiePolicyAccepted: true, privacyPolicyAccepted: true }, // missing email
                { email: 'test@example.com', displayName: 'Test User', termsAccepted: true, cookiePolicyAccepted: true, privacyPolicyAccepted: true }, // missing password
                { email: 'test@example.com', password: 'passwordpass', termsAccepted: true, cookiePolicyAccepted: true, privacyPolicyAccepted: true }, // missing displayName
                { email: 'test@example.com', password: 'passwordpass', displayName: 'Test User', cookiePolicyAccepted: true, privacyPolicyAccepted: true }, // missing termsAccepted
                { email: 'test@example.com', password: 'passwordpass', displayName: 'Test User', termsAccepted: true, privacyPolicyAccepted: true }, // missing cookiePolicyAccepted
                { email: 'test@example.com', password: 'passwordpass', displayName: 'Test User', termsAccepted: true, cookiePolicyAccepted: true }, // missing privacyPolicyAccepted
                {}, // missing all
            ];

            for (const data of incompleteData) {
                expect(() => validateRegisterRequest(data as any)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: expect.stringMatching(
                            /MISSING_EMAIL|MISSING_PASSWORD|MISSING_DISPLAY_NAME|TERMS_NOT_ACCEPTED|COOKIE_POLICY_NOT_ACCEPTED|PRIVACY_POLICY_NOT_ACCEPTED|MISSING_TERMS_ACCEPTANCE|MISSING_COOKIE_POLICY_ACCEPTANCE|MISSING_PRIVACY_POLICY_ACCEPTANCE/,
                        ),
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

        it('should require privacy policy acceptance to be exactly true', () => {
            const invalidPrivacyValues = [
                false,
                null,
                undefined,
                'true',
                1,
                0,
            ];

            for (const privacyPolicyAccepted of invalidPrivacyValues) {
                const data = new UserRegistrationBuilder()
                    .from(validRegistrationData)
                    .withPrivacyPolicyAccepted(privacyPolicyAccepted as any)
                    .build();
                expect(() => validateRegisterRequest(data as any)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: expect.stringMatching(/PRIVACY_POLICY_NOT_ACCEPTED|MISSING_PRIVACY_POLICY_ACCEPTANCE/),
                    }),
                );
            }
        });

        it('should provide specific error messages for policy acceptance', () => {
            // Terms not accepted
            expect(() =>
                validateRegisterRequest(
                    new UserRegistrationBuilder()
                        .from(validRegistrationData)
                        .withTermsAccepted(false)
                        .build(),
                )
            )
                .toThrow(
                    expect.objectContaining({
                        code: 'TERMS_NOT_ACCEPTED',
                        message: 'You must accept the Terms of Service',
                    }),
                );

            // Cookie policy not accepted
            expect(() =>
                validateRegisterRequest(
                    new UserRegistrationBuilder()
                        .from(validRegistrationData)
                        .withCookiePolicyAccepted(false)
                        .withPrivacyPolicyAccepted(true)
                        .build(),
                )
            )
                .toThrow(
                    expect.objectContaining({
                        code: 'COOKIE_POLICY_NOT_ACCEPTED',
                        message: 'You must accept the Cookie Policy',
                    }),
                );

            // Privacy policy not accepted
            expect(() =>
                validateRegisterRequest(
                    new UserRegistrationBuilder()
                        .from(validRegistrationData)
                        .withPrivacyPolicyAccepted(false)
                        .build(),
                )
            )
                .toThrow(
                    expect.objectContaining({
                        code: 'PRIVACY_POLICY_NOT_ACCEPTED',
                        message: 'You must accept the Privacy Policy',
                    }),
                );
        });
    });

    describe('Validation Error Handling', () => {
        it('should throw ApiError with proper structure', () => {
            const data = new UserRegistrationBuilder()
                .from(validRegistrationData)
                .withEmail('invalid-email')
                .build();

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
                privacyPolicyAccepted: false, // not accepted
            };

            // Should only report the first error (email in this case to match legacy validation order)
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
                password: toPassword('passwordpass'),
                displayName: toDisplayName('  Test User  '),
                termsAccepted: true,
                cookiePolicyAccepted: true,
                privacyPolicyAccepted: true,
            };

            const result = validateRegisterRequest(inputData);

            expect(result).toEqual({
                email: 'test@example.com', // normalized
                password: 'passwordpass', // unchanged
                displayName: 'Test User', // trimmed
                termsAccepted: true,
                cookiePolicyAccepted: true,
                privacyPolicyAccepted: true,
            });
        });

        it('should preserve password exactly as provided (no normalization)', () => {
            const data = new UserRegistrationBuilder()
                .from(validRegistrationData)
                .withPassword('  MyP@ssw0rd123!  ')
                .build();
            const result = validateRegisterRequest(data);
            expect(result.password).toBe('  MyP@ssw0rd123!  '); // Passwords should not be trimmed
        });
    });

    describe('Security Considerations', () => {
        it('should still reject common weak passwords that are shorter than 12 characters', () => {
            const commonWeakPasswords = ['password123', 'admin123', 'qwerty123', '12345678', 'password!', 'Password1'];

            for (const password of commonWeakPasswords) {
                const data = new UserRegistrationBuilder()
                    .from(validRegistrationData)
                    .withPassword(password)
                    .build();
                expect(() => validateRegisterRequest(data)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'WEAK_PASSWORD',
                    }),
                );
            }
        });

        it('should accept passwords that previously failed complexity checks when length requirement is satisfied', () => {
            const passwords = [
                'ONLYUPPERCASE123!', // uppercase only previously failed lowercase check
                'onlylowercasepass', // lowercase only
                'OnlyLettersHere', // letters only
                'NoSpecials1234', // alphanumeric without special characters
            ];

            for (const password of passwords) {
                const data = new UserRegistrationBuilder()
                    .from(validRegistrationData)
                    .withPassword(password.length >= 12 ? password : `${password}_____`) // ensure length >= 12
                    .build();
                expect(() => validateRegisterRequest(data)).not.toThrow();
            }
        });
    });
});
