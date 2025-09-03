import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticate, requireAdmin, authenticateAdmin, AuthenticatedRequest } from '../../../auth/middleware';
import { MockFirestoreReader } from '../../../services/firestore/MockFirestoreReader';
import { Errors } from '../../../utils/errors';
import { SystemUserRoles } from '@splitifyd/shared';

// Mock the service registration
const mockFirestoreReader = new MockFirestoreReader();
vi.mock('../../../services/serviceRegistration', () => ({
    getFirestoreReader: vi.fn(() => mockFirestoreReader)
}));

// Mock Firebase Auth
vi.mock('../../../firebase', () => ({
    firebaseAuth: {
        verifyIdToken: vi.fn(),
        getUser: vi.fn()
    }
}));

// Mock logger and errors
vi.mock('../../../logger', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn()
    },
    LoggerContext: {
        setUser: vi.fn()
    }
}));

vi.mock('../../../utils/errors', () => ({
    Errors: {
        UNAUTHORIZED: () => ({ code: 'UNAUTHORIZED', message: 'Unauthorized' }),
        INVALID_TOKEN: () => ({ code: 'INVALID_TOKEN', message: 'Invalid token' }),
        FORBIDDEN: () => ({ code: 'FORBIDDEN', message: 'Forbidden' })
    },
    sendError: vi.fn()
}));

