import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService, UserProfile } from '../../services/UserService2';
import { MockFirestoreReader } from '../../services/firestore/MockFirestoreReader';
import type { UserDocument } from '../../schemas';
import { firebaseAuth } from '../../firebase';
import type { UserRecord } from 'firebase-admin/auth';
import { ApiError } from '../../utils/errors';
import { Timestamp } from 'firebase-admin/firestore';

// Mock Firebase Auth
vi.mock('../../firebase', () => ({
    firebaseAuth: {
        getUser: vi.fn(),
        getUsers: vi.fn(),
        updateUser: vi.fn(),
        createUser: vi.fn(),
        deleteUser: vi.fn(),
    },
    firestoreDb: {},
}));

// Mock other dependencies
vi.mock('../../utils/performance-monitor', () => ({
    PerformanceMonitor: {
        monitorServiceCall: vi.fn((service, method, fn) => fn()),
    },
}));

vi.mock('../../utils/logger-context', () => ({
    LoggerContext: {
        update: vi.fn(),
        get: vi.fn(() => ({ userId: 'test-user' })),
    },
}));

vi.mock('../../services/serviceRegistration', () => ({
    getFirestoreValidationService: vi.fn(() => ({
        validateDocument: vi.fn(),
        validateBeforeWrite: vi.fn(),
    })),
    getGroupMemberService: vi.fn(() => ({
        getUserGroupsViaSubcollection: vi.fn(() => Promise.resolve([])),
    })),
}));

vi.mock('../../auth/policy-helpers', () => ({
    getCurrentPolicyVersions: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../user-management/assign-theme-color', () => ({
    assignThemeColor: vi.fn(() => Promise.resolve('#FF6B6B')),
}));

