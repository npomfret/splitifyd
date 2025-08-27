import * as admin from 'firebase-admin';
import { Errors, ApiError } from '../../utils/errors';
import { HTTP_STATUS } from '../../constants';
import { AuthErrors } from '@splitifyd/shared';

// Test builders to reduce noise and focus tests on what matters
class MockAuthUserBuilder {
    private authUser: any = {
        uid: 'test-user-id',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
        emailVerified: true,
    };

    withUid(uid: string): MockAuthUserBuilder {
        this.authUser.uid = uid;
        return this;
    }

    withEmail(email: string | undefined): MockAuthUserBuilder {
        this.authUser.email = email;
        return this;
    }

    withDisplayName(displayName: string | undefined): MockAuthUserBuilder {
        this.authUser.displayName = displayName;
        return this;
    }

    withPhotoURL(photoURL: string | null): MockAuthUserBuilder {
        this.authUser.photoURL = photoURL;
        return this;
    }

    withEmailVerified(emailVerified: boolean): MockAuthUserBuilder {
        this.authUser.emailVerified = emailVerified;
        return this;
    }

    build(): any {
        return { ...this.authUser };
    }
}

class MockFirestoreDataBuilder {
    private firestoreData: any = {};

    withThemeColor(themeColor: string | any): MockFirestoreDataBuilder {
        this.firestoreData.themeColor = themeColor;
        return this;
    }

    withPreferredLanguage(language: string): MockFirestoreDataBuilder {
        this.firestoreData.preferredLanguage = language;
        return this;
    }

    withCreatedAt(createdAt: any): MockFirestoreDataBuilder {
        this.firestoreData.createdAt = createdAt;
        return this;
    }

    withUpdatedAt(updatedAt: any): MockFirestoreDataBuilder {
        this.firestoreData.updatedAt = updatedAt;
        return this;
    }

    build(): any {
        return { ...this.firestoreData };
    }
}

class RegisterDataBuilder {
    private registerData: any = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        displayName: 'New User',
        termsAccepted: true,
        cookiePolicyAccepted: true,
    };

    withEmail(email: string): RegisterDataBuilder {
        this.registerData.email = email;
        return this;
    }

    withPassword(password: string): RegisterDataBuilder {
        this.registerData.password = password;
        return this;
    }

    withDisplayName(displayName: string): RegisterDataBuilder {
        this.registerData.displayName = displayName;
        return this;
    }

    withTermsAccepted(accepted: boolean): RegisterDataBuilder {
        this.registerData.termsAccepted = accepted;
        return this;
    }

    withCookiePolicyAccepted(accepted: boolean): RegisterDataBuilder {
        this.registerData.cookiePolicyAccepted = accepted;
        return this;
    }

    build(): any {
        return { ...this.registerData };
    }
}

// Mock Firebase modules with implementations
jest.mock('firebase-admin');
jest.mock('../../firebase', () => ({
    firestoreDb: {
        collection: jest.fn(),
    },
}));
jest.mock('../../logger', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
    },
}));
jest.mock('../../auth/policy-helpers', () => ({
    getCurrentPolicyVersions: jest.fn(),
}));
jest.mock('../../user-management/assign-theme-color', () => ({
    assignThemeColor: jest.fn(),
}));
jest.mock('../../auth/validation', () => ({
    validateRegisterRequest: jest.fn(),
}));
jest.mock('../../user/validation', () => ({
    validateUpdateUserProfile: jest.fn(),
    validateChangePassword: jest.fn(),
    validateDeleteUser: jest.fn(),
}));

// Import after mocking
import { UserService } from '../../services/UserService2';
import { firestoreDb } from '../../firebase';
import { logger } from '../../logger';
import { getCurrentPolicyVersions } from '../../auth/policy-helpers';
import { assignThemeColor } from '../../user-management/assign-theme-color';
import { validateRegisterRequest } from '../../auth/validation';
import { validateUpdateUserProfile, validateChangePassword, validateDeleteUser } from '../../user/validation';