describe('Authentication Middleware', () => {
    let mockReq: Partial<AuthenticatedRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let mockFirebaseAuth: any;
    let mockSendError: any;

    beforeEach(async () => {
        // Get the mocked modules
        const firebaseModule = await import('../../../firebase');
        const errorsModule = await import('../../../utils/errors');
        mockFirebaseAuth = firebaseModule.firebaseAuth;
        mockSendError = errorsModule.sendError;

        mockReq = {
            method: 'GET',
            headers: {
                authorization: 'Bearer valid-token',
                'x-correlation-id': 'test-correlation-id'
            }
        };
        mockRes = {
            status: vi.fn(() => mockRes as Response),
            json: vi.fn()
        };
        mockNext = vi.fn();

        // Reset all mocks
        vi.clearAllMocks();
        mockFirestoreReader.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('authenticate', () => {
        it('should skip authentication for OPTIONS requests', async () => {
            mockReq.method = 'OPTIONS';

            await authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith();
            expect(mockFirebaseAuth.verifyIdToken).not.toHaveBeenCalled();
        });

        it('should reject requests without Authorization header', async () => {
            mockReq.headers = { 'x-correlation-id': 'test-id' };

            await authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(mockSendError).toHaveBeenCalledWith(
                mockRes,
                Errors.UNAUTHORIZED(),
                'test-id'
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should reject requests with invalid Authorization header format', async () => {
            mockReq.headers!.authorization = 'Invalid token-format';

            await authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(mockSendError).toHaveBeenCalledWith(
                mockRes,
                Errors.UNAUTHORIZED(),
                'test-correlation-id'
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should authenticate user with valid token and user data', async () => {
            const mockUserRecord = {
                uid: 'test-user-id',
                email: 'test@example.com',
                displayName: 'Test User'
            };
            const mockUserDocument = {
                id: 'test-user-id',
                email: 'test@example.com',
                displayName: 'Test User',
                role: SystemUserRoles.SYSTEM_USER,
                emailVerified: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockFirebaseAuth.verifyIdToken.mockResolvedValue({ uid: 'test-user-id' });
            mockFirebaseAuth.getUser.mockResolvedValue(mockUserRecord);
            mockFirestoreReader.getUser.mockResolvedValue(mockUserDocument);

            await authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(mockFirebaseAuth.verifyIdToken).toHaveBeenCalledWith('valid-token');
            expect(mockFirebaseAuth.getUser).toHaveBeenCalledWith('test-user-id');
            expect(mockFirestoreReader.getUser).toHaveBeenCalledWith('test-user-id');
            
            expect(mockReq.user).toEqual({
                uid: 'test-user-id',
                email: 'test@example.com',
                displayName: 'Test User',
                role: SystemUserRoles.SYSTEM_USER
            });
            
            expect(mockNext).toHaveBeenCalledWith();
        });

        it('should default to SYSTEM_USER role when user document has no role', async () => {
            const mockUserRecord = {
                uid: 'test-user-id',
                email: 'test@example.com',
                displayName: 'Test User'
            };
            const mockUserDocument = {
                id: 'test-user-id',
                email: 'test@example.com',
                displayName: 'Test User',
                // No role field
                emailVerified: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockFirebaseAuth.verifyIdToken.mockResolvedValue({ uid: 'test-user-id' });
            mockFirebaseAuth.getUser.mockResolvedValue(mockUserRecord);
            mockFirestoreReader.getUser.mockResolvedValue(mockUserDocument);

            await authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(mockReq.user?.role).toBe(SystemUserRoles.SYSTEM_USER);
            expect(mockNext).toHaveBeenCalledWith();
        });

        it('should default to SYSTEM_USER role when user document does not exist', async () => {
            const mockUserRecord = {
                uid: 'test-user-id',
                email: 'test@example.com',
                displayName: 'Test User'
            };

            mockFirebaseAuth.verifyIdToken.mockResolvedValue({ uid: 'test-user-id' });
            mockFirebaseAuth.getUser.mockResolvedValue(mockUserRecord);
            mockFirestoreReader.getUser.mockResolvedValue(null);

            await authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(mockReq.user?.role).toBe(SystemUserRoles.SYSTEM_USER);
            expect(mockNext).toHaveBeenCalledWith();
        });

        it('should reject when Firebase Auth user has missing required fields', async () => {
            const mockUserRecord = {
                uid: 'test-user-id',
                email: 'test@example.com'
                // Missing displayName
            };

            mockFirebaseAuth.verifyIdToken.mockResolvedValue({ uid: 'test-user-id' });
            mockFirebaseAuth.getUser.mockResolvedValue(mockUserRecord);

            await authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(mockSendError).toHaveBeenCalledWith(
                mockRes,
                Errors.INVALID_TOKEN(),
                'test-correlation-id'
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle Firebase Auth token verification errors', async () => {
            mockFirebaseAuth.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

            await authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(mockSendError).toHaveBeenCalledWith(
                mockRes,
                Errors.INVALID_TOKEN(),
                'test-correlation-id'
            );
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('requireAdmin', () => {
        it('should skip admin check for OPTIONS requests', async () => {
            mockReq.method = 'OPTIONS';

            await requireAdmin(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith();
        });

        it('should reject requests without authenticated user', async () => {
            // No user set on request

            await requireAdmin(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(mockSendError).toHaveBeenCalledWith(
                mockRes,
                Errors.UNAUTHORIZED(),
                'test-correlation-id'
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should reject requests from non-admin users', async () => {
            mockReq.user = {
                uid: 'test-user-id',
                email: 'test@example.com',
                displayName: 'Test User',
                role: SystemUserRoles.SYSTEM_USER
            };

            await requireAdmin(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(mockSendError).toHaveBeenCalledWith(
                mockRes,
                Errors.FORBIDDEN(),
                'test-correlation-id'
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should allow requests from admin users', async () => {
            mockReq.user = {
                uid: 'admin-user-id',
                email: 'admin@example.com',
                displayName: 'Admin User',
                role: SystemUserRoles.SYSTEM_ADMIN
            };

            await requireAdmin(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith();
        });
    });

    describe('authenticateAdmin', () => {
        it('should combine authenticate and requireAdmin functionality', async () => {
            const mockUserRecord = {
                uid: 'admin-user-id',
                email: 'admin@example.com',
                displayName: 'Admin User'
            };
            const mockUserDocument = {
                id: 'admin-user-id',
                email: 'admin@example.com',
                displayName: 'Admin User',
                role: SystemUserRoles.SYSTEM_ADMIN,
                emailVerified: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockFirebaseAuth.verifyIdToken.mockResolvedValue({ uid: 'admin-user-id' });
            mockFirebaseAuth.getUser.mockResolvedValue(mockUserRecord);
            mockFirestoreReader.getUser.mockResolvedValue(mockUserDocument);

            await authenticateAdmin(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(mockFirebaseAuth.verifyIdToken).toHaveBeenCalledWith('valid-token');
            expect(mockFirestoreReader.getUser).toHaveBeenCalledWith('admin-user-id');
            expect(mockNext).toHaveBeenCalledWith();
        });

        it('should reject non-admin users in combined flow', async () => {
            const mockUserRecord = {
                uid: 'regular-user-id',
                email: 'user@example.com',
                displayName: 'Regular User'
            };
            const mockUserDocument = {
                id: 'regular-user-id',
                email: 'user@example.com',
                displayName: 'Regular User',
                role: SystemUserRoles.SYSTEM_USER,
                emailVerified: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockFirebaseAuth.verifyIdToken.mockResolvedValue({ uid: 'regular-user-id' });
            mockFirebaseAuth.getUser.mockResolvedValue(mockUserRecord);
            mockFirestoreReader.getUser.mockResolvedValue(mockUserDocument);

            await authenticateAdmin(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(mockSendError).toHaveBeenCalledWith(
                mockRes,
                Errors.FORBIDDEN(),
                'test-correlation-id'
            );
            expect(mockNext).not.toHaveBeenCalled();
        });
    });
});