import * as admin from 'firebase-admin';
import { Errors } from '../../utils/errors';

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
    },
}));

// Import after mocking
import { UserService } from '../../services/UserService';
import { firestoreDb } from '../../firebase';
import { logger } from '../../logger';

describe('UserService', () => {
    let userService: UserService;
    let mockGetUser: jest.Mock;
    let mockFirestoreGet: jest.Mock;

    beforeEach(() => {
        // Create a new instance for each test to ensure clean cache
        userService = new UserService();

        // Setup mocks
        mockGetUser = jest.fn();
        mockFirestoreGet = jest.fn();

        (admin.auth as jest.Mock) = jest.fn(() => ({
            getUser: mockGetUser,
        }));

        // Mock Firestore chain
        const mockDoc = jest.fn(() => ({
            get: mockFirestoreGet,
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
});