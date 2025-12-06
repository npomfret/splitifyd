import { SystemUserRoles, toUserId } from '@billsplit-wl/shared';
import { UpdateUserRoleRequestBuilder, UpdateUserStatusRequestBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ApiError } from '../../../errors';
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
            await appDriver.updateUser(
                userId,
                UpdateUserStatusRequestBuilder.empty().asDisabled().build(),
                adminToken,
            );

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
            await appDriver.updateUser(
                userId,
                UpdateUserStatusRequestBuilder.empty().asDisabled().build(),
                adminToken,
            );

            // Then enable the user (returns 204 No Content)
            await appDriver.updateUser(
                userId,
                UpdateUserStatusRequestBuilder.empty().asEnabled().build(),
                adminToken,
            );

            // Verify user was enabled by fetching their record
            const userRecord = await appDriver.getUserAuth(userId, adminToken);
            expect(userRecord.disabled).toBe(false);
        });

        it('should reject request with invalid UID', async () => {
            // Try to update user with empty UID
            try {
                await appDriver.updateUser(
                    toUserId(''),
                    UpdateUserStatusRequestBuilder.empty().asDisabled().build(),
                    adminToken,
                );
                expect.fail('Expected updateUser to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).code).toBe('VALIDATION_ERROR');
            }
        });

        it('should reject request with non-boolean disabled field', async () => {
            // Create a user via API
            const registration = new UserRegistrationBuilder().build();
            const registered = await appDriver.registerUser(registration);
            const userId = registered.user.uid;

            // Try to update with invalid disabled value
            try {
                await appDriver.updateUser(userId, { disabled: 'true' } as any, adminToken);
                expect.fail('Expected updateUser to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).code).toBe('VALIDATION_ERROR');
            }
        });

        it('should reject request with extra fields', async () => {
            // Create a user via API
            const registration = new UserRegistrationBuilder().build();
            const registered = await appDriver.registerUser(registration);
            const userId = registered.user.uid;

            // Try to update with extra fields
            try {
                await appDriver.updateUser(userId, { disabled: true, email: 'new@test.com' } as any, adminToken);
                expect.fail('Expected updateUser to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).code).toBe('INVALID_REQUEST');
            }
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
            try {
                await appDriver.updateUser(
                    userId,
                    UpdateUserStatusRequestBuilder.empty().asDisabled().build(),
                    userToken,
                );
                expect.fail('Expected updateUser to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).code).toBe('CONFLICT');
            }
        });

        it('should return 404 for non-existent user', async () => {
            const nonExistentUserId = toUserId('nonexistent');

            try {
                await appDriver.updateUser(
                    nonExistentUserId,
                    UpdateUserStatusRequestBuilder.empty().asDisabled().build(),
                    adminToken,
                );
                expect.fail('Expected updateUser to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).statusCode).toBe(HTTP_STATUS.NOT_FOUND);
                expect((error as ApiError).code).toBe('NOT_FOUND');
            }
        });

        it('should validate that UID is a non-empty string', async () => {
            // Test with whitespace-only UID
            try {
                await appDriver.updateUser(
                    toUserId('   '),
                    UpdateUserStatusRequestBuilder.empty().asDisabled().build(),
                    adminToken,
                );
                expect.fail('Expected updateUser to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).code).toBe('VALIDATION_ERROR');
            }
        });

        it('should handle missing disabled field', async () => {
            // Create a user via API
            const registration = new UserRegistrationBuilder().build();
            const registered = await appDriver.registerUser(registration);
            const userId = registered.user.uid;

            // Try to update without disabled field
            try {
                await appDriver.updateUser(userId, {} as any, adminToken);
                expect.fail('Expected updateUser to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).code).toBe('VALIDATION_ERROR');
            }
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
            await appDriver.updateUserRole(
                userId,
                UpdateUserRoleRequestBuilder.empty().asSystemAdmin().build(),
                adminToken,
            );

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
            await appDriver.updateUserRole(
                userId,
                UpdateUserRoleRequestBuilder.empty().asTenantAdmin().build(),
                adminToken,
            );

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
            await appDriver.updateUserRole(
                userId,
                UpdateUserRoleRequestBuilder.empty().asSystemAdmin().build(),
                adminToken,
            );

            // Then remove role (set to null, defaults to system_user)
            await appDriver.updateUserRole(
                userId,
                UpdateUserRoleRequestBuilder.empty().asNoRole().build(),
                adminToken,
            );

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
                expect((error as ApiError).code).toBe('VALIDATION_ERROR');
                expect((error as ApiError).statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
            }
        });

        it('should reject request with invalid UID', async () => {
            // Try to update role with empty UID
            try {
                await appDriver.updateUserRole(
                    toUserId(''),
                    UpdateUserRoleRequestBuilder.empty().asSystemAdmin().build(),
                    adminToken,
                );
                expect.fail('Expected updateUserRole to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).code).toBe('VALIDATION_ERROR');
            }
        });

        it('should reject request with extra fields', async () => {
            // Create a user via API
            const registration = new UserRegistrationBuilder().build();
            const registered = await appDriver.registerUser(registration);
            const userId = registered.user.uid;

            // Try to update with extra fields
            try {
                await appDriver.updateUserRole(userId, { role: SystemUserRoles.SYSTEM_ADMIN, email: 'new@test.com' } as any, adminToken);
                expect.fail('Expected updateUserRole to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).code).toBe('INVALID_REQUEST');
            }
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
                await appDriver.updateUserRole(
                    userId,
                    UpdateUserRoleRequestBuilder.empty().asTenantAdmin().build(),
                    userToken,
                );
                expect.fail('Expected updateUserRole to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).code).toBe('CONFLICT');
                expect((error as ApiError).statusCode).toBe(HTTP_STATUS.CONFLICT);
            }
        });

        it('should return 404 for non-existent user', async () => {
            const nonExistentUserId = toUserId('nonexistent');

            try {
                await appDriver.updateUserRole(
                    nonExistentUserId,
                    UpdateUserRoleRequestBuilder.empty().asSystemAdmin().build(),
                    adminToken,
                );
                expect.fail('Expected updateUserRole to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).statusCode).toBe(HTTP_STATUS.NOT_FOUND);
                expect((error as ApiError).code).toBe('NOT_FOUND');
            }
        });

        it('should validate that UID is a non-empty string', async () => {
            // Test with whitespace-only UID
            try {
                await appDriver.updateUserRole(
                    toUserId('   '),
                    UpdateUserRoleRequestBuilder.empty().asSystemAdmin().build(),
                    adminToken,
                );
                expect.fail('Expected updateUserRole to throw ApiError');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).code).toBe('VALIDATION_ERROR');
            }
        });
    });
});
