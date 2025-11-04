import { PasswordChangeRequestBuilder, RegisteredUserBuilder, SplitifydFirestoreTestDatabase, UserUpdateBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { UserHandlers } from '../../../user/UserHandlers';
import { initializeI18n } from '../../../utils/i18n';
import { AppDriver } from '../AppDriver';
import { StubAuthService } from '../mocks/StubAuthService';

describe('UserHandlers - Unit Tests', () => {
    let appDriver: AppDriver;

    beforeEach(async () => {
        await initializeI18n();
        appDriver = new AppDriver();
    });

    describe('updateUserProfile', () => {
        it('should update display name successfully', async () => {
            const userId = 'test-user-123';

            const { uid, emailVerified, photoURL, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Original Name')
                .withPreferredLanguage('en')
                .build();

            appDriver.seedUser(userId, firestoreUser);

            const updateRequest = new UserUpdateBuilder()
                .withDisplayName('New Name')
                .build();

            const result = await appDriver.updateUserProfile(updateRequest, userId);

            expect(result).toMatchObject({
                displayName: 'New Name',
            });
        });

        it('should update preferredLanguage successfully', async () => {
            const userId = 'test-user-123';

            const { uid, emailVerified, photoURL, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Test User')
                .withPreferredLanguage('en')
                .build();

            appDriver.seedUser(userId, firestoreUser);

            const updateRequest = new UserUpdateBuilder()
                .withPreferredLanguage('en')
                .build();

            await appDriver.updateUserProfile(updateRequest, userId);
        });

        it('should update multiple fields at once', async () => {
            const userId = 'test-user-123';

            const { uid, emailVerified, photoURL, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Original Name')
                .withPreferredLanguage('en')
                .build();

            appDriver.seedUser(userId, firestoreUser);

            const updateRequest = new UserUpdateBuilder()
                .withDisplayName('New Name')
                .withPreferredLanguage('en')
                .build();

            const result = await appDriver.updateUserProfile(updateRequest, userId);

            expect(result).toMatchObject({
                displayName: 'New Name',
            });
        });

        it('should reject update with no fields provided', async () => {
            const userId = 'test-user-123';
            const updateRequest = {};

            await expect(appDriver.updateUserProfile(updateRequest, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
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
                    code: 'INVALID_INPUT',
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
                    code: 'INVALID_INPUT',
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
                    code: 'INVALID_INPUT',
                }),
            );
        });
    });

    describe('changePassword', () => {
        it('should change password successfully with valid current password', async () => {
            const userId = 'test-user-123';

            const { uid, emailVerified, photoURL, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Test User')
                .build();

            appDriver.seedUser(userId, firestoreUser);

            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('NewValidPass456!')
                .build();

            const result = await appDriver.changePassword(passwordRequest, userId);

            expect(result).toMatchObject({
                message: 'Password changed successfully',
            });
        });

        it('should allow lowercase-only passwords when they meet the length requirement', async () => {
            const userId = 'test-user-123';
            const { uid, emailVerified, photoURL, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Test User')
                .build();

            appDriver.seedUser(userId, firestoreUser);

            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('lowercaseonlypass')
                .build();

            await expect(appDriver.changePassword(passwordRequest, userId)).resolves.toMatchObject({
                message: 'Password changed successfully',
            });
        });

        it('should allow passwords without numbers or special characters when long enough', async () => {
            const userId = 'test-user-123';
            const { uid, emailVerified, photoURL, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Test User')
                .build();

            appDriver.seedUser(userId, firestoreUser);

            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('OnlyLettersHere')
                .build();

            await expect(appDriver.changePassword(passwordRequest, userId)).resolves.toMatchObject({
                message: 'Password changed successfully',
            });
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
                    code: 'INVALID_INPUT',
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
                    code: 'INVALID_INPUT',
                }),
            );
        });
    });

    describe('Static Factory Method', () => {
        it('should create UserHandlers instance with UserService', () => {
            const db = new SplitifydFirestoreTestDatabase();
            const authService = new StubAuthService();
            const componentBuilder = new ComponentBuilder(authService, db);
            const handlers = new UserHandlers(componentBuilder.buildUserService());
            expect(handlers).toBeInstanceOf(UserHandlers);
            expect(handlers.updateUserProfile).toBeDefined();
            expect(handlers.changePassword).toBeDefined();
        });
    });
});
