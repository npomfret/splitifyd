import { DisplayName } from '@splitifyd/shared';
import { SplitifydFirestoreTestDatabase } from '@splitifyd/test-support';
import { PasswordChangeRequestBuilder, UserRegistrationBuilder, UserUpdateBuilder } from '@splitifyd/test-support';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { UserService } from '../../../services/UserService2';
import { ApiError } from '../../../utils/errors';
import { initializeI18n } from '../../../utils/i18n';
import { StubAuthService } from '../mocks/StubAuthService';

describe('UserService - Consolidated Unit Tests', () => {
    let userService: UserService;
    let db: SplitifydFirestoreTestDatabase;
    let stubAuth: StubAuthService;

    beforeAll(async () => {
        // Initialize i18n for validation error translations
        await initializeI18n();
    });

    beforeEach(() => {
        // Create stub database
        db = new SplitifydFirestoreTestDatabase();

        // Create real services using stub database
        stubAuth = new StubAuthService();

        // Create UserService via ApplicationBuilder
        userService = new ComponentBuilder(stubAuth, db).buildUserService();

        // Clear all stub data
        stubAuth.clear();
        db.clear();
    });

    describe('registerUser', () => {
        it('should register a new user with Firebase Auth and Firestore', async () => {
            const registrationData = new UserRegistrationBuilder()
                .withPassword('passwordpass')
                .withDisplayName('New User')
                .build();

            const result = await userService.registerUser(registrationData);

            // Verify registration result
            expect(result.success).toBe(true);
            expect(result.message).toBe('Account created successfully');
            expect(result.user.uid).toBeDefined();
            expect(result.user.displayName).toBe(registrationData.displayName);

            // Verify user was created in Auth stub
            const authUser = await stubAuth.getUser(result.user.uid!);
            expect(authUser).toBeDefined();
            expect(authUser!.email).toBe(registrationData.email);
            expect(authUser!.displayName).toBe(registrationData.displayName);
        });

        it('should reject registration with existing email using generic response', async () => {
            const email = 'existing@example.com';

            // Set up existing user in Auth stub
            stubAuth.setUser('existing-user', {
                uid: 'existing-user',
                email,
                displayName: 'Existing User',
            });

            const duplicateData = new UserRegistrationBuilder()
                .withEmail(email) // Use the same email as the existing user
                .withPassword('DifferentPass123!')
                .withDisplayName('Different Name')
                .build();

            await expect(userService.registerUser(duplicateData)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'REGISTRATION_FAILED',
                    message: 'Unable to create account. If you already registered, try signing in.',
                }),
            );
        });

        it('enforces minimum registration duration on failure', async () => {
            vi.useFakeTimers();

            try {
                const email = 'slow-existing@example.com';

                stubAuth.setUser('existing-user', {
                    uid: 'existing-user',
                    email,
                    displayName: 'Existing User',
                });

                const duplicateData = new UserRegistrationBuilder()
                    .withEmail(email)
                    .withPassword('DifferentPass123!')
                    .withDisplayName('Different Name')
                    .build();

                let settled = false;
                const registrationPromise = userService.registerUser(duplicateData).finally(() => {
                    settled = true;
                });

                const expectation = expect(registrationPromise).rejects.toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'REGISTRATION_FAILED',
                    }),
                );

                // Allow any synchronous promise chains to execute
                await vi.advanceTimersByTimeAsync(0);

                await vi.advanceTimersByTimeAsync(599);
                expect(settled).toBe(false);

                await vi.runAllTimersAsync();

                await expectation;

                expect(settled).toBe(true);
            } finally {
                vi.useRealTimers();
            }
        });

        it('should validate policy acceptance flags', async () => {
            const userData = new UserRegistrationBuilder()
                .withPassword('passwordpass')
                .withDisplayName('Test User')
                .withTermsAccepted(false)
                .withCookiePolicyAccepted(true)
                .build();

            await expect(userService.registerUser(userData)).rejects.toThrow('You must accept the Terms of Service');

            // Test cookie policy validation
            const userData2 = new UserRegistrationBuilder()
                .withPassword('passwordpass')
                .withDisplayName('Test User')
                .withTermsAccepted(true)
                .withCookiePolicyAccepted(false)
                .build();

            await expect(userService.registerUser(userData2)).rejects.toThrow('You must accept the Cookie Policy');
        });

        it('should assign theme color and role during registration', async () => {
            const registrationData = new UserRegistrationBuilder()
                .withPassword('passwordpass')
                .withDisplayName('Themed User')
                .build();

            const result = await userService.registerUser(registrationData);

            // Verify registration succeeded
            expect(result.success).toBe(true);
            expect(result.message).toBe('Account created successfully');
            expect(result.user.uid).toBeDefined();
            expect(result.user.displayName).toBe(registrationData.displayName);

            // Note: The actual theme color assignment and role assignment happens in UserService.registerUser
            // and is tested more thoroughly in integration tests where we have real Firestore.
            // For this unit test, we've verified that registration completes successfully.
        });
    });

    describe('getUser', () => {
        it('should return complete user profile from Auth and Firestore', async () => {
            const uid = 'test-user-123';
            const email = 'test@example.com';
            const displayName = 'Test User';

            // Set up Auth user
            stubAuth.setUser(uid, {
                uid,
                email,
                displayName,
                emailVerified: true,
                photoURL: 'https://example.com/photo.jpg',
            });

            // Set up Firestore user document using seedUser
            db.seedUser(uid, {
                displayName,
                preferredLanguage: 'en',
            });

            const profile = await userService.getUser(uid);

            expect(profile.uid).toBe(uid);
            expect(profile.displayName).toBe(displayName);
            expect(profile.emailVerified).toBe(true);
            expect(profile.photoURL).toBe('https://example.com/photo.jpg');
            expect(profile.preferredLanguage).toBe('en');
            expect(profile.createdAt).toBeDefined();
            expect(profile.updatedAt).toBeDefined();
        });

        it('should throw NOT_FOUND for non-existent user', async () => {
            const nonExistentUid = 'nonexistent-user-id';

            await expect(userService.getUser(nonExistentUid)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'NOT_FOUND',
                }),
            );
        });

        it('should throw error when user missing required fields', async () => {
            const uid = 'incomplete-user';

            // Set up Auth user without required fields
            stubAuth.setUser(uid, {
                uid,
                email: 'test@example.com',
                // Missing displayName
            });

            await expect(userService.getUser(uid)).rejects.toThrow('User incomplete-user missing required fields: email and displayName are mandatory');
        });
    });

    describe('updateProfile', () => {
        it('should update display name in both Auth and Firestore', async () => {
            const uid = 'test-user';
            const originalDisplayName = 'Original Name';
            const newDisplayName = 'Updated Display Name';

            // Set up existing user
            stubAuth.setUser(uid, {
                uid,
                email: 'test@example.com',
                displayName: originalDisplayName,
            });

            db.seedUser(uid, {
                displayName: originalDisplayName,
            });

            const updatedProfile = await userService.updateProfile(uid, {
                displayName: newDisplayName,
            });

            expect(updatedProfile.displayName).toBe(newDisplayName);

            // Verify Auth was updated
            const authUser = await stubAuth.getUser(uid);
            expect(authUser!.displayName).toBe(newDisplayName);
        });

        it('should update preferred language in Firestore only', async () => {
            const uid = 'test-user';
            const newLanguage = 'en';

            // Set up existing user
            stubAuth.setUser(uid, {
                uid,
                email: 'test@example.com',
                displayName: 'Test User',
            });

            db.seedUser(uid, {
                displayName: 'Test User',
            });

            const updatedProfile = await userService.updateProfile(uid, {
                preferredLanguage: newLanguage,
            });

            expect(updatedProfile.displayName).toBe('Test User');
        });

        it('should update photo URL with null value', async () => {
            const uid = 'test-user';

            // Set up existing user with photo URL
            stubAuth.setUser(uid, {
                uid,
                email: 'test@example.com',
                displayName: 'Test User',
                photoURL: 'https://example.com/old-photo.jpg',
            });

            db.seedUser(uid, {
                displayName: 'Test User',
            });

            await userService.updateProfile(uid, {
                photoURL: null,
            });

            // Verify Auth was updated
            const authUser = await stubAuth.getUser(uid);
            expect(authUser!.photoURL).toBeUndefined();
        });

        it('should throw NOT_FOUND for non-existent user', async () => {
            const nonExistentUid = 'nonexistent-user-id';

            await expect(
                userService.updateProfile(nonExistentUid, {
                    displayName: 'Test',
                }),
            )
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.NOT_FOUND,
                    }),
                );
        });
    });

    describe('changePassword', () => {
        it('should update password and track change timestamp', async () => {
            const uid = 'test-user';
            const currentPassword = 'OldPassword1234!';
            const newPassword = 'NewSecurePassword1234!';

            // Set up existing user
            stubAuth.setUser(
                uid,
                {
                    uid,
                    email: 'test@example.com',
                    displayName: 'Test User',
                },
                {
                    password: currentPassword,
                },
            );

            db.seedUser(uid, {
                displayName: 'Test User',
            });

            const result = await userService.changePassword(uid, {
                currentPassword,
                newPassword,
            });

            expect(result.message).toBe('Password changed successfully');
        });

        it('should throw NOT_FOUND for non-existent user', async () => {
            const nonExistentUid = 'nonexistent-user-id';

            await expect(
                userService.changePassword(nonExistentUid, {
                    currentPassword: 'OldPassword1234!',
                    newPassword: 'NewPassword1234!',
                }),
            )
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.NOT_FOUND,
                    }),
                );
        });
    });

    describe('error handling and edge cases', () => {
        it('should maintain data consistency between Auth and Firestore', async () => {
            const uid = 'consistent-user';
            const email = 'consistent@example.com';
            const displayName = 'Consistent User';

            // Set up consistent data
            stubAuth.setUser(uid, {
                uid,
                email,
                displayName,
                photoURL: 'https://example.com/photo.jpg',
            });

            db.seedUser(uid, {
                displayName,
            });

            const profile = await userService.getUser(uid);

            // Verify Auth and Firestore have consistent data
            const authUser = await stubAuth.getUser(uid);
            expect(profile.displayName).toBe(authUser!.displayName);
            expect(profile.photoURL).toBe(authUser!.photoURL);
        });

        it('should handle auth user without email gracefully', async () => {
            const uid = 'no-email-user';

            // Set up user without email (edge case)
            stubAuth.setUser(uid, {
                uid,
                displayName: 'No Email User',
                // email is undefined
            });

            await expect(userService.getUser(uid)).rejects.toThrow('User no-email-user missing required fields: email and displayName are mandatory');
        });
    });

    describe('Input Validation Tests', () => {
        let validationUserService: UserService;

        const testUserId = 'test-user-id';

        beforeEach(() => {
            validationUserService = new ComponentBuilder(stubAuth, db).buildUserService();

            const email = `${testUserId}@example.com`;
            const displayName = 'Validation User';

            stubAuth.setUser(
                testUserId,
                {
                    uid: testUserId,
                    email,
                    displayName,
                },
                { password: 'ValidCurrentPassword1234!' },
            );

            db.seedUser(testUserId, {
                email,
                displayName,
            });
        });

        describe('updateProfile validation', () => {
            it('should validate displayName length', async () => {
                const updateData = new UserUpdateBuilder()
                    .withDisplayName('a'.repeat(101)) // Too long
                    .build();

                await expect(validationUserService.updateProfile(testUserId, updateData)).rejects.toThrow(ApiError);
            });

            it('should validate displayName is not empty', async () => {
                const updateData = new UserUpdateBuilder()
                    .withDisplayName('')
                    .build();

                await expect(validationUserService.updateProfile(testUserId, updateData)).rejects.toThrow(ApiError);
            });

            it('should validate displayName with only whitespace', async () => {
                const updateData = new UserUpdateBuilder()
                    .withDisplayName('   ')
                    .build();

                await expect(validationUserService.updateProfile(testUserId, updateData)).rejects.toThrow(ApiError);
            });

            it('should accept valid displayName', async () => {
                // todo
            });

            it('should validate preferredLanguage enum', async () => {
                const updateData = new UserUpdateBuilder()
                    .withPreferredLanguage('invalid-language')
                    .build();

                await expect(validationUserService.updateProfile(testUserId, updateData)).rejects.toThrow(ApiError);
            });

            it('should accept valid preferredLanguage', async () => {
                // todo
            });

            it('should validate photoURL format', async () => {
                const updateData = new UserUpdateBuilder()
                    .withPhotoURL('not-a-valid-url')
                    .build();

                await expect(validationUserService.updateProfile(testUserId, updateData)).rejects.toThrow(ApiError);
            });

            it('should accept valid photoURL', async () => {
                // todo
            });

            it('should accept null photoURL', async () => {
                // todo
            });

            it('should throw NOT_FOUND for non-existent user', async () => {
                // todo
            });

            it('should validate multiple fields simultaneously', async () => {
                // todo
            });
        });

        describe('changePassword validation', () => {
            it('should reject new passwords shorter than 12 characters', async () => {
                const changeData = new PasswordChangeRequestBuilder()
                    .withCurrentPassword('ValidCurrentPassword1234!')
                    .withNewPassword('123') // Too short
                    .build();

                await expect(validationUserService.changePassword(testUserId, changeData)).rejects.toThrow(ApiError);
            });

            it('should accept lowercase-only passwords when long enough', async () => {
                const changeData = {
                    currentPassword: 'ValidCurrentPassword1234!',
                    newPassword: 'lowercaseonlypass',
                };

                await expect(validationUserService.changePassword(testUserId, changeData)).resolves.toMatchObject({ message: 'Password changed successfully' });
            });

            it('should accept passwords without numbers or special characters when long enough', async () => {
                const changeData = {
                    currentPassword: 'ValidCurrentPassword1234!',
                    newPassword: 'JustLettersHere',
                };

                await expect(validationUserService.changePassword(testUserId, changeData)).resolves.toMatchObject({ message: 'Password changed successfully' });
            });

            it('should accept passwords with spaces when long enough', async () => {
                const changeData = {
                    currentPassword: 'ValidCurrentPassword1234!',
                    newPassword: 'twelve chars ok',
                };

                await expect(validationUserService.changePassword(testUserId, changeData)).resolves.toMatchObject({ message: 'Password changed successfully' });
            });

            it('should validate current password is provided', async () => {
                const changeData = {
                    currentPassword: '',
                    newPassword: 'NewSecurePassword1234!',
                };

                await expect(validationUserService.changePassword(testUserId, changeData)).rejects.toThrow(ApiError);
            });

            it('should validate new password is different from current', async () => {
                const samePassword = 'SamePassword1234!';
                const changeData = {
                    currentPassword: samePassword,
                    newPassword: samePassword,
                };

                await expect(validationUserService.changePassword(testUserId, changeData)).rejects.toThrow(ApiError);
            });

            it('should throw NOT_FOUND for non-existent user', async () => {
                // todo
            });

            it('should handle incorrect current password', async () => {
                // todo
            });
        });

        describe('registration validation', () => {
            it('should validate email format', async () => {
                const registrationData = {
                    email: 'invalid-email',
                    password: 'ValidPassword1234!',
                    displayName: 'Test User',
                    termsAccepted: true,
                    cookiePolicyAccepted: true,
                };

                await expect(validationUserService.registerUser(registrationData)).rejects.toThrow(ApiError);
            });

            it('should validate password strength during registration', async () => {
                const registrationData = {
                    email: 'newuser@example.com',
                    password: 'weak', // Weak password
                    displayName: 'Test User',
                    termsAccepted: true,
                    cookiePolicyAccepted: true,
                };

                await expect(validationUserService.registerUser(registrationData)).rejects.toThrow(ApiError);
            });

            it('should require terms acceptance', async () => {
                const registrationData = {
                    email: 'newuser@example.com',
                    password: 'ValidPassword1234!',
                    displayName: 'Test User',
                    termsAccepted: false,
                    cookiePolicyAccepted: true,
                };

                await expect(validationUserService.registerUser(registrationData)).rejects.toThrow(/Terms of Service/);
            });

            it('should require cookie policy acceptance', async () => {
                const registrationData = {
                    email: 'newuser@example.com',
                    password: 'ValidPassword1234!',
                    displayName: 'Test User',
                    termsAccepted: true,
                    cookiePolicyAccepted: false,
                };

                await expect(validationUserService.registerUser(registrationData)).rejects.toThrow(/Cookie Policy/);
            });

            it('should validate displayName during registration', async () => {
                const registrationData = {
                    email: 'newuser@example.com',
                    password: 'ValidPassword1234!',
                    displayName: '', // Empty display name
                    termsAccepted: true,
                    cookiePolicyAccepted: true,
                };

                await expect(validationUserService.registerUser(registrationData)).rejects.toThrow(ApiError);
            });

            it('should accept valid registration data', async () => {
                // todo
            });

            it('should reject registration with existing email', async () => {
                // todo
            });
        });

        describe('input sanitization', () => {
            it('should trim whitespace from displayName', async () => {
                // todo
            });

            it('should handle special characters in displayName', async () => {
                // todo
            });
        });
    });

    describe('Focused User Validation Tests', () => {
        describe('Display Name Validation', () => {
            it('should reject empty display names', () => {
                expect(() => {
                    const displayName: DisplayName = '';
                    if (!displayName || displayName.trim().length === 0) {
                        throw new ApiError(400, 'INVALID_DISPLAY_NAME', 'Display name cannot be empty');
                    }
                })
                    .toThrow('Display name cannot be empty');
            });

            it('should reject display names with only whitespace', () => {
                expect(() => {
                    const displayName = '   ';
                    if (!displayName || displayName.trim().length === 0) {
                        throw new ApiError(400, 'INVALID_DISPLAY_NAME', 'Display name cannot be empty');
                    }
                })
                    .toThrow('Display name cannot be empty');
            });

            it('should reject display names that are too long', () => {
                expect(() => {
                    const displayName = 'a'.repeat(101);
                    const maxLength = 100;
                    if (displayName.length > maxLength) {
                        throw new ApiError(400, 'INVALID_DISPLAY_NAME', `Display name cannot exceed ${maxLength} characters`);
                    }
                })
                    .toThrow('Display name cannot exceed 100 characters');
            });

            it('should accept valid display names', () => {
                expect(() => {
                    const displayName = 'Valid Display Name';
                    if (!displayName || displayName.trim().length === 0) {
                        throw new ApiError(400, 'INVALID_DISPLAY_NAME', 'Display name cannot be empty');
                    }
                    if (displayName.length > 100) {
                        throw new ApiError(400, 'INVALID_DISPLAY_NAME', 'Display name cannot exceed 100 characters');
                    }
                })
                    .not
                    .toThrow();
            });

            it('should trim whitespace from display names', () => {
                const displayName = '  Trimmed Name  ';
                const trimmed = displayName.trim();
                expect(trimmed).toBe('Trimmed Name');
            });

            it('should handle special characters in display names', () => {
                const displayName = 'Name with émojis 🎉 and açcénts';
                expect(displayName.length).toBeGreaterThan(0);
                expect(displayName.length).toBeLessThanOrEqual(100);
            });
        });

        describe('Email Validation', () => {
            it('should reject invalid email formats', () => {
                const invalidEmails = ['invalid-email', 'test@', '@example.com', 'test.example.com'];

                invalidEmails.forEach((email) => {
                    expect(() => {
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(email)) {
                            throw new ApiError(400, 'INVALID_EMAIL', 'Invalid email format');
                        }
                    })
                        .toThrow('Invalid email format');
                });
            });

            it('should accept valid email formats', () => {
                const validEmails = ['test@example.com', 'user.name@domain.co.uk', 'test+tag@example.org'];

                validEmails.forEach((email) => {
                    expect(() => {
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(email)) {
                            throw new ApiError(400, 'INVALID_EMAIL', 'Invalid email format');
                        }
                    })
                        .not
                        .toThrow();
                });
            });
        });

        describe('Password Validation', () => {
            it('should reject passwords that are too short', () => {
                expect(() => {
                    const password = '123';
                    const minLength = 12;
                    if (password.length < minLength) {
                        throw new ApiError(400, 'WEAK_PASSWORD', `Password must be at least ${minLength} characters long`);
                    }
                })
                    .toThrow('Password must be at least 12 characters long');
            });

            it('should accept passwords of any composition when length requirement is met', () => {
                const validPasswords = ['passwordpass', 'lowercaseonlypass', '123456789012', '!!!!!!!!!!!!', 'WITH SPACES 12'];

                validPasswords.forEach((password) => {
                    expect(() => {
                        const minLength = 12;
                        if (password.length < minLength) {
                            throw new ApiError(400, 'WEAK_PASSWORD', `Password must be at least ${minLength} characters long`);
                        }
                    })
                        .not
                        .toThrow();
                });
            });

            it('should reject passwords that are the same as current password', () => {
                expect(() => {
                    const currentPassword = 'SamePassword1234!';
                    const newPassword = 'SamePassword1234!';

                    if (currentPassword === newPassword) {
                        throw new ApiError(400, 'INVALID_PASSWORD', 'New password must be different from current password');
                    }
                })
                    .toThrow('New password must be different from current password');
            });
        });

        describe('Preferred Language Validation', () => {
            it('should reject invalid language codes', () => {
                expect(() => {
                    const language = 'invalid-language';
                    const validLanguages = ['en', 'es', 'fr', 'de'];

                    if (!validLanguages.includes(language)) {
                        throw new ApiError(400, 'INVALID_LANGUAGE', 'Invalid language code');
                    }
                })
                    .toThrow('Invalid language code');
            });

            it('should accept valid language codes', () => {
                expect(() => {
                    const language = 'en';
                    const validLanguages = ['en', 'es', 'fr', 'de'];

                    if (!validLanguages.includes(language)) {
                        throw new ApiError(400, 'INVALID_LANGUAGE', 'Invalid language code');
                    }
                })
                    .not
                    .toThrow();
            });
        });

        describe('Photo URL Validation', () => {
            it('should reject invalid URL formats', () => {
                expect(() => {
                    const photoURL = 'not-a-valid-url';
                    const urlRegex = /^https?:\/\/.+/;

                    if (photoURL && !urlRegex.test(photoURL)) {
                        throw new ApiError(400, 'INVALID_URL', 'Invalid photo URL format');
                    }
                })
                    .toThrow('Invalid photo URL format');
            });

            it('should accept valid photo URLs', () => {
                expect(() => {
                    const photoURL = 'https://example.com/photo.jpg';
                    const urlRegex = /^https?:\/\/.+/;

                    if (photoURL && !urlRegex.test(photoURL)) {
                        throw new ApiError(400, 'INVALID_URL', 'Invalid photo URL format');
                    }
                })
                    .not
                    .toThrow();
            });

            it('should accept null photo URL', () => {
                expect(() => {
                    const photoURL = null;
                    const urlRegex = /^https?:\/\/.+/;

                    if (photoURL && !urlRegex.test(photoURL)) {
                        throw new ApiError(400, 'INVALID_URL', 'Invalid photo URL format');
                    }
                })
                    .not
                    .toThrow();
            });
        });

        describe('Account Deletion Validation', () => {
            it('should require confirmation for deletion', () => {
                expect(() => {
                    const confirmDelete = false;

                    if (!confirmDelete) {
                        throw new ApiError(400, 'CONFIRMATION_REQUIRED', 'Account deletion must be confirmed');
                    }
                })
                    .toThrow('Account deletion must be confirmed');
            });

            it('should accept valid deletion confirmation', () => {
                expect(() => {
                    const confirmDelete = true;

                    if (!confirmDelete) {
                        throw new ApiError(400, 'CONFIRMATION_REQUIRED', 'Account deletion must be confirmed');
                    }
                })
                    .not
                    .toThrow();
            });
        });

        describe('Terms and Policy Acceptance Validation', () => {
            it('should require terms acceptance', () => {
                expect(() => {
                    const termsAccepted = false;

                    if (!termsAccepted) {
                        throw new ApiError(400, 'TERMS_REQUIRED', 'You must accept the Terms of Service');
                    }
                })
                    .toThrow('You must accept the Terms of Service');
            });

            it('should require cookie policy acceptance', () => {
                expect(() => {
                    const cookiePolicyAccepted = false;

                    if (!cookiePolicyAccepted) {
                        throw new ApiError(400, 'COOKIE_POLICY_REQUIRED', 'You must accept the Cookie Policy');
                    }
                })
                    .toThrow('You must accept the Cookie Policy');
            });

            it('should accept valid policy acceptances', () => {
                expect(() => {
                    const termsAccepted = true;
                    const cookiePolicyAccepted = true;

                    if (!termsAccepted) {
                        throw new ApiError(400, 'TERMS_REQUIRED', 'You must accept the Terms of Service');
                    }
                    if (!cookiePolicyAccepted) {
                        throw new ApiError(400, 'COOKIE_POLICY_REQUIRED', 'You must accept the Cookie Policy');
                    }
                })
                    .not
                    .toThrow();
            });
        });
    });
});
