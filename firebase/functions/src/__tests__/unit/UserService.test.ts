import * as admin from 'firebase-admin';
import { Errors, ApiError } from '../../utils/errors';
import { HTTP_STATUS } from '../../constants';
import { AuthErrors } from '@splitifyd/shared';

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

// Import after mocking
import { UserService } from '../../services/userService';
import { firestoreDb } from '../../firebase';
import { logger } from '../../logger';
import { getCurrentPolicyVersions } from '../../auth/policy-helpers';
import { assignThemeColor } from '../../user-management/assign-theme-color';
import { validateRegisterRequest } from '../../auth/validation';

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
            const mockAuthUser = {
                uid: userId,
                email: 'test@example.com',
                displayName: 'Test User',
                photoURL: 'https://example.com/photo.jpg',
                emailVerified: true,
            };

            const mockFirestoreData = {
                themeColor: '#FF5733',
                preferredLanguage: 'en',
                createdAt: { seconds: 1234567890 },
                updatedAt: { seconds: 1234567900 },
            };

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
            const mockAuthUser = {
                uid: userId,
                email: 'test@example.com',
                displayName: 'Test User',
                photoURL: null,
                emailVerified: false,
            };

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
            const mockAuthUser = {
                uid: userId,
                email: 'test@example.com',
                displayName: 'Test User',
                photoURL: null,
                emailVerified: true,
            };

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
            const mockAuthUser = {
                uid: userId,
                email: undefined, // Missing required field
                displayName: 'Test User',
                photoURL: null,
                emailVerified: true,
            };

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
            const mockAuthUser = {
                uid: userId,
                email: 'test@example.com',
                displayName: undefined, // Missing required field
                photoURL: null,
                emailVerified: true,
            };

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
            const mockAuthUser = {
                uid: userId,
                email: 'test@example.com',
                displayName: 'Test User',
                photoURL: null,
                emailVerified: true,
            };

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
        const validRegisterData = {
            email: 'newuser@example.com',
            password: 'SecurePass123!',
            displayName: 'New User',
            termsAccepted: true,
            cookiePolicyAccepted: true,
        };

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
                    role: 'user',
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
            const dataWithoutAcceptance = {
                ...validRegisterData,
                termsAccepted: false,
                cookiePolicyAccepted: false,
            };
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
});