import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from '../../../services/UserService2';
import { MockFirestoreReader } from '../../test-utils/MockFirestoreReader';
import { StubFirestoreWriter } from '../mocks/firestore-stubs';
import { ApiError } from '../../../utils/errors';
import type { IAuthService } from '../../../services/auth';

// Mock i18n functions to avoid translation errors in tests
vi.mock('../../../utils/i18n-validation', () => ({
    translateJoiError: vi.fn((error: any) => error.details?.[0]?.message || 'Validation error'),
    translate: vi.fn((key: string) => key),
    translateValidationError: vi.fn((detail: any) => detail.message || 'Validation error'),
}));

// Mock auth service
const createMockAuthService = () => ({
    createUser: vi.fn(),
    getUser: vi.fn(),
    getUsers: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    verifyIdToken: vi.fn(),
    createCustomToken: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserByPhoneNumber: vi.fn(),
    listUsers: vi.fn(),
    deleteUsers: vi.fn(),
    generatePasswordResetLink: vi.fn(),
    generateEmailVerificationLink: vi.fn(),
    setCustomUserClaims: vi.fn(),
    revokeRefreshTokens: vi.fn(),
    verifyPassword: vi.fn(),
});

// Mock services
const createMockNotificationService = () => ({
    initializeUserNotifications: vi.fn(),
    updateUserNotification: vi.fn(),
    getUserNotifications: vi.fn(),
});

const createMockValidationService = () => ({
    validateUserExists: vi.fn().mockResolvedValue(true),
    validateGroupExists: vi.fn().mockResolvedValue(true),
    validateGroupMembership: vi.fn().mockResolvedValue(true),
    validateExpenseExists: vi.fn().mockResolvedValue(true),
    validateSettlementExists: vi.fn().mockResolvedValue(true),
    validateBeforeWrite: vi.fn().mockResolvedValue(undefined),
    validateAfterWrite: vi.fn().mockResolvedValue(undefined),
});