describe('UserService', () => {
    let userService: UserService;
    let mockGetUser: jest.Mock;
    let mockCreateUser: jest.Mock;
    let mockDeleteUser: jest.Mock;
    let mockFirestoreGet: jest.Mock;
    let mockFirestoreSet: jest.Mock;

    beforeEach(() => {
        // Create a new instance for each test to ensure clean cache
        userService = new UserService();

        // Setup mocks
        mockGetUser = jest.fn();
        mockCreateUser = jest.fn();
        mockDeleteUser = jest.fn();
        mockFirestoreGet = jest.fn();
        mockFirestoreSet = jest.fn();

        (admin.auth as jest.Mock) = jest.fn(() => ({
            getUser: mockGetUser,
            createUser: mockCreateUser,
            deleteUser: mockDeleteUser,
        }));

        // Mock Firestore chain
        const mockDoc = jest.fn(() => ({
            get: mockFirestoreGet,
            set: mockFirestoreSet,
        }));

        const mockCollection = jest.fn(() => ({
            doc: mockDoc,
        }));

        (firestoreDb.collection as jest.Mock) = mockCollection;

        // Clear all mocks
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getUser', () => {
        it('should fetch user profile from Firebase Auth and Firestore', async () => {
            // Arrange
            const userId = 'test-user-id';
            const mockAuthUser = new MockAuthUserBuilder()
                .withPhotoURL('https://example.com/photo.jpg')
                .build();

            const mockFirestoreData = new MockFirestoreDataBuilder()
                .withThemeColor('#FF5733')
                .withPreferredLanguage('en')
                .withCreatedAt({ seconds: 1234567890 })
                .withUpdatedAt({ seconds: 1234567900 })
                .build();

            mockGetUser.mockResolvedValue(mockAuthUser);
            mockFirestoreGet.mockResolvedValue({
                data: () => mockFirestoreData,
            });

            // Act
            const result = await userService.getUser(userId);

            // Assert
            expect(result).toEqual({
                uid: userId,
                email: 'test@example.com',
                displayName: 'Test User',
                photoURL: 'https://example.com/photo.jpg',
                emailVerified: true,
                themeColor: '#FF5733',
                preferredLanguage: 'en',
                createdAt: { seconds: 1234567890 },
                updatedAt: { seconds: 1234567900 },
            });

            expect(mockGetUser).toHaveBeenCalledWith(userId);
            expect(mockFirestoreGet).toHaveBeenCalledTimes(1);
        });

        it('should handle user with no photoURL', async () => {
            // Arrange
            const userId = 'test-user-id';
            const mockAuthUser = new MockAuthUserBuilder()
                .withEmailVerified(false)
                .build();

            mockGetUser.mockResolvedValue(mockAuthUser);
            mockFirestoreGet.mockResolvedValue({
                data: () => null,
            });

            // Act
            const result = await userService.getUser(userId);

            // Assert
            expect(result).toEqual({
                uid: userId,
                email: 'test@example.com',
                displayName: 'Test User',
                photoURL: null,
                emailVerified: false,
                themeColor: undefined,
                preferredLanguage: undefined,
                createdAt: undefined,
                updatedAt: undefined,
            });
        });

        it('should return cached user on subsequent calls', async () => {
            // Arrange
            const userId = 'test-user-id';
            const mockAuthUser = new MockAuthUserBuilder().build();

            mockGetUser.mockResolvedValue(mockAuthUser);
            mockFirestoreGet.mockResolvedValue({
                data: () => null,
            });

            // Act - First call
            const result1 = await userService.getUser(userId);
            // Act - Second call
            const result2 = await userService.getUser(userId);

            // Assert
            expect(result1).toEqual(result2);
            expect(mockGetUser).toHaveBeenCalledTimes(1); // Should only be called once
            expect(mockFirestoreGet).toHaveBeenCalledTimes(1); // Should only be called once
        });

        it('should throw NOT_FOUND error when user does not exist in Firebase Auth', async () => {
            // Arrange
            const userId = 'non-existent-user';
            const authError = new Error('User not found') as any;
            authError.code = 'auth/user-not-found';

            mockGetUser.mockRejectedValue(authError);

            // Act & Assert
            await expect(userService.getUser(userId)).rejects.toEqual(
                Errors.NOT_FOUND('User not found')
            );

            expect(logger.error).toHaveBeenCalledWith(
                'User not found in Firebase Auth',
                { userId }
            );
        });

        it('should throw original error for other Firebase Auth errors', async () => {
            // Arrange
            const userId = 'test-user-id';
            const authError = new Error('Internal server error');

            mockGetUser.mockRejectedValue(authError);

            // Act & Assert
            await expect(userService.getUser(userId)).rejects.toEqual(authError);

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to get user profile',
                { error: authError, userId }
            );
        });

        it('should throw error when user is missing required fields (email)', async () => {
            // Arrange
            const userId = 'test-user-id';
            const mockAuthUser = new MockAuthUserBuilder()
                .withEmail(undefined) // Missing required field
                .build();

            mockGetUser.mockResolvedValue(mockAuthUser);

            // Act & Assert
            await expect(userService.getUser(userId)).rejects.toThrow(
                `User ${userId} missing required fields: email and displayName are mandatory`
            );

            expect(mockFirestoreGet).not.toHaveBeenCalled(); // Should not reach Firestore
        });

        it('should throw error when user is missing required fields (displayName)', async () => {
            // Arrange
            const userId = 'test-user-id';
            const mockAuthUser = new MockAuthUserBuilder()
                .withDisplayName(undefined) // Missing required field
                .build();

            mockGetUser.mockResolvedValue(mockAuthUser);

            // Act & Assert
            await expect(userService.getUser(userId)).rejects.toThrow(
                `User ${userId} missing required fields: email and displayName are mandatory`
            );

            expect(mockFirestoreGet).not.toHaveBeenCalled(); // Should not reach Firestore
        });

        it('should handle Firestore errors gracefully', async () => {
            // Arrange
            const userId = 'test-user-id';
            const mockAuthUser = new MockAuthUserBuilder().build();

            mockGetUser.mockResolvedValue(mockAuthUser);
            mockFirestoreGet.mockRejectedValue(new Error('Firestore error'));

            // Act & Assert
            await expect(userService.getUser(userId)).rejects.toThrow('Firestore error');

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to get user profile',
                expect.objectContaining({
                    error: expect.any(Error),
                    userId
                })
            );
        });
    });

    describe('registerUser', () => {
        const validRegisterData = new RegisterDataBuilder().build();

        const mockPolicyVersions = {
            terms: 'v1.0.0',
            privacy: 'v1.0.0',
            cookies: 'v1.0.0',
        };

        const mockThemeColor = {
            light: '#3B82F6',
            dark: '#60A5FA',
            name: 'blue',
            pattern: 'solid',
            assignedAt: '2024-01-01T00:00:00.000Z',
            colorIndex: 0,
        };

        beforeEach(() => {
            // Reset mocks for registerUser tests
            (validateRegisterRequest as jest.Mock).mockReturnValue(validRegisterData);
            (getCurrentPolicyVersions as jest.Mock).mockResolvedValue(mockPolicyVersions);
            (assignThemeColor as jest.Mock).mockResolvedValue(mockThemeColor);
            mockFirestoreSet.mockResolvedValue(undefined);
        });

        it('should successfully register a new user', async () => {
            // Arrange
            const mockUserRecord = {
                uid: 'new-user-id',
                email: validRegisterData.email,
                displayName: validRegisterData.displayName,
            };

            mockCreateUser.mockResolvedValue(mockUserRecord);

            // Act
            const result = await userService.registerUser(validRegisterData);

            // Assert
            expect(validateRegisterRequest).toHaveBeenCalledWith(validRegisterData);
            expect(mockCreateUser).toHaveBeenCalledWith({
                email: validRegisterData.email,
                password: validRegisterData.password,
                displayName: validRegisterData.displayName,
            });
            expect(getCurrentPolicyVersions).toHaveBeenCalled();
            expect(assignThemeColor).toHaveBeenCalledWith(mockUserRecord.uid);
            expect(mockFirestoreSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: validRegisterData.email,
                    displayName: validRegisterData.displayName,
                    role: 'system_user',
                    acceptedPolicies: mockPolicyVersions,
                    themeColor: mockThemeColor,
                    termsAcceptedAt: expect.anything(),
                    cookiePolicyAcceptedAt: expect.anything(),
                })
            );
            expect(logger.info).toHaveBeenCalledWith('user-registered', { id: mockUserRecord.uid });
            expect(result).toEqual({
                success: true,
                message: 'Account created successfully',
                user: {
                    uid: mockUserRecord.uid,
                    email: mockUserRecord.email,
                    displayName: mockUserRecord.displayName,
                },
            });
        });

        it('should register user without policy acceptance timestamps if not accepted', async () => {
            // Arrange
            const dataWithoutAcceptance = new RegisterDataBuilder()
                .withTermsAccepted(false)
                .withCookiePolicyAccepted(false)
                .build();
            (validateRegisterRequest as jest.Mock).mockReturnValue(dataWithoutAcceptance);

            const mockUserRecord = {
                uid: 'new-user-id',
                email: dataWithoutAcceptance.email,
                displayName: dataWithoutAcceptance.displayName,
            };

            mockCreateUser.mockResolvedValue(mockUserRecord);

            // Act
            await userService.registerUser(dataWithoutAcceptance);

            // Assert
            expect(mockFirestoreSet).toHaveBeenCalledWith(
                expect.not.objectContaining({
                    termsAcceptedAt: expect.anything(),
                    cookiePolicyAcceptedAt: expect.anything(),
                })
            );
        });

        it('should handle EMAIL_EXISTS error and throw ApiError with CONFLICT status', async () => {
            // Arrange
            const authError = new Error('Email already exists') as any;
            authError.code = AuthErrors.EMAIL_EXISTS;

            mockCreateUser.mockRejectedValue(authError);

            // Act & Assert
            await expect(userService.registerUser(validRegisterData)).rejects.toThrow(ApiError);
            await expect(userService.registerUser(validRegisterData)).rejects.toMatchObject({
                statusCode: HTTP_STATUS.CONFLICT,
                code: AuthErrors.EMAIL_EXISTS_CODE,
                message: 'An account with this email already exists',
            });
        });

        it('should cleanup orphaned auth user if Firestore operation fails', async () => {
            // Arrange
            const mockUserRecord = {
                uid: 'new-user-id',
                email: validRegisterData.email,
                displayName: validRegisterData.displayName,
            };

            mockCreateUser.mockResolvedValue(mockUserRecord);
            mockFirestoreSet.mockRejectedValue(new Error('Firestore error'));

            // Act & Assert
            await expect(userService.registerUser(validRegisterData)).rejects.toThrow('Firestore error');
            expect(mockDeleteUser).toHaveBeenCalledWith(mockUserRecord.uid);
        });

        it('should log error if cleanup of orphaned user fails', async () => {
            // Arrange
            const mockUserRecord = {
                uid: 'new-user-id',
                email: validRegisterData.email,
                displayName: validRegisterData.displayName,
            };

            mockCreateUser.mockResolvedValue(mockUserRecord);
            mockFirestoreSet.mockRejectedValue(new Error('Firestore error'));
            mockDeleteUser.mockRejectedValue(new Error('Cleanup failed'));

            // Act & Assert
            await expect(userService.registerUser(validRegisterData)).rejects.toThrow('Firestore error');
            expect(logger.error).toHaveBeenCalledWith(
                'Failed to cleanup orphaned auth user',
                expect.any(Error),
                { userId: mockUserRecord.uid }
            );
        });

        it('should throw validation errors from validateRegisterRequest', async () => {
            // Arrange
            const validationError = new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'INVALID_EMAIL_FORMAT',
                'Invalid email format'
            );
            (validateRegisterRequest as jest.Mock).mockImplementation(() => {
                throw validationError;
            });

            // Act & Assert
            await expect(userService.registerUser({ email: 'invalid' })).rejects.toThrow(validationError);
            expect(mockCreateUser).not.toHaveBeenCalled();
        });

        it('should re-throw non-auth errors without modification', async () => {
            // Arrange
            const genericError = new Error('Some unexpected error');
            mockCreateUser.mockRejectedValue(genericError);

            // Act & Assert
            await expect(userService.registerUser(validRegisterData)).rejects.toThrow(genericError);
        });

        it('should handle policy service failures', async () => {
            // Arrange
            const policyError = new ApiError(
                HTTP_STATUS.INTERNAL_ERROR,
                'POLICY_SERVICE_UNAVAILABLE',
                'Registration temporarily unavailable'
            );
            (getCurrentPolicyVersions as jest.Mock).mockRejectedValue(policyError);

            const mockUserRecord = {
                uid: 'new-user-id',
                email: validRegisterData.email,
                displayName: validRegisterData.displayName,
            };

            mockCreateUser.mockResolvedValue(mockUserRecord);

            // Act & Assert
            await expect(userService.registerUser(validRegisterData)).rejects.toThrow(policyError);
            expect(mockDeleteUser).toHaveBeenCalledWith(mockUserRecord.uid); // Should cleanup
        });

        it('should handle theme color assignment failures', async () => {
            // Arrange
            const themeError = new Error('Theme assignment failed');
            (assignThemeColor as jest.Mock).mockRejectedValue(themeError);

            const mockUserRecord = {
                uid: 'new-user-id',
                email: validRegisterData.email,
                displayName: validRegisterData.displayName,
            };

            mockCreateUser.mockResolvedValue(mockUserRecord);

            // Act & Assert
            await expect(userService.registerUser(validRegisterData)).rejects.toThrow(themeError);
            expect(mockDeleteUser).toHaveBeenCalledWith(mockUserRecord.uid); // Should cleanup
        });
    });

    describe('updateProfile', () => {
        let mockUpdateUser: jest.Mock;
        let mockFirestoreUpdate: jest.Mock;

        beforeEach(() => {
            mockUpdateUser = jest.fn();
            mockFirestoreUpdate = jest.fn();

            (admin.auth as jest.Mock).mockReturnValue({
                getUser: mockGetUser,
                updateUser: mockUpdateUser,
            });

            const mockDoc = {
                get: mockFirestoreGet,
                update: mockFirestoreUpdate,
            };

            const mockCollection = {
                doc: jest.fn().mockReturnValue(mockDoc),
            };

            (firestoreDb.collection as jest.Mock).mockReturnValue(mockCollection);

            // Setup default validation mock
            (validateUpdateUserProfile as jest.Mock).mockImplementation((body) => body);
        });

        it('should update user profile with displayName only', async () => {
            // Arrange
            const userId = 'test-user-id';
            const updateData = { displayName: 'Updated Name' };
            const mockAuthUser = new MockAuthUserBuilder()
                .withDisplayName('Updated Name')
                .build();
            const mockFirestoreData = new MockFirestoreDataBuilder()
                .withThemeColor('blue')
                .withPreferredLanguage('en')
                .withCreatedAt({ seconds: 1234567890, nanoseconds: 0 })
                .withUpdatedAt({ seconds: 1234567900, nanoseconds: 0 })
                .build();

            (validateUpdateUserProfile as jest.Mock).mockReturnValue(updateData);
            mockUpdateUser.mockResolvedValue(undefined);
            mockFirestoreUpdate.mockResolvedValue(undefined);
            mockGetUser.mockResolvedValue(mockAuthUser);
            mockFirestoreGet.mockResolvedValue({ data: () => mockFirestoreData });

            // Act
            const result = await userService.updateProfile(userId, updateData, 'en');

            // Assert
            expect(validateUpdateUserProfile).toHaveBeenCalledWith(updateData, 'en');
            expect(mockUpdateUser).toHaveBeenCalledWith(userId, { displayName: 'Updated Name' });
            expect(mockFirestoreUpdate).toHaveBeenCalledWith(expect.objectContaining({
                displayName: 'Updated Name',
                updatedAt: expect.anything(),
            }));
            expect(result).toEqual({
                uid: userId,
                email: 'test@example.com',
                displayName: 'Updated Name',
                photoURL: null,
                emailVerified: true,
                themeColor: 'blue',
                preferredLanguage: 'en',
                createdAt: mockFirestoreData.createdAt,
                updatedAt: mockFirestoreData.updatedAt,
            });
        });

        it('should update user profile with photoURL', async () => {
            // Arrange
            const userId = 'test-user-id';
            const updateData = { photoURL: 'https://example.com/photo.jpg' };
            const mockAuthUser = new MockAuthUserBuilder()
                .withPhotoURL('https://example.com/photo.jpg')
                .build();

            (validateUpdateUserProfile as jest.Mock).mockReturnValue(updateData);
            mockUpdateUser.mockResolvedValue(undefined);
            mockFirestoreUpdate.mockResolvedValue(undefined);
            mockGetUser.mockResolvedValue(mockAuthUser);
            mockFirestoreGet.mockResolvedValue({ data: () => ({}) });

            // Act
            const result = await userService.updateProfile(userId, updateData);

            // Assert
            expect(mockUpdateUser).toHaveBeenCalledWith(userId, { photoURL: 'https://example.com/photo.jpg' });
            expect(mockFirestoreUpdate).toHaveBeenCalledWith(expect.objectContaining({
                photoURL: 'https://example.com/photo.jpg',
                updatedAt: expect.anything(),
            }));
            expect(result.photoURL).toBe('https://example.com/photo.jpg');
        });

        it('should handle null photoURL (remove photo)', async () => {
            // Arrange
            const userId = 'test-user-id';
            const updateData = { photoURL: null };
            const mockAuthUser = new MockAuthUserBuilder().build();

            (validateUpdateUserProfile as jest.Mock).mockReturnValue(updateData);
            mockUpdateUser.mockResolvedValue(undefined);
            mockFirestoreUpdate.mockResolvedValue(undefined);
            mockGetUser.mockResolvedValue(mockAuthUser);
            mockFirestoreGet.mockResolvedValue({ data: () => ({}) });

            // Act
            const result = await userService.updateProfile(userId, updateData);

            // Assert
            expect(mockUpdateUser).toHaveBeenCalledWith(userId, { photoURL: null });
            expect(mockFirestoreUpdate).toHaveBeenCalledWith(expect.objectContaining({
                photoURL: null,
                updatedAt: expect.anything(),
            }));
            expect(result.photoURL).toBeNull();
        });

        it('should update preferredLanguage (Firestore only)', async () => {
            // Arrange
            const userId = 'test-user-id';
            const updateData = { preferredLanguage: 'en' };
            const mockAuthUser = new MockAuthUserBuilder().build();

            (validateUpdateUserProfile as jest.Mock).mockReturnValue(updateData);
            mockUpdateUser.mockResolvedValue(undefined);
            mockFirestoreUpdate.mockResolvedValue(undefined);
            mockGetUser.mockResolvedValue(mockAuthUser);
            mockFirestoreGet.mockResolvedValue({ data: () => ({ preferredLanguage: 'en' }) });

            // Act
            const result = await userService.updateProfile(userId, updateData);

            // Assert
            expect(mockUpdateUser).toHaveBeenCalledWith(userId, {}); // No Auth updates for language
            expect(mockFirestoreUpdate).toHaveBeenCalledWith(expect.objectContaining({
                preferredLanguage: 'en',
                updatedAt: expect.anything(),
            }));
            expect(result.preferredLanguage).toBe('en');
        });

        it('should update multiple fields at once', async () => {
            // Arrange
            const userId = 'test-user-id';
            const updateData = {
                displayName: 'New Name',
                photoURL: 'https://example.com/new.jpg',
                preferredLanguage: 'en',
            };
            const mockAuthUser = new MockAuthUserBuilder()
                .withDisplayName('New Name')
                .withPhotoURL('https://example.com/new.jpg')
                .build();

            (validateUpdateUserProfile as jest.Mock).mockReturnValue(updateData);
            mockUpdateUser.mockResolvedValue(undefined);
            mockFirestoreUpdate.mockResolvedValue(undefined);
            mockGetUser.mockResolvedValue(mockAuthUser);
            mockFirestoreGet.mockResolvedValue({ data: () => ({ preferredLanguage: 'en' }) });

            // Act
            const result = await userService.updateProfile(userId, updateData);

            // Assert
            expect(mockUpdateUser).toHaveBeenCalledWith(userId, {
                displayName: 'New Name',
                photoURL: 'https://example.com/new.jpg',
            });
            expect(mockFirestoreUpdate).toHaveBeenCalledWith(expect.objectContaining({
                displayName: 'New Name',
                photoURL: 'https://example.com/new.jpg',
                preferredLanguage: 'en',
                updatedAt: expect.anything(),
            }));
            expect(result.displayName).toBe('New Name');
            expect(result.photoURL).toBe('https://example.com/new.jpg');
            expect(result.preferredLanguage).toBe('en');
        });

        it('should clear cache after successful update', async () => {
            // Arrange
            const userId = 'test-user-id';
            const updateData = { displayName: 'New Name' };
            const mockAuthUser = new MockAuthUserBuilder()
                .withDisplayName('New Name')
                .build();

            (validateUpdateUserProfile as jest.Mock).mockReturnValue(updateData);
            mockUpdateUser.mockResolvedValue(undefined);
            mockFirestoreUpdate.mockResolvedValue(undefined);
            mockGetUser.mockResolvedValue(mockAuthUser);
            mockFirestoreGet.mockResolvedValue({ data: () => ({}) });

            // First, cache the user
            await userService.getUser(userId);
            expect(mockGetUser).toHaveBeenCalledTimes(1);

            // Act
            await userService.updateProfile(userId, updateData);

            // Assert - getUser should be called again (cache was cleared)
            expect(mockGetUser).toHaveBeenCalledTimes(2);
        });

        it('should throw validation error with localized message', async () => {
            // Arrange
            const userId = 'test-user-id';
            const validationError = Errors.INVALID_INPUT('Invalid display name');
            
            (validateUpdateUserProfile as jest.Mock).mockImplementation(() => {
                throw validationError;
            });

            // Act & Assert
            await expect(userService.updateProfile(userId, { displayName: '' }, 'en'))
                .rejects.toThrow(validationError);
            
            expect(validateUpdateUserProfile).toHaveBeenCalledWith({ displayName: '' }, 'en');
            expect(mockUpdateUser).not.toHaveBeenCalled();
        });

        it('should throw NOT_FOUND error when user does not exist', async () => {
            // Arrange
            const userId = 'non-existent-user';
            const updateData = { displayName: 'New Name' };
            const authError = { code: 'auth/user-not-found' };

            (validateUpdateUserProfile as jest.Mock).mockReturnValue(updateData);
            mockUpdateUser.mockRejectedValue(authError);

            // Act & Assert
            await expect(userService.updateProfile(userId, updateData))
                .rejects.toThrow(Errors.NOT_FOUND('User not found'));

            expect(logger.error).toHaveBeenCalledWith(
                'User not found in Firebase Auth',
                { userId }
            );
        });

        it('should throw original error for other Firebase Auth errors', async () => {
            // Arrange
            const userId = 'test-user-id';
            const updateData = { displayName: 'New Name' };
            const authError = new Error('Firebase Auth error');

            (validateUpdateUserProfile as jest.Mock).mockReturnValue(updateData);
            mockUpdateUser.mockRejectedValue(authError);

            // Act & Assert
            await expect(userService.updateProfile(userId, updateData))
                .rejects.toThrow(authError);

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to update user profile',
                { error: authError, userId }
            );
        });

        it('should handle Firestore update errors', async () => {
            // Arrange
            const userId = 'test-user-id';
            const updateData = { displayName: 'New Name' };
            const firestoreError = new Error('Firestore update failed');

            (validateUpdateUserProfile as jest.Mock).mockReturnValue(updateData);
            mockUpdateUser.mockResolvedValue(undefined);
            mockFirestoreUpdate.mockRejectedValue(firestoreError);

            // Act & Assert
            await expect(userService.updateProfile(userId, updateData))
                .rejects.toThrow(firestoreError);

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to update user profile',
                { error: firestoreError, userId }
            );
        });
    });

    describe('changePassword', () => {
        let mockUpdateUser: jest.Mock;
        let mockFirestoreUpdate: jest.Mock;

        beforeEach(() => {
            mockUpdateUser = jest.fn();
            mockFirestoreUpdate = jest.fn();

            (admin.auth as jest.Mock).mockReturnValue({
                getUser: mockGetUser,
                updateUser: mockUpdateUser,
            });

            const mockDoc = {
                update: mockFirestoreUpdate,
            };

            const mockCollection = {
                doc: jest.fn().mockReturnValue(mockDoc),
            };

            (firestoreDb.collection as jest.Mock).mockReturnValue(mockCollection);

            // Setup default validation mock
            (validateChangePassword as jest.Mock).mockImplementation((body) => body);
        });

        it('should change user password successfully', async () => {
            // Arrange
            const userId = 'test-user-id';
            const passwordData = {
                currentPassword: 'OldPass123!',
                newPassword: 'NewPass456!',
            };
            const mockUserRecord = new MockAuthUserBuilder().build();

            (validateChangePassword as jest.Mock).mockReturnValue(passwordData);
            mockGetUser.mockResolvedValue(mockUserRecord);
            mockUpdateUser.mockResolvedValue(undefined);
            mockFirestoreUpdate.mockResolvedValue(undefined);

            // Act
            const result = await userService.changePassword(userId, passwordData);

            // Assert
            expect(validateChangePassword).toHaveBeenCalledWith(passwordData);
            expect(mockGetUser).toHaveBeenCalledWith(userId);
            expect(mockUpdateUser).toHaveBeenCalledWith(userId, { password: 'NewPass456!' });
            expect(mockFirestoreUpdate).toHaveBeenCalledWith(expect.objectContaining({
                updatedAt: expect.anything(),
                passwordChangedAt: expect.anything(),
            }));
            expect(result).toEqual({ message: 'Password changed successfully' });
            expect(logger.info).toHaveBeenCalledWith('Password changed successfully', { userId });
        });

        it('should throw error when user email not found', async () => {
            // Arrange
            const userId = 'test-user-id';
            const passwordData = {
                currentPassword: 'OldPass123!',
                newPassword: 'NewPass456!',
            };
            const mockUserRecord = new MockAuthUserBuilder()
                .withEmail(undefined) // No email
                .build();

            (validateChangePassword as jest.Mock).mockReturnValue(passwordData);
            mockGetUser.mockResolvedValue(mockUserRecord);

            // Act & Assert
            await expect(userService.changePassword(userId, passwordData))
                .rejects.toThrow(Errors.INVALID_INPUT('User email not found'));

            expect(mockUpdateUser).not.toHaveBeenCalled();
        });

        it('should throw validation error', async () => {
            // Arrange
            const userId = 'test-user-id';
            const validationError = Errors.INVALID_INPUT('Passwords must be different');
            
            (validateChangePassword as jest.Mock).mockImplementation(() => {
                throw validationError;
            });

            // Act & Assert
            await expect(userService.changePassword(userId, { currentPassword: 'same', newPassword: 'same' }))
                .rejects.toThrow(validationError);
            
            expect(mockGetUser).not.toHaveBeenCalled();
        });

        it('should throw NOT_FOUND error when user does not exist', async () => {
            // Arrange
            const userId = 'non-existent-user';
            const passwordData = { currentPassword: 'old', newPassword: 'new' };
            const authError = { code: 'auth/user-not-found' };

            (validateChangePassword as jest.Mock).mockReturnValue(passwordData);
            mockGetUser.mockRejectedValue(authError);

            // Act & Assert
            await expect(userService.changePassword(userId, passwordData))
                .rejects.toThrow(Errors.NOT_FOUND('User not found'));

            expect(logger.error).toHaveBeenCalledWith(
                'User not found in Firebase Auth',
                { userId }
            );
        });

        it('should handle Firebase Auth update errors', async () => {
            // Arrange
            const userId = 'test-user-id';
            const passwordData = { currentPassword: 'old', newPassword: 'new' };
            const authError = new Error('Firebase Auth update failed');
            const mockUserRecord = { uid: userId, email: 'test@example.com' };

            (validateChangePassword as jest.Mock).mockReturnValue(passwordData);
            mockGetUser.mockResolvedValue(mockUserRecord);
            mockUpdateUser.mockRejectedValue(authError);

            // Act & Assert
            await expect(userService.changePassword(userId, passwordData))
                .rejects.toThrow(authError);

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to change password',
                { error: authError, userId }
            );
        });

        it('should handle Firestore update errors', async () => {
            // Arrange
            const userId = 'test-user-id';
            const passwordData = { currentPassword: 'old', newPassword: 'new' };
            const firestoreError = new Error('Firestore update failed');
            const mockUserRecord = { uid: userId, email: 'test@example.com' };

            (validateChangePassword as jest.Mock).mockReturnValue(passwordData);
            mockGetUser.mockResolvedValue(mockUserRecord);
            mockUpdateUser.mockResolvedValue(undefined);
            mockFirestoreUpdate.mockRejectedValue(firestoreError);

            // Act & Assert
            await expect(userService.changePassword(userId, passwordData))
                .rejects.toThrow(firestoreError);

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to change password',
                { error: firestoreError, userId }
            );
        });
    });

    describe('deleteAccount', () => {
        let mockDeleteUser: jest.Mock;
        let mockFirestoreDelete: jest.Mock;
        let mockFirestoreWhere: jest.Mock;
        let mockFirestoreGet: jest.Mock;

        beforeEach(() => {
            mockDeleteUser = jest.fn();
            mockFirestoreDelete = jest.fn();
            mockFirestoreWhere = jest.fn();
            mockFirestoreGet = jest.fn();

            (admin.auth as jest.Mock).mockReturnValue({
                deleteUser: mockDeleteUser,
            });

            const mockDoc = {
                delete: mockFirestoreDelete,
            };

            const mockCollection = {
                doc: jest.fn().mockReturnValue(mockDoc),
                where: mockFirestoreWhere,
            };

            mockFirestoreWhere.mockReturnValue({
                get: mockFirestoreGet,
            });

            (firestoreDb.collection as jest.Mock).mockImplementation((collection) => {
                if (collection === 'groups') {
                    return mockCollection;
                }
                return {
                    doc: jest.fn().mockReturnValue(mockDoc),
                };
            });

            // Setup default validation mock
            (validateDeleteUser as jest.Mock).mockImplementation(() => undefined);
        });

        it('should delete user account successfully', async () => {
            // Arrange
            const userId = 'test-user-id';
            const deleteData = { confirmDelete: true };

            (validateDeleteUser as jest.Mock).mockReturnValue(undefined);
            mockFirestoreGet.mockResolvedValue({ empty: true }); // No groups
            mockFirestoreDelete.mockResolvedValue(undefined);
            mockDeleteUser.mockResolvedValue(undefined);

            // Act
            const result = await userService.deleteAccount(userId, deleteData);

            // Assert
            expect(validateDeleteUser).toHaveBeenCalledWith(deleteData);
            expect(mockFirestoreWhere).toHaveBeenCalledWith(`data.members.${userId}`, '!=', null);
            expect(mockFirestoreDelete).toHaveBeenCalled();
            expect(mockDeleteUser).toHaveBeenCalledWith(userId);
            expect(result).toEqual({ message: 'Account deleted successfully' });
            expect(logger.info).toHaveBeenCalledWith('User account deleted successfully', { userId });
        });

        it('should prevent deletion when user has groups', async () => {
            // Arrange
            const userId = 'test-user-id';
            const deleteData = { confirmDelete: true };

            (validateDeleteUser as jest.Mock).mockReturnValue(undefined);
            mockFirestoreGet.mockResolvedValue({ 
                empty: false, // User has groups
                docs: [{ id: 'group1' }],
            });

            // Act & Assert
            await expect(userService.deleteAccount(userId, deleteData))
                .rejects.toThrow(Errors.INVALID_INPUT('Cannot delete account while member of groups. Please leave all groups first.'));

            expect(mockFirestoreDelete).not.toHaveBeenCalled();
            expect(mockDeleteUser).not.toHaveBeenCalled();
        });

        it('should throw validation error when confirmDelete is not true', async () => {
            // Arrange
            const userId = 'test-user-id';
            const validationError = Errors.INVALID_INPUT('Account deletion must be explicitly confirmed');
            
            (validateDeleteUser as jest.Mock).mockImplementation(() => {
                throw validationError;
            });

            // Act & Assert
            await expect(userService.deleteAccount(userId, { confirmDelete: false }))
                .rejects.toThrow(validationError);
            
            expect(mockFirestoreWhere).not.toHaveBeenCalled();
        });

        it('should throw NOT_FOUND error when user does not exist in Auth', async () => {
            // Arrange
            const userId = 'non-existent-user';
            const deleteData = { confirmDelete: true };
            const authError = { code: 'auth/user-not-found' };

            (validateDeleteUser as jest.Mock).mockReturnValue(undefined);
            mockFirestoreGet.mockResolvedValue({ empty: true });
            mockFirestoreDelete.mockResolvedValue(undefined);
            mockDeleteUser.mockRejectedValue(authError);

            // Act & Assert
            await expect(userService.deleteAccount(userId, deleteData))
                .rejects.toThrow(Errors.NOT_FOUND('User not found'));

            expect(logger.error).toHaveBeenCalledWith(
                'User not found in Firebase Auth',
                { userId }
            );
        });

        it('should handle Firestore query errors', async () => {
            // Arrange
            const userId = 'test-user-id';
            const deleteData = { confirmDelete: true };
            const firestoreError = new Error('Firestore query failed');

            (validateDeleteUser as jest.Mock).mockReturnValue(undefined);
            mockFirestoreGet.mockRejectedValue(firestoreError);

            // Act & Assert
            await expect(userService.deleteAccount(userId, deleteData))
                .rejects.toThrow(firestoreError);

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to delete user account',
                { error: firestoreError, userId }
            );
        });

        it('should handle Firestore deletion errors', async () => {
            // Arrange
            const userId = 'test-user-id';
            const deleteData = { confirmDelete: true };
            const firestoreError = new Error('Firestore delete failed');

            (validateDeleteUser as jest.Mock).mockReturnValue(undefined);
            mockFirestoreGet.mockResolvedValue({ empty: true });
            mockFirestoreDelete.mockRejectedValue(firestoreError);

            // Act & Assert
            await expect(userService.deleteAccount(userId, deleteData))
                .rejects.toThrow(firestoreError);

            expect(mockDeleteUser).not.toHaveBeenCalled(); // Should not delete from Auth if Firestore fails
            expect(logger.error).toHaveBeenCalledWith(
                'Failed to delete user account',
                { error: firestoreError, userId }
            );
        });

        it('should handle Firebase Auth deletion errors', async () => {
            // Arrange
            const userId = 'test-user-id';
            const deleteData = { confirmDelete: true };
            const authError = new Error('Auth delete failed');

            (validateDeleteUser as jest.Mock).mockReturnValue(undefined);
            mockFirestoreGet.mockResolvedValue({ empty: true });
            mockFirestoreDelete.mockResolvedValue(undefined);
            mockDeleteUser.mockRejectedValue(authError);

            // Act & Assert
            await expect(userService.deleteAccount(userId, deleteData))
                .rejects.toThrow(authError);

            // Note: Firestore was already deleted at this point
            expect(logger.error).toHaveBeenCalledWith(
                'Failed to delete user account',
                { error: authError, userId }
            );
        });
    });
});