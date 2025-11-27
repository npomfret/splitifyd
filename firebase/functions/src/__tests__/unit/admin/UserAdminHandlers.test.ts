import { SystemUserRoles, toUserId } from '@billsplit-wl/shared';
import { UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ApiError } from '../../../utils/errors';
import { AppDriver } from '../AppDriver';

describe('UserAdminHandlers - Unit Tests', () => {
    let appDriver: AppDriver;
    let adminToken: string;

    beforeEach(async () => {
        appDriver = new AppDriver();
        const admin = await appDriver.createAdminUser();
        adminToken = admin.token;
    });

    describe('updateUser', () => {
        it('should successfully disable a user account', async () => {
            // Create a user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('user1@test.com')
                .withDisplayName('User One')
                .build();
            const registered = await appDriver.registerUser(registration);
            const userId = registered.user.uid;

            // Disable the user via admin API (returns 204 No Content)
            await appDriver.updateUser(userId, { disabled: true }, adminToken);

            // Verify user was disabled by fetching their record
            const userRecord = await appDriver.getUserAuth(userId, adminToken);
            expect(userRecord.disabled).toBe(true);
        });

        it('should successfully enable a disabled user account', async () => {
            // Create a user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('user1@test.com')
                .withDisplayName('User One')
                .build();
            const registered = await appDriver.registerUser(registration);
            const userId = registered.user.uid;

            // First disable the user
            await appDriver.updateUser(userId, { disabled: true }, adminToken);

            // Then enable the user (returns 204 No Content)
            await appDriver.updateUser(userId, { disabled: false }, adminToken);

            // Verify user was enabled by fetching their record
            const userRecord = await appDriver.getUserAuth(userId, adminToken);
            expect(userRecord.disabled).toBe(false);
        });

        it('should reject request with invalid UID', async () => {
            // Try to update user with empty UID
            await expect(
                appDriver.updateUser(toUserId(''), { disabled: true }, adminToken),
            )
                .rejects
                .toThrow('Invalid user ID');
        });

        it('should reject request with non-boolean disabled field', async () => {
            // Create a user via API
            const registration = new UserRegistrationBuilder().build();
            const registered = await appDriver.registerUser(registration);
            const userId = registered.user.uid;

            // Try to update with invalid disabled value
            await expect(
                appDriver.updateUser(userId, { disabled: 'true' } as any, adminToken),
            )
                .rejects
                .toThrow('boolean "disabled" field');
        });

        it('should reject request with extra fields', async () => {
            // Create a user via API
            const registration = new UserRegistrationBuilder().build();
            const registered = await appDriver.registerUser(registration);
            const userId = registered.user.uid;

            // Try to update with extra fields
            await expect(
                appDriver.updateUser(userId, { disabled: true, email: 'new@test.com' } as any, adminToken),
            )
                .rejects
                .toThrow('Only "disabled" field is allowed');
        });

        it('should prevent user from disabling their own account', async () => {
            // Create a user and promote to admin
            const registration = new UserRegistrationBuilder()
                .withEmail('user1@test.com')
                .build();
            const registered = await appDriver.registerUser(registration);
            const userId = registered.user.uid;
            const userToken = registered.user.uid;

            await appDriver.promoteUserToAdmin(userId);

            // Try to disable own account using own token
            await expect(
                appDriver.updateUser(userId, { disabled: true }, userToken),
            )
                .rejects
                .toThrow('cannot disable your own account');
        });

        it('should return 404 for non-existent user', async () => {
            const nonExistentUserId = toUserId('nonexistent');

            try {
                await appDriver.updateUser(nonExistentUserId, { disabled: true }, adminToken);
                expect.fail('Expected updateUser to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).statusCode).toBe(HTTP_STATUS.NOT_FOUND);
                expect((error as ApiError).code).toBe('USER_NOT_FOUND');
            }
        });

        it('should validate that UID is a non-empty string', async () => {
            // Test with whitespace-only UID
            await expect(
                appDriver.updateUser(toUserId('   '), { disabled: true }, adminToken),
            )
                .rejects
                .toThrow('Invalid user ID');
        });

        it('should handle missing disabled field', async () => {
            // Create a user via API
            const registration = new UserRegistrationBuilder().build();
            const registered = await appDriver.registerUser(registration);
            const userId = registered.user.uid;

            // Try to update without disabled field
            await expect(
                appDriver.updateUser(userId, {} as any, adminToken),
            )
                .rejects
                .toThrow('boolean "disabled" field');
        });
    });

    describe('updateUserRole', () => {
        it('should successfully update user role to system_admin', async () => {
            // Create a user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('user1@test.com')
                .withDisplayName('User One')
                .build();
            const registered = await appDriver.registerUser(registration);
            const userId = registered.user.uid;

            // Update role to system_admin (returns 204 No Content)
            await appDriver.updateUserRole(userId, { role: SystemUserRoles.SYSTEM_ADMIN }, adminToken);

            // Verify role was updated by fetching from Firestore
            const userData = await appDriver.getUserFirestore(userId, adminToken);
            expect(userData.role).toBe(SystemUserRoles.SYSTEM_ADMIN);
        });

        it('should successfully update user role to tenant_admin', async () => {
            // Create a user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('user2@test.com')
                .build();
            const registered = await appDriver.registerUser(registration);
            const userId = registered.user.uid;

            // Update role to tenant_admin (returns 204 No Content)
            await appDriver.updateUserRole(userId, { role: SystemUserRoles.TENANT_ADMIN }, adminToken);

            // Verify role was updated by fetching from Firestore
            const userData = await appDriver.getUserFirestore(userId, adminToken);
            expect(userData.role).toBe(SystemUserRoles.TENANT_ADMIN);
        });

        it('should successfully remove user role by setting to null', async () => {
            // Create a user via API
            const registration = new UserRegistrationBuilder()
                .withEmail('user3@test.com')
                .build();
            const registered = await appDriver.registerUser(registration);
            const userId = registered.user.uid;

            // First promote to admin
            await appDriver.updateUserRole(userId, { role: SystemUserRoles.SYSTEM_ADMIN }, adminToken);

            // Then remove role (set to null, defaults to system_user)
            await appDriver.updateUserRole(userId, { role: null }, adminToken);

            // Verify role is now system_user by fetching from Firestore
            const userData = await appDriver.getUserFirestore(userId, adminToken);
            expect(userData.role).toBe(SystemUserRoles.SYSTEM_USER);
        });

        it('should reject invalid role value', async () => {
            // Create a user via API
            const registration = new UserRegistrationBuilder().build();
            const registered = await appDriver.registerUser(registration);
            const userId = registered.user.uid;

            // Try to set invalid role
            try {
                await appDriver.updateUserRole(userId, { role: 'invalid_role' as any }, adminToken);
                expect.fail('Expected updateUserRole to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).code).toBe('INVALID_ROLE');
                expect((error as ApiError).statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
            }
        });

        it('should reject request with invalid UID', async () => {
            // Try to update role with empty UID
            await expect(
                appDriver.updateUserRole(toUserId(''), { role: SystemUserRoles.SYSTEM_ADMIN }, adminToken),
            )
                .rejects
                .toThrow('Invalid user ID');
        });

        it('should reject request with extra fields', async () => {
            // Create a user via API
            const registration = new UserRegistrationBuilder().build();
            const registered = await appDriver.registerUser(registration);
            const userId = registered.user.uid;

            // Try to update with extra fields
            await expect(
                appDriver.updateUserRole(userId, { role: SystemUserRoles.SYSTEM_ADMIN, email: 'new@test.com' } as any, adminToken),
            )
                .rejects
                .toThrow('Only "role" field is allowed');
        });

        it('should prevent user from changing their own role', async () => {
            // Create a user and promote to admin
            const registration = new UserRegistrationBuilder()
                .withEmail('user1@test.com')
                .build();
            const registered = await appDriver.registerUser(registration);
            const userId = registered.user.uid;
            const userToken = registered.user.uid;

            await appDriver.promoteUserToAdmin(userId);

            // Try to change own role using own token
            try {
                await appDriver.updateUserRole(userId, { role: SystemUserRoles.TENANT_ADMIN }, userToken);
                expect.fail('Expected updateUserRole to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).code).toBe('CANNOT_CHANGE_OWN_ROLE');
                expect((error as ApiError).statusCode).toBe(HTTP_STATUS.CONFLICT);
            }
        });

        it('should return 404 for non-existent user', async () => {
            const nonExistentUserId = toUserId('nonexistent');

            try {
                await appDriver.updateUserRole(nonExistentUserId, { role: SystemUserRoles.SYSTEM_ADMIN }, adminToken);
                expect.fail('Expected updateUserRole to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).statusCode).toBe(HTTP_STATUS.NOT_FOUND);
                expect((error as ApiError).code).toBe('USER_NOT_FOUND');
            }
        });

        it('should validate that UID is a non-empty string', async () => {
            // Test with whitespace-only UID
            await expect(
                appDriver.updateUserRole(toUserId('   '), { role: SystemUserRoles.SYSTEM_ADMIN }, adminToken),
            )
                .rejects
                .toThrow('Invalid user ID');
        });
    });
});
