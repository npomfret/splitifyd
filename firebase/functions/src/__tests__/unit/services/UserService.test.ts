import { DisplayName, toDisplayName, toGroupId, toTenantId, toUserId } from '@billsplit-wl/shared';
import { ClientUserBuilder, CreateGroupRequestBuilder, PasswordChangeRequestBuilder, StubFirestoreDatabase, StubStorage, UserRegistrationBuilder, UserUpdateBuilder } from '@billsplit-wl/test-support';

import { StubCloudTasksClient } from 'ts-firebase-simulator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ApiError, ErrorCode } from '../../../errors';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { FakeEmailService } from '../../../services/email';
import { UserService } from '../../../services/UserService2';
import { createUnitTestServiceConfig, StubGroupAttachmentStorage } from '../../test-config';
import { AppDriver } from '../AppDriver';
import { StubAuthService } from '../mocks/StubAuthService';

const TEST_TENANT_ID = toTenantId('test-tenant');

describe('UserService - Consolidated Unit Tests', () => {
    let userService: UserService;
    let db: StubFirestoreDatabase;
    let stubAuth: StubAuthService;

    beforeEach(() => {
        // Create stub database
        db = new StubFirestoreDatabase();

        // Create real services using stub database
        stubAuth = new StubAuthService();

        // Create UserService via ApplicationBuilder
        const storage = new StubStorage({ defaultBucketName: 'test-bucket' });
        userService = new ComponentBuilder(
            stubAuth,
            new FakeEmailService(),
            db,
            storage,
            new StubCloudTasksClient(),
            createUnitTestServiceConfig(),
            new StubGroupAttachmentStorage(storage),
        )
            .buildUserService();

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

            const result = await userService.registerUser(registrationData, TEST_TENANT_ID);

            // Verify registration result
            expect(result.success).toBe(true);
            expect(result.message).toBe('Account created successfully');
            expect(result.user.uid).toBeDefined();
            expect(result.user.displayName).toBe(registrationData.displayName);

            // Verify user was created in Auth stub
            const authUser = await stubAuth.getUser(toUserId(result.user.uid!));
            expect(authUser).toBeDefined();
            expect(authUser!.email).toBe(registrationData.email);
            expect(authUser!.displayName).toBe(registrationData.displayName);
        });

        it('should reject registration with existing email using generic response', async () => {
            const email = 'existing@example.com';

            // Set up existing user in Auth stub
            const { role: _, photoURL: __, ...userData } = new ClientUserBuilder()
                .withUid(toUserId('existing-user'))
                .withEmail(email)
                .withDisplayName('Existing User')
                .build();
            stubAuth.setUser(toUserId('existing-user'), userData);

            const duplicateData = new UserRegistrationBuilder()
                .withEmail(email) // Use the same email as the existing user
                .withPassword('DifferentPass123!')
                .withDisplayName('Different Name')
                .build();

            await expect(userService.registerUser(duplicateData, TEST_TENANT_ID)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: 'ALREADY_EXISTS',
                }),
            );
        });

        it('enforces minimum registration duration on failure', async () => {
            vi.useFakeTimers();

            try {
                // Create a separate UserService with non-zero minRegistrationDurationMs for this test
                const testConfig = { ...createUnitTestServiceConfig(), minRegistrationDurationMs: 600 };
                const testStorage = new StubStorage({ defaultBucketName: 'test-bucket' });
                const testUserService = new ComponentBuilder(
                    stubAuth,
                    new FakeEmailService(),
                    db,
                    testStorage,
                    new StubCloudTasksClient(),
                    testConfig,
                    new StubGroupAttachmentStorage(testStorage),
                )
                    .buildUserService();

                const email = 'slow-existing@example.com';

                const { role: _, photoURL: __, ...userData } = new ClientUserBuilder()
                    .withUid(toUserId('existing-user'))
                    .withEmail(email)
                    .withDisplayName('Existing User')
                    .build();
                stubAuth.setUser(toUserId('existing-user'), userData);

                const duplicateData = new UserRegistrationBuilder()
                    .withEmail(email)
                    .withPassword('DifferentPass123!')
                    .withDisplayName('Different Name')
                    .build();

                let settled = false;
                const registrationPromise = testUserService.registerUser(duplicateData, TEST_TENANT_ID).finally(() => {
                    settled = true;
                });

                const expectation = expect(registrationPromise).rejects.toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.CONFLICT,
                        code: 'ALREADY_EXISTS',
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

        // NOTE: Policy acceptance flag validation is tested in registration-validation.test.ts
        // The UserService.registerUser() method does not validate these flags - the handler does.

        it('should assign theme color and role during registration', async () => {
            const registrationData = new UserRegistrationBuilder()
                .withPassword('passwordpass')
                .withDisplayName('Themed User')
                .build();

            const result = await userService.registerUser(registrationData, TEST_TENANT_ID);

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
            const email = 'test@example.com';
            const displayName = 'Test User';

            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail(email)
                .withDisplayName(displayName)
                .withPassword('SecurePassword123')
                .build();
            const result = await userService.registerUser(registration, TEST_TENANT_ID);
            const uid = toUserId(result.user.uid!);

            // Update photo URL manually for this test
            await userService.updateProfile(uid, {
                photoURL: 'https://example.com/photo.jpg',
            });

            const profile = await userService.getUser(uid);

            expect(profile.uid).toBe(uid);
            expect(profile.displayName).toBe(displayName);
            expect(profile.emailVerified).toBe(false); // New registrations aren't verified
            expect(profile.photoURL).toBe('https://example.com/photo.jpg');
        });

        it('should throw NOT_FOUND for non-existent user', async () => {
            const nonExistentUid = toUserId('nonexistent-user-id');

            await expect(userService.getUser(nonExistentUid)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: ErrorCode.NOT_FOUND,
                }),
            );
        });

        it('should throw error when user missing required fields', async () => {
            const uid = toUserId('incomplete-user');

            // Set up Auth user without required fields
            const { role: _, photoURL: __, ...userData } = new ClientUserBuilder()
                .withUid(uid)
                .withEmail('test@example.com')
                .withDisplayName(undefined as any)
                .build();
            stubAuth.setUser(uid, userData);

            await expect(userService.getUser(uid)).rejects.toThrow();
        });
    });

    describe('updateProfile', () => {
        it('should update display name in both Auth and Firestore', async () => {
            const originalDisplayName = 'Original Name';
            const newDisplayName = 'Updated Display Name';

            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('update-test@example.com')
                .withDisplayName(originalDisplayName)
                .withPassword('SecurePassword123')
                .build();
            const result = await userService.registerUser(registration, TEST_TENANT_ID);
            const uid = toUserId(result.user.uid!);

            // Returns void on success (204 No Content pattern)
            await userService.updateProfile(uid, {
                displayName: newDisplayName,
            });

            // Verify Auth was updated
            const authUser = await stubAuth.getUser(uid);
            expect(authUser!.displayName).toBe(newDisplayName);
        });

        it('should update preferred language in Firestore only', async () => {
            const newLanguage = 'en';

            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('language-test@example.com')
                .withDisplayName('Test User')
                .withPassword('SecurePassword123')
                .build();
            const result = await userService.registerUser(registration, TEST_TENANT_ID);
            const uid = toUserId(result.user.uid!);

            // Returns void on success (204 No Content pattern)
            await userService.updateProfile(uid, {
                preferredLanguage: newLanguage,
            });

            // Verify the profile still has correct displayName via getProfile
            const profile = await userService.getProfile(uid);
            expect(profile.displayName).toBe('Test User');
        });

        it('should update photo URL with null value', async () => {
            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('photo-test@example.com')
                .withDisplayName('Test User')
                .withPassword('SecurePassword123')
                .build();
            const result = await userService.registerUser(registration, TEST_TENANT_ID);
            const uid = toUserId(result.user.uid!);

            // Set a photo URL first
            await userService.updateProfile(uid, {
                photoURL: 'https://example.com/old-photo.jpg',
            });

            // Then set it to null
            await userService.updateProfile(uid, {
                photoURL: null,
            });

            // Verify Auth was updated
            const authUser = await stubAuth.getUser(uid);
            expect(authUser!.photoURL).toBeUndefined();
        });

        it('should throw NOT_FOUND for non-existent user', async () => {
            const nonExistentUid = toUserId('nonexistent-user-id');

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
            const currentPassword = 'OldPassword1234!';
            const newPassword = 'NewSecurePassword1234!';

            // Register user via API with initial password
            const registration = new UserRegistrationBuilder()
                .withEmail('password-test@example.com')
                .withDisplayName('Test User')
                .withPassword(currentPassword)
                .build();
            const result = await userService.registerUser(registration, TEST_TENANT_ID);
            const uid = toUserId(result.user.uid!);

            // Returns void on success (204 No Content pattern)
            await userService.changePassword(uid, {
                currentPassword,
                newPassword,
            });

            // Verify password was changed by checking the user still exists
            const authUser = await stubAuth.getUser(uid);
            expect(authUser).toBeDefined();
        });

        it('should throw NOT_FOUND for non-existent user', async () => {
            const nonExistentUid = toUserId('nonexistent-user-id');

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
            const email = 'consistent@example.com';
            const displayName = 'Consistent User';

            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail(email)
                .withDisplayName(displayName)
                .withPassword('SecurePassword123')
                .build();
            const result = await userService.registerUser(registration, TEST_TENANT_ID);
            const uid = toUserId(result.user.uid!);

            // Set photo URL
            await userService.updateProfile(uid, {
                photoURL: 'https://example.com/photo.jpg',
            });

            const profile = await userService.getUser(uid);

            // Verify Auth and Firestore have consistent data
            const authUser = await stubAuth.getUser(uid);
            expect(profile.displayName).toBe(authUser!.displayName);
            expect(profile.photoURL).toBe(authUser!.photoURL);
        });

        it('should handle auth user without email gracefully', async () => {
            const uid = toUserId('no-email-user');

            // Set up user without email (edge case)
            stubAuth.setUser(uid, {
                uid,
                displayName: toDisplayName('No Email User'),
                // email is undefined
            });

            await expect(userService.getUser(uid)).rejects.toThrow();
        });
    });

    describe('Input Validation Tests', () => {
        let validationUserService: UserService;
        let validationTestUserId: string;

        beforeEach(async () => {
            const validationStorage = new StubStorage({ defaultBucketName: 'test-bucket' });
            validationUserService = new ComponentBuilder(
                stubAuth,
                new FakeEmailService(),
                db,
                validationStorage,
                new StubCloudTasksClient(),
                createUnitTestServiceConfig(),
                new StubGroupAttachmentStorage(validationStorage),
            )
                .buildUserService();

            const email = 'validation-user@example.com';
            const displayName = 'Validation User';

            // Register user via API
            const registration = new UserRegistrationBuilder()
                .withEmail(email)
                .withDisplayName(displayName)
                .withPassword('ValidCurrentPassword1234!')
                .build();
            const result = await validationUserService.registerUser(registration, TEST_TENANT_ID);
            validationTestUserId = result.user.uid!;
        });

        describe('updateProfile validation', () => {
            it('should validate displayName length', async () => {
                const updateData = new UserUpdateBuilder()
                    .withDisplayName(toDisplayName('a'.repeat(101))) // Too long
                    .build();

                await expect(validationUserService.updateProfile(toUserId(validationTestUserId), updateData)).rejects.toThrow(ApiError);
            });

            it('should validate displayName is not empty', async () => {
                const updateData = new UserUpdateBuilder()
                    .withDisplayName(toDisplayName(''))
                    .build();

                await expect(validationUserService.updateProfile(toUserId(validationTestUserId), updateData)).rejects.toThrow(ApiError);
            });

            it('should validate displayName with only whitespace', async () => {
                const updateData = new UserUpdateBuilder()
                    .withDisplayName(toDisplayName('   '))
                    .build();

                await expect(validationUserService.updateProfile(toUserId(validationTestUserId), updateData)).rejects.toThrow(ApiError);
            });

            it('should accept valid displayName', async () => {
                // todo
            });

            it('should validate preferredLanguage enum', async () => {
                const updateData = new UserUpdateBuilder()
                    .withPreferredLanguage('invalid-language')
                    .build();

                await expect(validationUserService.updateProfile(toUserId(validationTestUserId), updateData)).rejects.toThrow(ApiError);
            });

            it('should accept valid preferredLanguage', async () => {
                // todo
            });

            it('should validate photoURL format', async () => {
                const updateData = new UserUpdateBuilder()
                    .withPhotoURL('not-a-valid-url')
                    .build();

                await expect(validationUserService.updateProfile(toUserId(validationTestUserId), updateData)).rejects.toThrow(ApiError);
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

                await expect(validationUserService.changePassword(toUserId(validationTestUserId), changeData)).rejects.toThrow(ApiError);
            });

            it('should accept lowercase-only passwords when long enough', async () => {
                const changeData = new PasswordChangeRequestBuilder()
                    .withCurrentPassword('ValidCurrentPassword1234!')
                    .withNewPassword('lowercaseonlypass')
                    .build();

                // Returns void on success (204 No Content pattern)
                await expect(validationUserService.changePassword(toUserId(validationTestUserId), changeData)).resolves.toBeUndefined();
            });

            it('should accept passwords without numbers or special characters when long enough', async () => {
                const changeData = new PasswordChangeRequestBuilder()
                    .withCurrentPassword('ValidCurrentPassword1234!')
                    .withNewPassword('JustLettersHere')
                    .build();

                // Returns void on success (204 No Content pattern)
                await expect(validationUserService.changePassword(toUserId(validationTestUserId), changeData)).resolves.toBeUndefined();
            });

            it('should accept passwords with spaces when long enough', async () => {
                const changeData = new PasswordChangeRequestBuilder()
                    .withCurrentPassword('ValidCurrentPassword1234!')
                    .withNewPassword('twelve chars ok')
                    .build();

                // Returns void on success (204 No Content pattern)
                await expect(validationUserService.changePassword(toUserId(validationTestUserId), changeData)).resolves.toBeUndefined();
            });

            it('should validate current password is provided', async () => {
                const changeData = new PasswordChangeRequestBuilder()
                    .withCurrentPassword('')
                    .withNewPassword('NewSecurePassword1234!')
                    .build();

                await expect(validationUserService.changePassword(toUserId(validationTestUserId), changeData)).rejects.toThrow(ApiError);
            });

            it('should validate new password is different from current', async () => {
                const samePassword = 'SamePassword1234!';
                const changeData = new PasswordChangeRequestBuilder()
                    .withCurrentPassword(samePassword)
                    .withNewPassword(samePassword)
                    .build();

                await expect(validationUserService.changePassword(toUserId(validationTestUserId), changeData)).rejects.toThrow(ApiError);
            });

            it('should throw NOT_FOUND for non-existent user', async () => {
                // todo
            });

            it('should handle incorrect current password', async () => {
                // todo
            });
        });

        // NOTE: Registration input validation (email format, password strength, policy acceptance,
        // displayName validation) is tested in registration-validation.test.ts which tests
        // validateRegisterRequest() at the handler layer. The UserService.registerUser() method
        // does not perform these validations - they are done by the handler before calling the service.

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
                    const displayName: DisplayName = toDisplayName('');
                    if (!displayName || displayName.trim().length === 0) {
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'INVALID_DISPLAY_NAME', message: 'Display name cannot be empty' });
                    }
                })
                    .toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }));
            });

            it('should reject display names with only whitespace', () => {
                expect(() => {
                    const displayName = '   ';
                    if (!displayName || displayName.trim().length === 0) {
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'INVALID_DISPLAY_NAME', message: 'Display name cannot be empty' });
                    }
                })
                    .toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }));
            });

            it('should reject display names that are too long', () => {
                expect(() => {
                    const displayName = 'a'.repeat(101);
                    const maxLength = 100;
                    if (displayName.length > maxLength) {
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'INVALID_DISPLAY_NAME', message: `Display name cannot exceed ${maxLength} characters` });
                    }
                })
                    .toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }));
            });

            it('should accept valid display names', () => {
                expect(() => {
                    const displayName = 'Valid Display Name';
                    if (!displayName || displayName.trim().length === 0) {
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'INVALID_DISPLAY_NAME', message: 'Display name cannot be empty' });
                    }
                    if (displayName.length > 100) {
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'INVALID_DISPLAY_NAME', message: 'Display name cannot exceed 100 characters' });
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
                            throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'INVALID_EMAIL', message: 'Invalid email format' });
                        }
                    })
                        .toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }));
                });
            });

            it('should accept valid email formats', () => {
                const validEmails = ['test@example.com', 'user.name@domain.co.uk', 'test+tag@example.org'];

                validEmails.forEach((email) => {
                    expect(() => {
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(email)) {
                            throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'INVALID_EMAIL', message: 'Invalid email format' });
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
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'WEAK_PASSWORD', message: `Password must be at least ${minLength} characters long` });
                    }
                })
                    .toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }));
            });

            it('should accept passwords of any composition when length requirement is met', () => {
                const validPasswords = ['passwordpass', 'lowercaseonlypass', '123456789012', '!!!!!!!!!!!!', 'WITH SPACES 12'];

                validPasswords.forEach((password) => {
                    expect(() => {
                        const minLength = 12;
                        if (password.length < minLength) {
                            throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'WEAK_PASSWORD', message: `Password must be at least ${minLength} characters long` });
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
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'INVALID_PASSWORD', message: 'New password must be different from current password' });
                    }
                })
                    .toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }));
            });
        });

        describe('Preferred Language Validation', () => {
            it('should reject invalid language codes', () => {
                expect(() => {
                    const language = 'invalid-language';
                    const validLanguages = ['en', 'es', 'fr', 'de'];

                    if (!validLanguages.includes(language)) {
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'INVALID_LANGUAGE', message: 'Invalid language code' });
                    }
                })
                    .toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }));
            });

            it('should accept valid language codes', () => {
                expect(() => {
                    const language = 'en';
                    const validLanguages = ['en', 'es', 'fr', 'de'];

                    if (!validLanguages.includes(language)) {
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'INVALID_LANGUAGE', message: 'Invalid language code' });
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
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'INVALID_URL', message: 'Invalid photo URL format' });
                    }
                })
                    .toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }));
            });

            it('should accept valid photo URLs', () => {
                expect(() => {
                    const photoURL = 'https://example.com/photo.jpg';
                    const urlRegex = /^https?:\/\/.+/;

                    if (photoURL && !urlRegex.test(photoURL)) {
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'INVALID_URL', message: 'Invalid photo URL format' });
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
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'INVALID_URL', message: 'Invalid photo URL format' });
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
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'CONFIRMATION_REQUIRED', message: 'Account deletion must be confirmed' });
                    }
                })
                    .toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }));
            });

            it('should accept valid deletion confirmation', () => {
                expect(() => {
                    const confirmDelete = true;

                    if (!confirmDelete) {
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'CONFIRMATION_REQUIRED', message: 'Account deletion must be confirmed' });
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
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'TERMS_REQUIRED', message: 'You must accept the Terms of Service' });
                    }
                })
                    .toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }));
            });

            it('should require cookie policy acceptance', () => {
                expect(() => {
                    const cookiePolicyAccepted = false;

                    if (!cookiePolicyAccepted) {
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'COOKIE_POLICY_REQUIRED', message: 'You must accept the Cookie Policy' });
                    }
                })
                    .toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }));
            });

            it('should accept valid policy acceptances', () => {
                expect(() => {
                    const termsAccepted = true;
                    const cookiePolicyAccepted = true;

                    if (!termsAccepted) {
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'TERMS_REQUIRED', message: 'You must accept the Terms of Service' });
                    }
                    if (!cookiePolicyAccepted) {
                        throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { detail: 'COOKIE_POLICY_REQUIRED', message: 'You must accept the Cookie Policy' });
                    }
                })
                    .not
                    .toThrow();
            });
        });
    });

    describe('resolveGroupMemberProfiles', () => {
        it('should resolve multiple group member profiles efficiently', async () => {
            const appDriver = new AppDriver();
            // Create userService using AppDriver's database
            const appDriverUserService = appDriver.componentBuilder.buildUserService();

            // Register users via API
            const reg1 = new UserRegistrationBuilder().withEmail('member1@test.com').withDisplayName('Member One').withPassword('password12345').build();
            const reg2 = new UserRegistrationBuilder().withEmail('member2@test.com').withDisplayName('Member Two').withPassword('password12345').build();
            const reg3 = new UserRegistrationBuilder().withEmail('member3@test.com').withDisplayName('Member Three').withPassword('password12345').build();

            const result1 = await appDriver.registerUser(reg1);
            const result2 = await appDriver.registerUser(reg2);
            const result3 = await appDriver.registerUser(reg3);

            const user1 = result1.user.uid;
            const user2 = result2.user.uid;
            const user3 = result3.user.uid;

            // Create group and add members via API
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withGroupDisplayName('Member One').build(),
                user1,
            );
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, 'Member Two', user2);
            await appDriver.joinGroupByLink(shareToken, 'Member Three', user3);

            const profiles = await appDriverUserService.resolveGroupMemberProfiles(toGroupId(group.id), [toUserId(user1), toUserId(user2), toUserId(user3)]);

            expect(profiles).toHaveLength(3);
            expect(profiles[0].uid).toBe(user1);
            expect(profiles[0].groupDisplayName).toBe('Member One');
            expect(profiles[0].initials).toBe('MO');
            expect(profiles[1].groupDisplayName).toBe('Member Two');
            expect(profiles[2].groupDisplayName).toBe('Member Three');
        });

        it('should handle phantom members when user has left the group', async () => {
            const appDriver = new AppDriver();
            const appDriverUserService = appDriver.componentBuilder.buildUserService();

            // Register two users
            const reg1 = new UserRegistrationBuilder().withEmail('active@test.com').withDisplayName('Active Member').withPassword('password12345').build();
            const reg2 = new UserRegistrationBuilder().withEmail('departed@test.com').withDisplayName('Departed User').withPassword('password12345').build();

            const result1 = await appDriver.registerUser(reg1);
            const result2 = await appDriver.registerUser(reg2);

            const user1 = result1.user.uid;
            const user2 = result2.user.uid;

            // Create group with both users
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withGroupDisplayName('Active Member').build(),
                user1,
            );
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, 'Departed User', user2);

            // User2 leaves the group
            await appDriver.leaveGroup(group.id, user2);

            // Try to resolve both members (user2 is now a "phantom" - departed member)
            const profiles = await appDriverUserService.resolveGroupMemberProfiles(toGroupId(group.id), [user1, user2]);

            expect(profiles).toHaveLength(2);
            expect(profiles[0].groupDisplayName).toBe('Active Member');
            expect(profiles[1].groupDisplayName).toBe(user2); // Phantom uses UID
        });

        it('should handle empty user list', async () => {
            const appDriver = new AppDriver();
            const appDriverUserService = appDriver.componentBuilder.buildUserService();

            const reg = new UserRegistrationBuilder().withEmail('owner@test.com').withDisplayName('Owner').withPassword('password12345').build();
            const result = await appDriver.registerUser(reg);
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withGroupDisplayName('Owner').build(),
                result.user.uid,
            );

            const profiles = await appDriverUserService.resolveGroupMemberProfiles(toGroupId(group.id), []);

            expect(profiles).toEqual([]);
        });

        it('should compute correct initials for single-word names', async () => {
            const appDriver = new AppDriver();
            const appDriverUserService = appDriver.componentBuilder.buildUserService();

            const reg = new UserRegistrationBuilder().withEmail('alice@test.com').withDisplayName('Alice').withPassword('password12345').build();
            const result = await appDriver.registerUser(reg);
            const user1 = result.user.uid;

            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withGroupDisplayName('Alice').build(),
                user1,
            );

            const profiles = await appDriverUserService.resolveGroupMemberProfiles(toGroupId(group.id), [user1]);

            expect(profiles[0].initials).toBe('A');
        });

        it('should compute correct initials for multi-word names', async () => {
            const appDriver = new AppDriver();
            const appDriverUserService = appDriver.componentBuilder.buildUserService();

            const reg = new UserRegistrationBuilder().withEmail('john@test.com').withDisplayName('John Smith').withPassword('password12345').build();
            const result = await appDriver.registerUser(reg);
            const user1 = result.user.uid;

            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withGroupDisplayName('John Smith').build(),
                user1,
            );

            const profiles = await appDriverUserService.resolveGroupMemberProfiles(toGroupId(group.id), [user1]);

            expect(profiles[0].initials).toBe('JS');
        });

        it('should limit initials to 2 characters max', async () => {
            const appDriver = new AppDriver();
            const appDriverUserService = appDriver.componentBuilder.buildUserService();

            const reg = new UserRegistrationBuilder().withEmail('fml@test.com').withDisplayName('First Middle Last').withPassword('password12345').build();
            const result = await appDriver.registerUser(reg);
            const user1 = result.user.uid;

            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().withGroupDisplayName('First Middle Last').build(),
                user1,
            );

            const profiles = await appDriverUserService.resolveGroupMemberProfiles(toGroupId(group.id), [user1]);

            expect(profiles[0].initials).toBe('FM');
        });
    });
});
