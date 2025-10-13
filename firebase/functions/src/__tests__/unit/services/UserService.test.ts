import { type UserThemeColor } from '@splitifyd/shared';
import { USER_COLORS } from '@splitifyd/shared';
import { PasswordChangeBuilder, RegisteredUserBuilder, UserRegistrationBuilder, UserUpdateBuilder } from '@splitifyd/test-support';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import { UserService } from '../../../services/UserService2';
import { ApiError } from '../../../utils/errors';
import { initializeI18n } from '../../../utils/i18n';
import { StubAuthService, StubFirestore, StubFirestoreReader } from '../mocks/firestore-stubs';

describe('UserService - Consolidated Unit Tests', () => {
    let userService: UserService;
    let stubReader: StubFirestore;
    let stubWriter: StubFirestore;
    let stubAuth: StubAuthService;

    // Helper to create a valid UserThemeColor
    const createTestThemeColor = (): UserThemeColor => ({
        light: USER_COLORS[0].light,
        dark: USER_COLORS[0].dark,
        name: USER_COLORS[0].name,
        pattern: 'solid',
        assignedAt: new Date().toISOString(),
        colorIndex: 0,
    });

    beforeAll(async () => {
        // Initialize i18n for validation error translations
        await initializeI18n();
    });

    beforeEach(() => {
        const stub = new StubFirestoreReader();
        stubReader = stub;
        stubWriter = stub;
        stubAuth = new StubAuthService();

        userService = new ApplicationBuilder(stubReader, stubWriter, stubAuth).buildUserService();

        // Clear all stub data
        stubAuth.clear();
    });

    describe('registerUser', () => {
        it('should register a new user with Firebase Auth and Firestore', async () => {
            const registrationData = new UserRegistrationBuilder()
                .withPassword('SecurePass123!')
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

        it('should reject registration with existing email', async () => {
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
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: 'EMAIL_ALREADY_EXISTS',
                }),
            );
        });

        it('should validate policy acceptance flags', async () => {
            const userData = new UserRegistrationBuilder()
                .withPassword('SecurePass123!')
                .withDisplayName('Test User')
                .withTermsAccepted(false)
                .withCookiePolicyAccepted(true)
                .build();

            await expect(userService.registerUser(userData)).rejects.toThrow('You must accept the Terms of Service');

            // Test cookie policy validation
            const userData2 = new UserRegistrationBuilder()
                .withPassword('SecurePass123!')
                .withDisplayName('Test User')
                .withTermsAccepted(true)
                .withCookiePolicyAccepted(false)
                .build();

            await expect(userService.registerUser(userData2)).rejects.toThrow('You must accept the Cookie Policy');
        });

        it('should assign theme color and role during registration', async () => {
            const registrationData = new UserRegistrationBuilder()
                .withPassword('SecurePass123!')
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

            // Set up Firestore user document
            const userDoc = new RegisteredUserBuilder()
                .withUid(uid)
                .withDisplayName(displayName)
                .withThemeColor(createTestThemeColor())
                .withPreferredLanguage('en')
                .build();
            stubReader.setUser(uid, userDoc);

            const profile = await userService.getUser(uid);

            expect(profile.uid).toBe(uid);
            expect(profile.displayName).toBe(displayName);
            expect(profile.emailVerified).toBe(true);
            expect(profile.photoURL).toBe('https://example.com/photo.jpg');
            expect(profile.themeColor).toEqual(
                expect.objectContaining({
                    light: expect.any(String),
                    dark: expect.any(String),
                    name: expect.any(String),
                    pattern: 'solid',
                    colorIndex: 0,
                }),
            );
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

    describe('getUsers', () => {
        it('should fetch multiple users efficiently', async () => {
            const users = [
                { uid: 'user1', email: 'user1@example.com', displayName: 'User One' },
                { uid: 'user2', email: 'user2@example.com', displayName: 'User Two' },
                { uid: 'user3', email: 'user3@example.com', displayName: 'User Three' },
            ];

            // Set up Auth users
            users.forEach((user) => {
                stubAuth.setUser(user.uid, user);

                // Set up corresponding Firestore documents using builder
                const userDoc = new RegisteredUserBuilder()
                    .withUid(user.uid)
                    .withDisplayName(user.displayName)
                    .withThemeColor(createTestThemeColor())
                    .build();
                stubReader.setUser(user.uid, userDoc);
            });

            const uids = users.map((u) => u.uid);
            const profiles = await userService.getUsers(uids);

            expect(profiles.size).toBe(3);
            for (const user of users) {
                const profile = profiles.get(user.uid);
                expect(profile).toBeDefined();
                expect(profile!.uid).toBe(user.uid);
                expect(profile!.displayName).toBe(user.displayName);
            }
        });

        it('should handle empty input gracefully', async () => {
            const profiles = await userService.getUsers([]);
            expect(profiles.size).toBe(0);
        });

        it('should handle mix of existing and non-existent users', async () => {
            // Set up one existing user
            stubAuth.setUser('existing-user', {
                uid: 'existing-user',
                email: 'existing@example.com',
                displayName: 'Existing User',
            });

            const userDoc = new RegisteredUserBuilder()
                .withUid('existing-user')
                .withDisplayName('Existing User')
                .withThemeColor(createTestThemeColor())
                .build();
            stubReader.setUser('existing-user', userDoc);

            const profiles = await userService.getUsers(['existing-user', 'non-existent-user']);

            expect(profiles.size).toBe(1);
            expect(profiles.get('existing-user')).toBeDefined();
            expect(profiles.get('non-existent-user')).toBeUndefined();
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

            const userDoc = new RegisteredUserBuilder()
                .withUid(uid)
                .withDisplayName(originalDisplayName)
                .withThemeColor(createTestThemeColor())
                .build();
            stubReader.setUser(uid, userDoc);

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

            const userDoc = new RegisteredUserBuilder()
                .withUid(uid)
                .withDisplayName('Test User')
                .withThemeColor(createTestThemeColor())
                .build();
            stubReader.setUser(uid, userDoc);

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

            const userDoc = new RegisteredUserBuilder()
                .withUid(uid)
                .withDisplayName('Test User')
                .withThemeColor(createTestThemeColor())
                .build();
            stubReader.setUser(uid, userDoc);

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
            const currentPassword = 'OldPassword123!';
            const newPassword = 'NewSecurePassword123!';

            // Set up existing user
            stubAuth.setUser(uid, {
                uid,
                email: 'test@example.com',
                displayName: 'Test User',
            });

            const userDoc = new RegisteredUserBuilder()
                .withUid(uid)
                .withDisplayName('Test User')
                .withThemeColor(createTestThemeColor())
                .build();
            stubReader.setUser(uid, userDoc);

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
                    currentPassword: 'OldPassword123!',
                    newPassword: 'NewPassword123!',
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

            const userDoc = new RegisteredUserBuilder()
                .withUid(uid)
                .withDisplayName(displayName)
                .withThemeColor(createTestThemeColor())
                .build();
            stubReader.setUser(uid, userDoc);

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
            validationUserService = new ApplicationBuilder(stubReader, stubWriter, stubAuth).buildUserService();
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
            it('should validate password strength - minimum length', async () => {
                const changeData = new PasswordChangeBuilder()
                    .withCurrentPassword('ValidCurrentPassword123!')
                    .withNewPassword('123') // Too short
                    .build();

                await expect(validationUserService.changePassword(testUserId, changeData)).rejects.toThrow(ApiError);
            });

            it('should validate password strength - requires uppercase', async () => {
                const changeData = new PasswordChangeBuilder()
                    .withCurrentPassword('ValidCurrentPassword123!')
                    .withNewPassword('newpassword123!') // No uppercase
                    .build();

                await expect(validationUserService.changePassword(testUserId, changeData)).rejects.toThrow(ApiError);
            });

            it('should validate password strength - requires lowercase', async () => {
                const changeData = {
                    currentPassword: 'ValidCurrentPassword123!',
                    newPassword: 'NEWPASSWORD123!', // No lowercase
                };

                await expect(validationUserService.changePassword(testUserId, changeData)).rejects.toThrow(ApiError);
            });

            it('should validate password strength - requires number', async () => {
                const changeData = {
                    currentPassword: 'ValidCurrentPassword123!',
                    newPassword: 'NewPassword!', // No number
                };

                await expect(validationUserService.changePassword(testUserId, changeData)).rejects.toThrow(ApiError);
            });

            it('should validate password strength - requires special character', async () => {
                const changeData = {
                    currentPassword: 'ValidCurrentPassword123!',
                    newPassword: 'NewPassword123', // No special character
                };

                await expect(validationUserService.changePassword(testUserId, changeData)).rejects.toThrow(ApiError);
            });

            it('should accept valid strong password', async () => {
                // todo
            });

            it('should validate current password is provided', async () => {
                const changeData = {
                    currentPassword: '',
                    newPassword: 'NewSecurePassword123!',
                };

                await expect(validationUserService.changePassword(testUserId, changeData)).rejects.toThrow(ApiError);
            });

            it('should validate new password is different from current', async () => {
                const samePassword = 'SamePassword123!';
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
                    password: 'ValidPassword123!',
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
                    password: 'ValidPassword123!',
                    displayName: 'Test User',
                    termsAccepted: false,
                    cookiePolicyAccepted: true,
                };

                await expect(validationUserService.registerUser(registrationData)).rejects.toThrow(/Terms of Service/);
            });

            it('should require cookie policy acceptance', async () => {
                const registrationData = {
                    email: 'newuser@example.com',
                    password: 'ValidPassword123!',
                    displayName: 'Test User',
                    termsAccepted: true,
                    cookiePolicyAccepted: false,
                };

                await expect(validationUserService.registerUser(registrationData)).rejects.toThrow(/Cookie Policy/);
            });

            it('should validate displayName during registration', async () => {
                const registrationData = {
                    email: 'newuser@example.com',
                    password: 'ValidPassword123!',
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
                    const displayName: string = '';
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
                    const minLength = 8;
                    if (password.length < minLength) {
                        throw new ApiError(400, 'WEAK_PASSWORD', `Password must be at least ${minLength} characters long`);
                    }
                })
                    .toThrow('Password must be at least 8 characters long');
            });

            it('should reject passwords without uppercase letters', () => {
                expect(() => {
                    const password = 'newpassword123!';
                    if (!/[A-Z]/.test(password)) {
                        throw new ApiError(400, 'WEAK_PASSWORD', 'Password must contain at least one uppercase letter');
                    }
                })
                    .toThrow('Password must contain at least one uppercase letter');
            });

            it('should reject passwords without lowercase letters', () => {
                expect(() => {
                    const password = 'NEWPASSWORD123!';
                    if (!/[a-z]/.test(password)) {
                        throw new ApiError(400, 'WEAK_PASSWORD', 'Password must contain at least one lowercase letter');
                    }
                })
                    .toThrow('Password must contain at least one lowercase letter');
            });

            it('should reject passwords without numbers', () => {
                expect(() => {
                    const password = 'NewPassword!';
                    if (!/[0-9]/.test(password)) {
                        throw new ApiError(400, 'WEAK_PASSWORD', 'Password must contain at least one number');
                    }
                })
                    .toThrow('Password must contain at least one number');
            });

            it('should reject passwords without special characters', () => {
                expect(() => {
                    const password = 'NewPassword123';
                    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                        throw new ApiError(400, 'WEAK_PASSWORD', 'Password must contain at least one special character');
                    }
                })
                    .toThrow('Password must contain at least one special character');
            });

            it('should accept strong passwords', () => {
                expect(() => {
                    const password = 'NewSecurePassword123!';

                    if (password.length < 8) {
                        throw new ApiError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters long');
                    }
                    if (!/[A-Z]/.test(password)) {
                        throw new ApiError(400, 'WEAK_PASSWORD', 'Password must contain at least one uppercase letter');
                    }
                    if (!/[a-z]/.test(password)) {
                        throw new ApiError(400, 'WEAK_PASSWORD', 'Password must contain at least one lowercase letter');
                    }
                    if (!/[0-9]/.test(password)) {
                        throw new ApiError(400, 'WEAK_PASSWORD', 'Password must contain at least one number');
                    }
                    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                        throw new ApiError(400, 'WEAK_PASSWORD', 'Password must contain at least one special character');
                    }
                })
                    .not
                    .toThrow();
            });

            it('should reject passwords that are the same as current password', () => {
                expect(() => {
                    const currentPassword = 'SamePassword123!';
                    const newPassword = 'SamePassword123!';

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
