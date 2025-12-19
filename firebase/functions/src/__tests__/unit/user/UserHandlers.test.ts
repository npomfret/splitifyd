import { StubFirestoreDatabase, StubStorage } from '@billsplit-wl/test-support';
import { PasswordChangeRequestBuilder, UserRegistrationBuilder, UserUpdateBuilder } from '@billsplit-wl/test-support';
import { StubCloudTasksClient } from 'ts-firebase-simulator';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { FakeEmailService } from '../../../services/email';
import { UserHandlers } from '../../../user/UserHandlers';
import { createUnitTestServiceConfig, StubGroupAttachmentStorage } from '../../test-config';
import { AppDriver } from '../AppDriver';
import { StubAuthService } from '../mocks/StubAuthService';

describe('UserHandlers - Integration Tests', () => {
    let appDriver: AppDriver;

    beforeEach(async () => {
        appDriver = new AppDriver();
    });

    describe('updateUserProfile', () => {
        it('should update display name successfully', async () => {
            // Register user via API instead of seeding
            const user = await appDriver.registerUser(
                new UserRegistrationBuilder()
                    .withDisplayName('Original Name')
                    .build(),
            );
            const userId = user.user.uid;

            const updateRequest = new UserUpdateBuilder()
                .withDisplayName('New Name')
                .build();

            // Returns 204 No Content
            await appDriver.updateUserProfile(updateRequest, userId);

            // Verify the update persisted
            const profile = await appDriver.getUserProfile(userId);
            expect(profile.displayName).toBe('New Name');
        });

        it('should update preferredLanguage successfully', async () => {
            // Register user via API instead of seeding
            const user = await appDriver.registerUser(
                new UserRegistrationBuilder()
                    .withDisplayName('Test User')
                    .build(),
            );
            const userId = user.user.uid;

            const updateRequest = new UserUpdateBuilder()
                .withPreferredLanguage('en')
                .build();

            await appDriver.updateUserProfile(updateRequest, userId);
        });

        it('should update multiple fields at once', async () => {
            // Register user via API instead of seeding
            const user = await appDriver.registerUser(
                new UserRegistrationBuilder()
                    .withDisplayName('Original Name')
                    .build(),
            );
            const userId = user.user.uid;

            const updateRequest = new UserUpdateBuilder()
                .withDisplayName('New Name')
                .withPreferredLanguage('en')
                .build();

            // Returns 204 No Content
            await appDriver.updateUserProfile(updateRequest, userId);

            // Verify the update persisted
            const profile = await appDriver.getUserProfile(userId);
            expect(profile.displayName).toBe('New Name');
        });

        it('should reject update with no fields provided', async () => {
            const userId = 'test-user-123';
            const updateRequest = {};

            await expect(appDriver.updateUserProfile(updateRequest, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject update with displayName exceeding 100 characters', async () => {
            const userId = 'test-user-123';
            const longName = 'a'.repeat(101);
            const updateRequest = new UserUpdateBuilder()
                .withDisplayName(longName)
                .build();

            await expect(appDriver.updateUserProfile(updateRequest, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject update with empty display name', async () => {
            const userId = 'test-user-123';
            const updateRequest = new UserUpdateBuilder()
                .withDisplayName('')
                .build();

            await expect(appDriver.updateUserProfile(updateRequest, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject update with invalid language code', async () => {
            const userId = 'test-user-123';
            const updateRequest = new UserUpdateBuilder()
                .withPreferredLanguage('invalid-lang')
                .build();

            await expect(appDriver.updateUserProfile(updateRequest, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });
    });

    describe('changePassword', () => {
        it('should change password successfully with valid current password', async () => {
            // Register user via API instead of seeding
            const user = await appDriver.registerUser(
                new UserRegistrationBuilder()
                    .withDisplayName('Test User')
                    .withPassword('ValidPass123!')
                    .build(),
            );
            const userId = user.user.uid;

            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('NewValidPass456!')
                .build();

            // Returns 204 No Content
            await appDriver.changePassword(passwordRequest, userId);
            // Password changed successfully (no response body to verify)
        });

        it('should allow lowercase-only passwords when they meet the length requirement', async () => {
            // Register user via API instead of seeding
            const user = await appDriver.registerUser(
                new UserRegistrationBuilder()
                    .withDisplayName('Test User')
                    .withPassword('ValidPass123!')
                    .build(),
            );
            const userId = user.user.uid;

            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('lowercaseonlypass')
                .build();

            // Returns 204 No Content
            await appDriver.changePassword(passwordRequest, userId);
        });

        it('should allow passwords without numbers or special characters when long enough', async () => {
            // Register user via API instead of seeding
            const user = await appDriver.registerUser(
                new UserRegistrationBuilder()
                    .withDisplayName('Test User')
                    .withPassword('ValidPass123!')
                    .build(),
            );
            const userId = user.user.uid;

            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('OnlyLettersHere')
                .build();

            // Returns 204 No Content
            await appDriver.changePassword(passwordRequest, userId);
        });

        it('should reject password change with new password shorter than 12 characters', async () => {
            const userId = 'test-user-123';
            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('Pass1!')
                .build();

            await expect(appDriver.changePassword(passwordRequest, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject password change when new password equals current password', async () => {
            const userId = 'test-user-123';
            const samePassword = 'ValidPass123!';
            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword(samePassword)
                .withNewPassword(samePassword)
                .build();

            await expect(appDriver.changePassword(passwordRequest, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });
    });

    describe('Static Factory Method', () => {
        it('should create UserHandlers instance with UserService', () => {
            const db = new StubFirestoreDatabase();
            const authService = new StubAuthService();
            const storage = new StubStorage({ defaultBucketName: 'test-bucket' });
            const componentBuilder = new ComponentBuilder(
                authService,
                new FakeEmailService(),
                db,
                storage,
                new StubCloudTasksClient(),
                createUnitTestServiceConfig(),
                new StubGroupAttachmentStorage(storage),
            );
            const handlers = new UserHandlers(
                componentBuilder.buildUserService(),
                authService,
                componentBuilder.buildTenantRegistryService(),
            );
            expect(handlers).toBeInstanceOf(UserHandlers);
            expect(handlers.updateUserProfile).toBeDefined();
            expect(handlers.changePassword).toBeDefined();
            expect(handlers.changeEmail).toBeDefined();
        });
    });
});