describe('UserService Validation Tests', () => {
    let userService: UserService;
    let mockFirestoreReader: MockFirestoreReader;
    let mockFirestoreWriter: StubFirestoreWriter;
    let mockAuthService: ReturnType<typeof createMockAuthService>;
    let mockNotificationService: ReturnType<typeof createMockNotificationService>;
    let mockValidationService: ReturnType<typeof createMockValidationService>;

    const testUserId = 'test-user-id';
    const testUserEmail = 'test@example.com';

    beforeEach(() => {
        mockFirestoreReader = new MockFirestoreReader();
        mockFirestoreWriter = new StubFirestoreWriter();
        mockAuthService = createMockAuthService();
        mockNotificationService = createMockNotificationService();
        mockValidationService = createMockValidationService();

        // Setup test user in Firestore
        const testUserDoc = MockFirestoreReader.createTestUser(testUserId, {
            email: testUserEmail,
            displayName: 'Test User',
            emailVerified: true,
        });
        mockFirestoreReader.mockUserExists(testUserId, testUserDoc);

        // Setup mock auth service responses
        mockAuthService.getUser.mockResolvedValue({
            uid: testUserId,
            email: testUserEmail,
            displayName: 'Test User',
            emailVerified: true,
            photoURL: null,
        });

        // Setup mock policies for registration
        mockFirestoreReader.getAllPolicies.mockResolvedValue([
            {
                id: 'terms',
                currentVersionHash: 'terms-v1-hash',
                policyName: 'Terms of Service',
            },
            {
                id: 'privacy',
                currentVersionHash: 'privacy-v1-hash',
                policyName: 'Privacy Policy',
            },
        ]);

        userService = new UserService(mockFirestoreReader, mockFirestoreWriter, mockValidationService as any, mockNotificationService as any, mockAuthService as IAuthService);
    });

    describe('updateProfile validation', () => {
        it('should validate displayName length', async () => {
            const updateData = {
                displayName: 'a'.repeat(101), // Too long
            };

            await expect(userService.updateProfile(testUserId, updateData)).rejects.toThrow(ApiError);
        });

        it('should validate displayName is not empty', async () => {
            const updateData = {
                displayName: '',
            };

            await expect(userService.updateProfile(testUserId, updateData)).rejects.toThrow(ApiError);
        });

        it('should validate displayName with only whitespace', async () => {
            const updateData = {
                displayName: '   ',
            };

            await expect(userService.updateProfile(testUserId, updateData)).rejects.toThrow(ApiError);
        });

        it('should accept valid displayName', async () => {
            const updateData = {
                displayName: 'Valid Display Name',
            };

            mockAuthService.updateUser.mockResolvedValue({});
            // Mock getUser to return updated user data
            mockAuthService.getUser.mockResolvedValue({
                uid: testUserId,
                email: testUserEmail,
                displayName: 'Valid Display Name',
                emailVerified: true,
                photoURL: null,
            });

            const result = await userService.updateProfile(testUserId, updateData);

            expect(result.displayName).toBe('Valid Display Name');
            expect(mockAuthService.updateUser).toHaveBeenCalledWith(testUserId, {
                displayName: 'Valid Display Name',
            });
        });

        it('should validate preferredLanguage enum', async () => {
            const updateData = {
                preferredLanguage: 'invalid-language',
            };

            await expect(userService.updateProfile(testUserId, updateData)).rejects.toThrow(ApiError);
        });

        it('should accept valid preferredLanguage', async () => {
            const updateData = {
                preferredLanguage: 'en',
            };

            // Mock Firestore to return updated user data
            const updatedUserDoc = MockFirestoreReader.createTestUser(testUserId, {
                email: testUserEmail,
                displayName: 'Test User',
                emailVerified: true,
                preferredLanguage: 'en',
            });
            mockFirestoreReader.getUser.mockResolvedValue(updatedUserDoc);

            const result = await userService.updateProfile(testUserId, updateData);

            expect(result.preferredLanguage).toBe('en');
        });

        it('should validate photoURL format', async () => {
            const updateData = {
                photoURL: 'not-a-valid-url',
            };

            await expect(userService.updateProfile(testUserId, updateData)).rejects.toThrow(ApiError);
        });

        it('should accept valid photoURL', async () => {
            const updateData = {
                photoURL: 'https://example.com/photo.jpg',
            };

            mockAuthService.updateUser.mockResolvedValue({});
            // Mock getUser to return updated user data
            mockAuthService.getUser.mockResolvedValue({
                uid: testUserId,
                email: testUserEmail,
                displayName: 'Test User',
                emailVerified: true,
                photoURL: 'https://example.com/photo.jpg',
            });

            const result = await userService.updateProfile(testUserId, updateData);

            expect(result.photoURL).toBe('https://example.com/photo.jpg');
            expect(mockAuthService.updateUser).toHaveBeenCalledWith(testUserId, {
                photoURL: 'https://example.com/photo.jpg',
            });
        });

        it('should accept null photoURL', async () => {
            const updateData = {
                photoURL: null,
            };

            mockAuthService.updateUser.mockResolvedValue({});

            const result = await userService.updateProfile(testUserId, updateData);

            expect(result.photoURL).toBeNull();
            expect(mockAuthService.updateUser).toHaveBeenCalledWith(testUserId, {
                photoURL: null,
            });
        });

        it('should throw NOT_FOUND for non-existent user', async () => {
            const nonExistentUserId = 'non-existent-user';
            mockFirestoreReader.getUser.mockResolvedValue(null);
            const authError = new Error('User not found');
            (authError as any).code = 'auth/user-not-found';
            mockAuthService.updateUser.mockRejectedValue(authError);

            const updateData = {
                displayName: 'Test',
            };

            await expect(userService.updateProfile(nonExistentUserId, updateData)).rejects.toThrow(ApiError);
        });

        it('should validate multiple fields simultaneously', async () => {
            const updateData = {
                displayName: 'Valid Name',
                preferredLanguage: 'en',
                photoURL: 'https://example.com/photo.jpg',
            };

            mockAuthService.updateUser.mockResolvedValue({});

            // Mock the updated user data to be returned after update
            mockAuthService.getUser.mockResolvedValue({
                uid: testUserId,
                email: testUserEmail,
                displayName: 'Valid Name',
                emailVerified: true,
                photoURL: 'https://example.com/photo.jpg',
            });

            // Mock updated Firestore data
            const updatedUserDoc = MockFirestoreReader.createTestUser(testUserId, {
                email: testUserEmail,
                displayName: 'Valid Name',
                emailVerified: true,
                preferredLanguage: 'en',
                photoURL: 'https://example.com/photo.jpg',
            });
            mockFirestoreReader.mockUserExists(testUserId, updatedUserDoc);

            const result = await userService.updateProfile(testUserId, updateData);

            expect(result.displayName).toBe('Valid Name');
            expect(result.preferredLanguage).toBe('en');
            expect(result.photoURL).toBe('https://example.com/photo.jpg');
        });
    });

    describe('changePassword validation', () => {
        it('should validate password strength - minimum length', async () => {
            const changeData = {
                currentPassword: 'ValidCurrentPassword123!',
                newPassword: '123', // Too short
            };

            await expect(userService.changePassword(testUserId, changeData)).rejects.toThrow(ApiError);
        });

        it('should validate password strength - requires uppercase', async () => {
            const changeData = {
                currentPassword: 'ValidCurrentPassword123!',
                newPassword: 'newpassword123!', // No uppercase
            };

            await expect(userService.changePassword(testUserId, changeData)).rejects.toThrow(ApiError);
        });

        it('should validate password strength - requires lowercase', async () => {
            const changeData = {
                currentPassword: 'ValidCurrentPassword123!',
                newPassword: 'NEWPASSWORD123!', // No lowercase
            };

            await expect(userService.changePassword(testUserId, changeData)).rejects.toThrow(ApiError);
        });

        it('should validate password strength - requires number', async () => {
            const changeData = {
                currentPassword: 'ValidCurrentPassword123!',
                newPassword: 'NewPassword!', // No number
            };

            await expect(userService.changePassword(testUserId, changeData)).rejects.toThrow(ApiError);
        });

        it('should validate password strength - requires special character', async () => {
            const changeData = {
                currentPassword: 'ValidCurrentPassword123!',
                newPassword: 'NewPassword123', // No special character
            };

            await expect(userService.changePassword(testUserId, changeData)).rejects.toThrow(ApiError);
        });

        it('should accept valid strong password', async () => {
            const changeData = {
                currentPassword: 'OldPassword123!',
                newPassword: 'NewSecurePassword123!',
            };

            mockAuthService.verifyPassword.mockResolvedValue(true);
            mockAuthService.updateUser.mockResolvedValue(undefined);

            const result = await userService.changePassword(testUserId, changeData);

            expect(result.message).toBe('Password changed successfully');
            expect(mockAuthService.verifyPassword).toHaveBeenCalledWith(testUserEmail, 'OldPassword123!');
            expect(mockAuthService.updateUser).toHaveBeenCalledWith(testUserId, {
                password: 'NewSecurePassword123!',
            });
        });

        it('should validate current password is provided', async () => {
            const changeData = {
                currentPassword: '',
                newPassword: 'NewSecurePassword123!',
            };

            await expect(userService.changePassword(testUserId, changeData)).rejects.toThrow(ApiError);
        });

        it('should validate new password is different from current', async () => {
            const samePassword = 'SamePassword123!';
            const changeData = {
                currentPassword: samePassword,
                newPassword: samePassword,
            };

            await expect(userService.changePassword(testUserId, changeData)).rejects.toThrow(ApiError);
        });

        it('should throw NOT_FOUND for non-existent user', async () => {
            const nonExistentUserId = 'non-existent-user';
            mockFirestoreReader.getUser.mockResolvedValue(null);

            // Mock auth service to throw error for non-existent user
            const authError = new Error('User not found');
            (authError as any).code = 'auth/user-not-found';
            mockAuthService.getUser.mockRejectedValue(authError);

            const changeData = {
                currentPassword: 'OldPassword123!',
                newPassword: 'NewPassword123!',
            };

            await expect(userService.changePassword(nonExistentUserId, changeData)).rejects.toThrow(ApiError);
        });

        it('should handle incorrect current password', async () => {
            const changeData = {
                currentPassword: 'WrongPassword123!',
                newPassword: 'NewSecurePassword123!',
            };

            mockAuthService.verifyPassword.mockResolvedValue(false);

            await expect(userService.changePassword(testUserId, changeData)).rejects.toThrow(ApiError);
        });
    });

    describe('deleteAccount validation', () => {
        it('should require confirmation', async () => {
            const deleteData = {
                confirmDelete: false,
            };

            await expect(userService.deleteAccount(testUserId, deleteData)).rejects.toThrow(ApiError);
        });

        it('should require confirmation field to be present', async () => {
            const deleteData = {};

            await expect(userService.deleteAccount(testUserId, deleteData)).rejects.toThrow(ApiError);
        });

        it('should accept valid deletion request', async () => {
            const deleteData = {
                confirmDelete: true,
            };

            // Mock that user has no active groups
            mockFirestoreReader.getGroupsForUserV2.mockResolvedValue({ data: [], hasMore: false });
            mockAuthService.deleteUser.mockResolvedValue(undefined);

            const result = await userService.deleteAccount(testUserId, deleteData);

            expect(result.message).toBe('Account deleted successfully');
            expect(mockAuthService.deleteUser).toHaveBeenCalledWith(testUserId);
        });

        it('should prevent deletion of users with active groups', async () => {
            const deleteData = {
                confirmDelete: true,
            };

            // Mock that user has active groups
            const testGroup = MockFirestoreReader.createTestGroup('test-group', {
                name: 'Test Group',
                members: [testUserId],
            });
            mockFirestoreReader.getGroupsForUserV2.mockResolvedValue({ data: [testGroup], hasMore: false });

            await expect(userService.deleteAccount(testUserId, deleteData)).rejects.toThrow(ApiError);
        });

        it('should throw NOT_FOUND for non-existent user', async () => {
            const nonExistentUserId = 'non-existent-user';
            mockFirestoreReader.getUser.mockResolvedValue(null);
            // Mock the groups check for non-existent user
            mockFirestoreReader.getGroupsForUserV2.mockResolvedValue({ data: [], hasMore: false });

            const deleteData = {
                confirmDelete: true,
            };

            await expect(userService.deleteAccount(nonExistentUserId, deleteData)).rejects.toThrow(ApiError);
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

            await expect(userService.registerUser(registrationData)).rejects.toThrow(ApiError);
        });

        it('should validate password strength during registration', async () => {
            const registrationData = {
                email: 'newuser@example.com',
                password: 'weak', // Weak password
                displayName: 'Test User',
                termsAccepted: true,
                cookiePolicyAccepted: true,
            };

            await expect(userService.registerUser(registrationData)).rejects.toThrow(ApiError);
        });

        it('should require terms acceptance', async () => {
            const registrationData = {
                email: 'newuser@example.com',
                password: 'ValidPassword123!',
                displayName: 'Test User',
                termsAccepted: false,
                cookiePolicyAccepted: true,
            };

            await expect(userService.registerUser(registrationData)).rejects.toThrow(/Terms of Service/);
        });

        it('should require cookie policy acceptance', async () => {
            const registrationData = {
                email: 'newuser@example.com',
                password: 'ValidPassword123!',
                displayName: 'Test User',
                termsAccepted: true,
                cookiePolicyAccepted: false,
            };

            await expect(userService.registerUser(registrationData)).rejects.toThrow(/Cookie Policy/);
        });

        it('should validate displayName during registration', async () => {
            const registrationData = {
                email: 'newuser@example.com',
                password: 'ValidPassword123!',
                displayName: '', // Empty display name
                termsAccepted: true,
                cookiePolicyAccepted: true,
            };

            await expect(userService.registerUser(registrationData)).rejects.toThrow(ApiError);
        });

        it('should accept valid registration data', async () => {
            const registrationData = {
                email: 'newuser@example.com',
                password: 'ValidPassword123!',
                displayName: 'New User',
                termsAccepted: true,
                cookiePolicyAccepted: true,
            };

            const newUserId = 'new-user-id';
            mockAuthService.createUser.mockResolvedValue({
                uid: newUserId,
                email: registrationData.email,
                displayName: registrationData.displayName,
                emailVerified: false,
            });

            mockAuthService.getUser.mockResolvedValue({
                uid: newUserId,
                email: registrationData.email,
                displayName: registrationData.displayName,
                emailVerified: false,
                photoURL: null,
            });

            const result = await userService.registerUser(registrationData);

            expect(result.success).toBe(true);
            expect(result.message).toBe('Account created successfully');
            expect(result.user.uid).toBe(newUserId);
            expect(result.user.email).toBe(registrationData.email);
            expect(result.user.displayName).toBe(registrationData.displayName);
        });

        it('should reject registration with existing email', async () => {
            const registrationData = {
                email: testUserEmail, // Already exists
                password: 'ValidPassword123!',
                displayName: 'New User',
                termsAccepted: true,
                cookiePolicyAccepted: true,
            };

            mockAuthService.createUser.mockRejectedValue(new Error('Email already exists'));

            await expect(userService.registerUser(registrationData)).rejects.toThrow();
        });
    });

    describe('input sanitization', () => {
        it('should trim whitespace from displayName', async () => {
            const updateData = {
                displayName: '  Trimmed Name  ',
            };

            mockAuthService.updateUser.mockResolvedValue({});

            // Mock the updated user data to be returned after update
            mockAuthService.getUser.mockResolvedValue({
                uid: testUserId,
                email: testUserEmail,
                displayName: 'Trimmed Name',
                emailVerified: true,
                photoURL: null,
            });

            // Mock updated Firestore data
            const updatedUserDoc = MockFirestoreReader.createTestUser(testUserId, {
                email: testUserEmail,
                displayName: 'Trimmed Name',
                emailVerified: true,
            });
            mockFirestoreReader.mockUserExists(testUserId, updatedUserDoc);

            const result = await userService.updateProfile(testUserId, updateData);

            expect(result.displayName).toBe('Trimmed Name');
        });

        it('should handle special characters in displayName', async () => {
            const updateData = {
                displayName: 'Name with émojis 🎉 and açcénts',
            };

            mockAuthService.updateUser.mockResolvedValue({});

            // Mock the updated user data to be returned after update
            mockAuthService.getUser.mockResolvedValue({
                uid: testUserId,
                email: testUserEmail,
                displayName: 'Name with émojis 🎉 and açcénts',
                emailVerified: true,
                photoURL: null,
            });

            // Mock updated Firestore data
            const updatedUserDoc = MockFirestoreReader.createTestUser(testUserId, {
                email: testUserEmail,
                displayName: 'Name with émojis 🎉 and açcénts',
                emailVerified: true,
            });
            mockFirestoreReader.mockUserExists(testUserId, updatedUserDoc);

            const result = await userService.updateProfile(testUserId, updateData);

            expect(result.displayName).toBe('Name with émojis 🎉 and açcénts');
        });
    });
});