describe('UserService2 - Unit Tests', () => {
    let userService: UserService;
    let mockFirestoreReader: MockFirestoreReader;

    beforeEach(() => {
        mockFirestoreReader = new MockFirestoreReader();
        userService = new UserService(mockFirestoreReader);

        // Reset all mocks
        vi.clearAllMocks();
        mockFirestoreReader.resetAllMocks();
    });

    describe('getUser', () => {
        it('should return user profile with Firebase Auth and Firestore data', async () => {
            const userId = 'test-user-123';
            const mockAuthUser: UserRecord = {
                uid: userId,
                email: 'test@example.com',
                displayName: 'Test User',
                photoURL: 'https://example.com/photo.jpg',
                emailVerified: true,
            } as any as UserRecord;

            const mockFirestoreUser: UserDocument = {
                id: userId,
                email: 'test@example.com',
                displayName: 'Test User',
                themeColor: '#FF6B6B',
                preferredLanguage: 'en',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                role: 'system_user',
                acceptedPolicies: {},
            };

            // Mock Firebase Auth
            vi.mocked(firebaseAuth.getUser).mockResolvedValue(mockAuthUser);

            // Mock Firestore Reader
            mockFirestoreReader.getUser.mockResolvedValue(mockFirestoreUser);

            const result = await userService.getUser(userId);

            // Verify calls
            expect(firebaseAuth.getUser).toHaveBeenCalledWith(userId);
            expect(mockFirestoreReader.getUser).toHaveBeenCalledWith(userId);

            // Verify result
            expect(result).toEqual({
                uid: userId,
                email: 'test@example.com',
                displayName: 'Test User',
                photoURL: 'https://example.com/photo.jpg',
                emailVerified: true,
                themeColor: '#FF6B6B',
                preferredLanguage: 'en',
                createdAt: mockFirestoreUser.createdAt,
                updatedAt: mockFirestoreUser.updatedAt,
            });
        });

        it('should handle user with no Firestore data', async () => {
            const userId = 'test-user-456';
            const mockAuthUser: UserRecord = {
                uid: userId,
                email: 'test2@example.com',
                displayName: 'Test User 2',
                photoURL: null,
                emailVerified: false,
            } as any as UserRecord;

            // Mock Firebase Auth
            vi.mocked(firebaseAuth.getUser).mockResolvedValue(mockAuthUser);

            // Mock Firestore Reader returning null (no document)
            mockFirestoreReader.getUser.mockResolvedValue(null);

            const result = await userService.getUser(userId);

            // Should still return a profile with Auth data only
            expect(result).toEqual({
                uid: userId,
                email: 'test2@example.com',
                displayName: 'Test User 2',
                photoURL: null,
                emailVerified: false,
                themeColor: undefined,
                preferredLanguage: undefined,
                createdAt: undefined,
                updatedAt: undefined,
            });
        });

        it('should throw error for user not found in Firebase Auth', async () => {
            const userId = 'nonexistent-user';

            // Mock Firebase Auth throwing user not found error
            const authError = new Error('User not found');
            (authError as any).code = 'auth/user-not-found';
            vi.mocked(firebaseAuth.getUser).mockRejectedValue(authError);

            await expect(userService.getUser(userId)).rejects.toThrow(ApiError);
        });

        it('should cache user profiles for repeated requests', async () => {
            const userId = 'test-user-cache';
            const mockAuthUser: UserRecord = {
                uid: userId,
                email: 'cache@example.com',
                displayName: 'Cache User',
                photoURL: null,
                emailVerified: true,
            } as any as UserRecord;

            const mockFirestoreUser: UserDocument = {
                id: userId,
                email: 'cache@example.com',
                displayName: 'Cache User',
                themeColor: '#FF6B6B',
                role: 'system_user',
                acceptedPolicies: {},
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            vi.mocked(firebaseAuth.getUser).mockResolvedValue(mockAuthUser);
            mockFirestoreReader.getUser.mockResolvedValue(mockFirestoreUser);

            // First call
            const result1 = await userService.getUser(userId);

            // Second call - should use cache
            const result2 = await userService.getUser(userId);

            // Firebase Auth should only be called once
            expect(firebaseAuth.getUser).toHaveBeenCalledTimes(1);
            expect(mockFirestoreReader.getUser).toHaveBeenCalledTimes(1);

            // Results should be the same object (cached)
            expect(result1).toBe(result2);
        });
    });

    describe('getUsers', () => {
        it('should fetch multiple users efficiently', async () => {
            const userIds = ['user1', 'user2', 'user3'];
            const mockAuthUsers: UserRecord[] = [
                { uid: 'user1', email: 'user1@test.com', displayName: 'User 1', emailVerified: true } as any as UserRecord,
                { uid: 'user2', email: 'user2@test.com', displayName: 'User 2', emailVerified: true } as any as UserRecord,
                { uid: 'user3', email: 'user3@test.com', displayName: 'User 3', emailVerified: true } as any as UserRecord,
            ];

            const mockFirestoreUsers: (UserDocument | null)[] = [
                { id: 'user1', email: 'user1@test.com', displayName: 'User 1', themeColor: '#FF6B6B', role: 'system_user', acceptedPolicies: {}, createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
                { id: 'user2', email: 'user2@test.com', displayName: 'User 2', themeColor: '#4ECDC4', role: 'system_user', acceptedPolicies: {}, createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
                null, // User 3 has no Firestore data
            ];

            // Mock Firebase Auth batch call
            vi.mocked(firebaseAuth.getUsers).mockResolvedValue({
                users: mockAuthUsers,
                notFound: [],
            } as any);

            // Mock Firestore Reader calls
            mockFirestoreReader.getUser
                .mockResolvedValueOnce(mockFirestoreUsers[0])
                .mockResolvedValueOnce(mockFirestoreUsers[1])
                .mockResolvedValueOnce(mockFirestoreUsers[2]);

            const result = await userService.getUsers(userIds);

            // Verify Firebase Auth was called with correct identifiers
            expect(firebaseAuth.getUsers).toHaveBeenCalledWith([
                { uid: 'user1' },
                { uid: 'user2' },
                { uid: 'user3' },
            ]);

            // Verify Firestore Reader was called for each user
            expect(mockFirestoreReader.getUser).toHaveBeenCalledTimes(3);

            // Verify result contains all users
            expect(result.size).toBe(3);
            expect(result.get('user1')).toBeDefined();
            expect(result.get('user2')).toBeDefined();
            expect(result.get('user3')).toBeDefined();

            // Verify user 3 has no Firestore data
            const user3Profile = result.get('user3')!;
            expect(user3Profile.themeColor).toBeUndefined();
        });

        it('should handle empty input', async () => {
            const result = await userService.getUsers([]);

            expect(result.size).toBe(0);
            expect(firebaseAuth.getUsers).not.toHaveBeenCalled();
            expect(mockFirestoreReader.getUser).not.toHaveBeenCalled();
        });

        it('should use cache when available', async () => {
            const userIds = ['cached-user', 'new-user'];
            
            // Pre-populate cache by calling getUser first
            const cachedUserAuth: UserRecord = {
                uid: 'cached-user',
                email: 'cached@test.com',
                displayName: 'Cached User',
                emailVerified: true,
            } as any as UserRecord;

            const cachedUserFirestore: UserDocument = {
                id: 'cached-user',
                email: 'cached@test.com',
                displayName: 'Cached User',
                themeColor: '#FF6B6B',
                role: 'system_user',
                acceptedPolicies: {},
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            vi.mocked(firebaseAuth.getUser).mockResolvedValueOnce(cachedUserAuth);
            mockFirestoreReader.getUser.mockResolvedValueOnce(cachedUserFirestore);

            // Cache the first user
            await userService.getUser('cached-user');

            // Clear mock call counts
            vi.clearAllMocks();

            // Now mock for the batch call
            const newUserAuth: UserRecord = {
                uid: 'new-user',
                email: 'new@test.com',
                displayName: 'New User',
                emailVerified: true,
            } as any as UserRecord;

            vi.mocked(firebaseAuth.getUsers).mockResolvedValue({
                users: [newUserAuth],
                notFound: [],
            } as any);

            mockFirestoreReader.getUser.mockResolvedValueOnce({
                id: 'new-user',
                email: 'new@test.com',
                displayName: 'New User',
                themeColor: '#4ECDC4',
                role: 'system_user',
                acceptedPolicies: {},
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });

            const result = await userService.getUsers(userIds);

            // Should only fetch the uncached user
            expect(firebaseAuth.getUsers).toHaveBeenCalledWith([{ uid: 'new-user' }]);
            expect(mockFirestoreReader.getUser).toHaveBeenCalledTimes(1);
            expect(mockFirestoreReader.getUser).toHaveBeenCalledWith('new-user');

            // Should have both users in result
            expect(result.size).toBe(2);
            expect(result.get('cached-user')).toBeDefined();
            expect(result.get('new-user')).toBeDefined();
        });
    });

    describe('error handling', () => {
        it('should validate user record has required fields', async () => {
            const userId = 'invalid-user';
            const invalidAuthUser: UserRecord = {
                uid: userId,
                email: undefined,
                displayName: undefined,
            } as any as UserRecord;

            vi.mocked(firebaseAuth.getUser).mockResolvedValue(invalidAuthUser);

            await expect(userService.getUser(userId)).rejects.toThrow(
                'User invalid-user missing required fields: email and displayName are mandatory'
            );
        });

        it('should propagate Firestore reader errors', async () => {
            const userId = 'error-user';
            const mockAuthUser: UserRecord = {
                uid: userId,
                email: 'error@test.com',
                displayName: 'Error User',
                emailVerified: true,
            } as any as UserRecord;

            vi.mocked(firebaseAuth.getUser).mockResolvedValue(mockAuthUser);

            const firestoreError = new Error('Firestore connection failed');
            mockFirestoreReader.getUser.mockRejectedValue(firestoreError);

            await expect(userService.getUser(userId)).rejects.toThrow('Firestore connection failed');
        });
    });
});