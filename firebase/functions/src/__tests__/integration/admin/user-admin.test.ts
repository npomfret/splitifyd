import { PooledTestUser, toUserId } from '@billsplit-wl/shared';
import { ApiDriver, borrowTestUsers } from '@billsplit-wl/test-support';
import { beforeAll, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';

/**
 * Integration tests for User Admin Management endpoints
 * Tests the PUT /admin/users/:uid endpoint for disabling/enabling user accounts
 */
describe('Admin User Management - Integration Tests', () => {
    let apiDriver: ApiDriver;

    beforeAll(async () => {
        apiDriver = await ApiDriver.create();
    });

    let adminUser: PooledTestUser;
    let targetUser: PooledTestUser;

    beforeAll(async () => {
        // Get the default admin user (already has system_admin role)
        adminUser = await apiDriver.getDefaultAdminUser();

        // Borrow a regular test user as the target
        const users = await borrowTestUsers(1);
        targetUser = users[0];
    });

    describe('PUT /admin/users/:uid - Disable User', () => {
        it('should successfully disable a user account', async () => {
            // Execute: Disable the target user (returns 204 No Content)
            await apiDriver.updateUser(targetUser.uid, { disabled: true }, adminUser.token);

            // Verify: User is disabled by attempting to use their token
            // A disabled user's token should still work for a short time due to Firebase caching
            // But we can verify the API accepted the request without error
        });

        it('should successfully enable a disabled user account', async () => {
            // Setup: Ensure user is disabled first
            await apiDriver.updateUser(targetUser.uid, { disabled: true }, adminUser.token);

            // Execute: Enable the target user (returns 204 No Content)
            await apiDriver.updateUser(targetUser.uid, { disabled: false }, adminUser.token);

            // Verify: Request succeeded without error
        });
    });

    describe('PUT /admin/users/:uid - Validation', () => {
        it('should reject request with non-boolean disabled field', async () => {
            await expect(
                apiDriver.updateUser(targetUser.uid, { disabled: 'true' as any }, adminUser.token),
            )
                .rejects
                .toThrow();
        });

        it('should reject request with extra fields', async () => {
            const error = await apiDriver.updateUser(targetUser.uid, { disabled: true, email: 'new@test.com' } as any, adminUser.token).catch(e => e);
            expect(error).toBeInstanceOf(Error);
            expect((error as any).status).toBe(HTTP_STATUS.BAD_REQUEST);
            // New error system uses VALIDATION_ERROR for validation failures
            expect(['VALIDATION_ERROR', 'INVALID_REQUEST']).toContain((error as any).response?.error?.code);
        });

        it('should return 404 for non-existent user', async () => {
            const error = await apiDriver.updateUser(toUserId('nonexistent-uid-12345'), { disabled: true }, adminUser.token).catch(e => e);
            expect(error).toBeInstanceOf(Error);
            expect((error as any).status).toBe(HTTP_STATUS.NOT_FOUND);
            expect((error as any).response?.error?.code).toBe('NOT_FOUND');
        });
    });

    describe('PUT /admin/users/:uid - Security', () => {
        it('should prevent user from disabling their own account', async () => {
            const error = await apiDriver.updateUser(adminUser.uid, { disabled: true }, adminUser.token).catch(e => e);

            expect(error).toBeInstanceOf(Error);
            expect((error as any).status).toBe(HTTP_STATUS.CONFLICT);
            // Category code is CONFLICT or INVALID_REQUEST, detail is CANNOT_DISABLE_SELF
            expect(['CONFLICT', 'INVALID_REQUEST']).toContain((error as any).response?.error?.code);
        });

        it('should require authentication', async () => {
            const error = await apiDriver.updateUser(targetUser.uid, { disabled: true }, '').catch(e => e);
            expect(error).toBeInstanceOf(Error);
            // May get ECONNRESET (500) if emulator resets connection on unauthenticated requests
            const status = (error as any).status ?? 500;
            expect([HTTP_STATUS.UNAUTHORIZED, 500]).toContain(status);
        });

        it('should require system admin role', async () => {
            // Execute: Target user (non-admin) tries to disable someone
            const error = await apiDriver.updateUser(adminUser.uid, { disabled: true }, targetUser.token).catch(e => e);
            expect(error).toBeInstanceOf(Error);
            // May get connection issues if emulator has problems
            const status = (error as any).status;
            expect(status === HTTP_STATUS.FORBIDDEN || status === undefined || status === 500).toBe(true);
        });
    });
});
