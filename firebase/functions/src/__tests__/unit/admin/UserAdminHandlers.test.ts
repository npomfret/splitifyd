import { RegisteredUserBuilder } from '@splitifyd/test-support';
import { SystemUserRoles } from '@splitifyd/shared';
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserAdminHandlers } from '../../../admin/UserAdminHandlers';
import type { AuthenticatedRequest } from '../../../auth/middleware';
import { HTTP_STATUS } from '../../../constants';
import { ApiError } from '../../../utils/errors';
import { StubAuthService } from '../mocks/StubAuthService';
import type { IFirestoreWriter } from '../../../services/firestore/IFirestoreWriter';

describe('UserAdminHandlers - Unit Tests', () => {
    let handlers: UserAdminHandlers;
    let authService: StubAuthService;
    let mockFirestoreWriter: IFirestoreWriter;
    let mockReq: Partial<AuthenticatedRequest>;
    let mockRes: Partial<Response>;
    let jsonSpy: ReturnType<typeof vi.fn>;
    let statusSpy: ReturnType<typeof vi.fn>;

    // Helper to convert RegisteredUser to format compatible with setUser
    function toUserRecord(user: any) {
        return {
            ...user,
            photoURL: user.photoURL === null ? undefined : user.photoURL,
        };
    }

    beforeEach(() => {
        authService = new StubAuthService();

        // Create mock FirestoreWriter
        mockFirestoreWriter = {
            updateUser: vi.fn().mockResolvedValue({ id: 'test-user', success: true }),
        } as any;

        handlers = new UserAdminHandlers(authService, mockFirestoreWriter);

        // Setup mock request and response
        jsonSpy = vi.fn();
        statusSpy = vi.fn().mockReturnValue({ json: jsonSpy });

        mockReq = {
            params: {},
            body: {},
            user: undefined,
        };

        mockRes = {
            json: jsonSpy,
            status: statusSpy,
        };
    });

    describe('updateUser', () => {
        it('should successfully disable a user account', async () => {
            // Setup: Create a user
            const user = new RegisteredUserBuilder()
                .withUid('user1')
                .withEmail('user1@test.com')
                .withDisplayName('User One')
                .build();

            authService.setUser(user.uid, toUserRecord(user));

            // Setup request to disable user
            mockReq.params = { uid: 'user1' };
            mockReq.body = { disabled: true };
            mockReq.user = { uid: 'admin1', displayName: 'Admin', role: SystemUserRoles.SYSTEM_ADMIN };

            // Execute
            await handlers.updateUser(mockReq as AuthenticatedRequest, mockRes as Response);

            // Verify response
            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    uid: 'user1',
                    email: 'user1@test.com',
                    disabled: true,
                }),
            );

            // Verify user is disabled in auth service
            const updatedUser = await authService.getUser('user1');
            expect(updatedUser?.disabled).toBe(true);
        });

        it('should successfully enable a disabled user account', async () => {
            // Setup: Create a disabled user
            const user = new RegisteredUserBuilder()
                .withUid('user1')
                .withEmail('user1@test.com')
                .withDisplayName('User One')
                .build();

            authService.setUser(user.uid, { ...toUserRecord(user), disabled: true });

            // Setup request to enable user
            mockReq.params = { uid: 'user1' };
            mockReq.body = { disabled: false };
            mockReq.user = { uid: 'admin1', displayName: 'Admin', role: SystemUserRoles.SYSTEM_ADMIN };

            // Execute
            await handlers.updateUser(mockReq as AuthenticatedRequest, mockRes as Response);

            // Verify response
            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    uid: 'user1',
                    email: 'user1@test.com',
                    disabled: false,
                }),
            );

            // Verify user is enabled in auth service
            const updatedUser = await authService.getUser('user1');
            expect(updatedUser?.disabled).toBe(false);
        });

        it('should reject request with invalid UID', async () => {
            // Setup request with empty UID
            mockReq.params = { uid: '' };
            mockReq.body = { disabled: true };

            // Execute and expect error
            await expect(handlers.updateUser(mockReq as any as AuthenticatedRequest, mockRes as Response)).rejects.toThrow(ApiError);
            await expect(handlers.updateUser(mockReq as any as AuthenticatedRequest, mockRes as Response)).rejects.toThrow('User ID is required');
        });

        it('should reject request with non-boolean disabled field', async () => {
            // Setup
            const user = new RegisteredUserBuilder().withUid('user1').build();
            authService.setUser(user.uid, toUserRecord(user));

            mockReq.params = { uid: 'user1' };
            mockReq.body = { disabled: 'true' }; // String instead of boolean

            // Execute and expect error
            await expect(handlers.updateUser(mockReq as any as AuthenticatedRequest, mockRes as Response)).rejects.toThrow(ApiError);
            await expect(handlers.updateUser(mockReq as any as AuthenticatedRequest, mockRes as Response)).rejects.toThrow('boolean "disabled" field');
        });

        it('should reject request with extra fields', async () => {
            // Setup
            const user = new RegisteredUserBuilder().withUid('user1').build();
            authService.setUser(user.uid, toUserRecord(user));

            mockReq.params = { uid: 'user1' };
            mockReq.body = { disabled: true, email: 'new@test.com' }; // Extra field

            // Execute and expect error
            await expect(handlers.updateUser(mockReq as any as AuthenticatedRequest, mockRes as Response)).rejects.toThrow(ApiError);
            await expect(handlers.updateUser(mockReq as any as AuthenticatedRequest, mockRes as Response)).rejects.toThrow('Only "disabled" field is allowed');
        });

        it('should prevent user from disabling their own account', async () => {
            // Setup: Create a user
            const user = new RegisteredUserBuilder()
                .withUid('user1')
                .withEmail('user1@test.com')
                .build();

            authService.setUser(user.uid, toUserRecord(user));

            // Setup request where user tries to disable themselves
            mockReq.params = { uid: 'user1' };
            mockReq.body = { disabled: true };
            mockReq.user = { uid: 'user1', displayName: 'User One', role: SystemUserRoles.SYSTEM_ADMIN }; // Same UID

            // Execute and expect error
            await expect(handlers.updateUser(mockReq as any as AuthenticatedRequest, mockRes as Response)).rejects.toThrow(ApiError);
            await expect(handlers.updateUser(mockReq as any as AuthenticatedRequest, mockRes as Response)).rejects.toThrow('cannot disable your own account');
        });

        it('should return 404 for non-existent user', async () => {
            // Setup request for user that doesn't exist
            mockReq.params = { uid: 'nonexistent' };
            mockReq.body = { disabled: true };
            mockReq.user = { uid: 'admin1', displayName: 'Admin', role: SystemUserRoles.SYSTEM_ADMIN };

            // Execute and expect error
            await expect(handlers.updateUser(mockReq as any as AuthenticatedRequest, mockRes as Response)).rejects.toThrow(ApiError);

            try {
                await handlers.updateUser(mockReq as any as AuthenticatedRequest, mockRes as Response);
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).statusCode).toBe(HTTP_STATUS.NOT_FOUND);
                expect((error as ApiError).code).toBe('USER_NOT_FOUND');
            }
        });

        it('should validate that UID is a non-empty string', async () => {
            // Test with missing UID
            mockReq.params = {};
            mockReq.body = { disabled: true };

            await expect(handlers.updateUser(mockReq as any as AuthenticatedRequest, mockRes as Response)).rejects.toThrow('User ID is required');

            // Test with whitespace-only UID
            mockReq.params = { uid: '   ' };
            await expect(handlers.updateUser(mockReq as any as AuthenticatedRequest, mockRes as Response)).rejects.toThrow('User ID is required');
        });

        it('should handle missing disabled field', async () => {
            // Setup
            const user = new RegisteredUserBuilder().withUid('user1').build();
            authService.setUser(user.uid, toUserRecord(user));

            mockReq.params = { uid: 'user1' };
            mockReq.body = {}; // Missing disabled field

            // Execute and expect error
            await expect(handlers.updateUser(mockReq as any as AuthenticatedRequest, mockRes as Response)).rejects.toThrow('boolean "disabled" field');
        });
    });

    describe('updateUserRole', () => {
        beforeEach(() => {
            // Reset mock before each test
            vi.clearAllMocks();
        });

        it('should successfully update user role to system_admin', async () => {
            // Setup: Create a user
            const user = new RegisteredUserBuilder()
                .withUid('user1')
                .withEmail('user1@test.com')
                .withDisplayName('User One')
                .build();

            authService.setUser(user.uid, toUserRecord(user));

            // Setup request to promote to system_admin
            mockReq.params = { uid: 'user1' };
            mockReq.body = { role: SystemUserRoles.SYSTEM_ADMIN };
            mockReq.user = { uid: 'admin1', displayName: 'Admin', role: SystemUserRoles.SYSTEM_ADMIN };

            // Execute
            await handlers.updateUserRole(mockReq as AuthenticatedRequest, mockRes as Response);

            // Verify FirestoreWriter was called with correct role
            expect(mockFirestoreWriter.updateUser).toHaveBeenCalledWith('user1', { role: SystemUserRoles.SYSTEM_ADMIN });

            // Verify response
            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    uid: 'user1',
                    email: 'user1@test.com',
                    displayName: 'User One',
                }),
            );
        });

        it('should successfully update user role to tenant_admin', async () => {
            // Setup: Create a user
            const user = new RegisteredUserBuilder()
                .withUid('user2')
                .withEmail('user2@test.com')
                .build();

            authService.setUser(user.uid, toUserRecord(user));

            // Setup request to promote to tenant_admin
            mockReq.params = { uid: 'user2' };
            mockReq.body = { role: SystemUserRoles.TENANT_ADMIN };
            mockReq.user = { uid: 'admin1', displayName: 'Admin', role: SystemUserRoles.SYSTEM_ADMIN };

            // Execute
            await handlers.updateUserRole(mockReq as AuthenticatedRequest, mockRes as Response);

            // Verify FirestoreWriter was called with correct role
            expect(mockFirestoreWriter.updateUser).toHaveBeenCalledWith('user2', { role: SystemUserRoles.TENANT_ADMIN });

            // Verify response
            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    uid: 'user2',
                    email: 'user2@test.com',
                }),
            );
        });

        it('should successfully remove user role by setting to null', async () => {
            // Setup: Create a user with admin role
            const user = new RegisteredUserBuilder()
                .withUid('user3')
                .withEmail('user3@test.com')
                .build();

            authService.setUser(user.uid, toUserRecord(user));

            // Setup request to remove role
            mockReq.params = { uid: 'user3' };
            mockReq.body = { role: null };
            mockReq.user = { uid: 'admin1', displayName: 'Admin', role: SystemUserRoles.SYSTEM_ADMIN };

            // Execute
            await handlers.updateUserRole(mockReq as AuthenticatedRequest, mockRes as Response);

            // Verify FirestoreWriter was called with SYSTEM_USER (null defaults to system_user)
            expect(mockFirestoreWriter.updateUser).toHaveBeenCalledWith('user3', { role: SystemUserRoles.SYSTEM_USER });

            // Verify response
            expect(jsonSpy).toHaveBeenCalled();
        });

        it('should reject invalid role value', async () => {
            // Setup: Create a user
            const user = new RegisteredUserBuilder().withUid('user1').build();
            authService.setUser(user.uid, toUserRecord(user));

            // Setup request with invalid role
            mockReq.params = { uid: 'user1' };
            mockReq.body = { role: 'invalid_role' };
            mockReq.user = { uid: 'admin1', displayName: 'Admin', role: SystemUserRoles.SYSTEM_ADMIN };

            // Execute and expect error
            try {
                await handlers.updateUserRole(mockReq as AuthenticatedRequest, mockRes as Response);
                expect.fail('Expected updateUserRole to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).code).toBe('INVALID_ROLE');
                expect((error as ApiError).statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
            }

            // Verify FirestoreWriter was NOT called
            expect(mockFirestoreWriter.updateUser).not.toHaveBeenCalled();
        });

        it('should reject request with invalid UID', async () => {
            // Setup request with empty UID
            mockReq.params = { uid: '' };
            mockReq.body = { role: SystemUserRoles.SYSTEM_ADMIN };
            mockReq.user = { uid: 'admin1', displayName: 'Admin', role: SystemUserRoles.SYSTEM_ADMIN };

            // Execute and expect error
            await expect(handlers.updateUserRole(mockReq as AuthenticatedRequest, mockRes as Response)).rejects.toThrow(ApiError);
            await expect(handlers.updateUserRole(mockReq as AuthenticatedRequest, mockRes as Response)).rejects.toThrow('User ID is required');

            // Verify FirestoreWriter was NOT called
            expect(mockFirestoreWriter.updateUser).not.toHaveBeenCalled();
        });

        it('should reject request with extra fields', async () => {
            // Setup
            const user = new RegisteredUserBuilder().withUid('user1').build();
            authService.setUser(user.uid, toUserRecord(user));

            mockReq.params = { uid: 'user1' };
            mockReq.body = { role: SystemUserRoles.SYSTEM_ADMIN, email: 'new@test.com' }; // Extra field
            mockReq.user = { uid: 'admin1', displayName: 'Admin', role: SystemUserRoles.SYSTEM_ADMIN };

            // Execute and expect error
            try {
                await handlers.updateUserRole(mockReq as AuthenticatedRequest, mockRes as Response);
                expect.fail('Expected updateUserRole to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).code).toBe('INVALID_FIELDS');
                expect((error as ApiError).statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
            }

            // Verify FirestoreWriter was NOT called
            expect(mockFirestoreWriter.updateUser).not.toHaveBeenCalled();
        });

        it('should prevent user from changing their own role', async () => {
            // Setup: Create a user
            const user = new RegisteredUserBuilder()
                .withUid('user1')
                .withEmail('user1@test.com')
                .build();

            authService.setUser(user.uid, toUserRecord(user));

            // Setup request where user tries to change their own role
            mockReq.params = { uid: 'user1' };
            mockReq.body = { role: SystemUserRoles.SYSTEM_ADMIN };
            mockReq.user = { uid: 'user1', displayName: 'User One', role: SystemUserRoles.SYSTEM_USER }; // Same UID

            // Execute and expect error
            try {
                await handlers.updateUserRole(mockReq as AuthenticatedRequest, mockRes as Response);
                expect.fail('Expected updateUserRole to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).code).toBe('CANNOT_CHANGE_OWN_ROLE');
                expect((error as ApiError).statusCode).toBe(HTTP_STATUS.CONFLICT);
            }

            // Verify FirestoreWriter was NOT called
            expect(mockFirestoreWriter.updateUser).not.toHaveBeenCalled();
        });

        it('should return 404 for non-existent user', async () => {
            // Setup request for user that doesn't exist
            mockReq.params = { uid: 'nonexistent' };
            mockReq.body = { role: SystemUserRoles.SYSTEM_ADMIN };
            mockReq.user = { uid: 'admin1', displayName: 'Admin', role: SystemUserRoles.SYSTEM_ADMIN };

            // Execute and expect error
            await expect(handlers.updateUserRole(mockReq as AuthenticatedRequest, mockRes as Response)).rejects.toThrow(ApiError);

            try {
                await handlers.updateUserRole(mockReq as AuthenticatedRequest, mockRes as Response);
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).statusCode).toBe(HTTP_STATUS.NOT_FOUND);
                expect((error as ApiError).code).toBe('USER_NOT_FOUND');
            }

            // Verify FirestoreWriter was NOT called
            expect(mockFirestoreWriter.updateUser).not.toHaveBeenCalled();
        });

        it('should validate that UID is a non-empty string', async () => {
            // Test with missing UID
            mockReq.params = {};
            mockReq.body = { role: SystemUserRoles.SYSTEM_ADMIN };
            mockReq.user = { uid: 'admin1', displayName: 'Admin', role: SystemUserRoles.SYSTEM_ADMIN };

            await expect(handlers.updateUserRole(mockReq as AuthenticatedRequest, mockRes as Response)).rejects.toThrow('User ID is required');

            // Test with whitespace-only UID
            mockReq.params = { uid: '   ' };
            await expect(handlers.updateUserRole(mockReq as AuthenticatedRequest, mockRes as Response)).rejects.toThrow('User ID is required');
        });
    });
});
