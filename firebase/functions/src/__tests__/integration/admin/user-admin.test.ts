import type { PooledTestUser } from '@billsplit-wl/shared';
import { ApiDriver, borrowTestUsers } from '@billsplit-wl/test-support';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { FirestoreCollections } from '../../../constants';
import { getAuth, getFirestore } from '../../../firebase';

/**
 * Integration tests for User Admin Management endpoints
 * Tests the PUT /admin/users/:uid endpoint for disabling/enabling user accounts
 */
describe('Admin User Management - Integration Tests', () => {
    const apiDriver = new ApiDriver();
    const db = getFirestore();
    const auth = getAuth();

    let adminUser: PooledTestUser;
    let targetUser: PooledTestUser;

    beforeAll(async () => {
        // Get test users from pool
        const users = await borrowTestUsers(2);
        adminUser = users[0];
        targetUser = users[1];

        // Ensure both users are enabled before tests
        await auth.updateUser(adminUser.uid, { disabled: false });
        await auth.updateUser(targetUser.uid, { disabled: false });

        // Promote first user to system admin in Firestore
        await db.collection(FirestoreCollections.USERS).doc(adminUser.uid).set({
            email: adminUser.email,
            displayName: `Admin ${adminUser.uid}`,
            photoURL: null,
            role: 'system_admin',
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Create normal user in Firestore
        await db.collection(FirestoreCollections.USERS).doc(targetUser.uid).set({
            email: targetUser.email,
            displayName: `User ${targetUser.uid}`,
            photoURL: null,
            role: 'system_user',
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    });

    afterAll(async () => {
        // Re-enable both users after tests to clean up
        await auth.updateUser(adminUser.uid, { disabled: false });
        await auth.updateUser(targetUser.uid, { disabled: false });
    });

    describe('PUT /admin/users/:uid - Disable User', () => {
        it('should successfully disable a user account', async () => {
            // Execute: Disable the target user
            const response = await apiDriver.updateUser(targetUser.uid, { disabled: true }, adminUser.token);

            // Verify: Response contains updated user record
            expect(response).toMatchObject({
                uid: targetUser.uid,
                email: targetUser.email,
                disabled: true,
            });

            // Verify: User is actually disabled in Firebase Auth
            const userRecord = await auth.getUser(targetUser.uid);
            expect(userRecord.disabled).toBe(true);
        });

        it('should successfully enable a disabled user account', async () => {
            // Setup: Ensure user is disabled
            await auth.updateUser(targetUser.uid, { disabled: true });

            // Execute: Enable the target user
            const response = await apiDriver.updateUser(targetUser.uid, { disabled: false }, adminUser.token);

            // Verify: Response contains updated user record
            expect(response).toMatchObject({
                uid: targetUser.uid,
                email: targetUser.email,
                disabled: false,
            });

            // Verify: User is actually enabled in Firebase Auth
            const userRecord = await auth.getUser(targetUser.uid);
            expect(userRecord.disabled).toBe(false);
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
            expect((error as any).response?.error?.code).toBe('INVALID_FIELDS');
            expect((error as any).response?.error?.message).toContain('Only "disabled" field is allowed');
        });

        it('should return 404 for non-existent user', async () => {
            const error = await apiDriver.updateUser('nonexistent-uid-12345', { disabled: true }, adminUser.token).catch(e => e);
            expect(error).toBeInstanceOf(Error);
            expect((error as any).status).toBe(HTTP_STATUS.NOT_FOUND);
            expect((error as any).response?.error?.code).toBe('USER_NOT_FOUND');
        });
    });

    describe('PUT /admin/users/:uid - Security', () => {
        it('should prevent user from disabling their own account', async () => {
            const error = await apiDriver.updateUser(adminUser.uid, { disabled: true }, adminUser.token).catch(e => e);

            expect(error).toBeInstanceOf(Error);
            expect((error as any).status).toBe(HTTP_STATUS.CONFLICT);
            expect((error as any).response?.error?.code).toBe('CANNOT_DISABLE_SELF');

            // Verify: Admin user is still enabled
            const userRecord = await auth.getUser(adminUser.uid);
            expect(userRecord.disabled).toBeFalsy();
        });

        it('should require authentication', async () => {
            const error = await apiDriver.updateUser(targetUser.uid, { disabled: true }, '').catch(e => e);
            expect(error).toBeInstanceOf(Error);
            expect((error as any).status).toBe(HTTP_STATUS.UNAUTHORIZED);
        });

        it('should require system admin role', async () => {
            // Execute: Target user (non-admin) tries to disable someone
            const error = await apiDriver.updateUser(adminUser.uid, { disabled: true }, targetUser.token).catch(e => e);
            expect(error).toBeInstanceOf(Error);
            expect((error as any).status).toBe(HTTP_STATUS.FORBIDDEN);
        });
    });
});
