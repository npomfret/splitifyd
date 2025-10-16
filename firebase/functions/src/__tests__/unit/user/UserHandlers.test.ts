import { PasswordChangeRequestBuilder, RegisteredUserBuilder, UserUpdateBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { UserHandlers } from '../../../user/UserHandlers';
import { initializeI18n } from '../../../utils/i18n';
import { AppDriver } from '../AppDriver';

describe('UserHandlers - Unit Tests', () => {
    let appDriver: AppDriver;

    beforeEach(async () => {
        await initializeI18n();
        appDriver = new AppDriver();
    });

    describe('updateUserProfile', () => {
        it('should update display name successfully', async () => {
            const userId = 'test-user-123';

            const { uid, emailVerified, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Original Name')
                .withPhotoURL('https://example.com/photo.jpg')
                .withPreferredLanguage('en')
                .build();

            appDriver.seedUser(userId, firestoreUser);

            const updateRequest = new UserUpdateBuilder().withDisplayName('New Name').build();

            const result = await appDriver.updateUserProfile(userId, updateRequest);

            expect(result).toMatchObject({
                displayName: 'New Name',
            });
        });

        it('should update photoURL successfully', async () => {
            const userId = 'test-user-123';

            const { uid, emailVerified, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Test User')
                .withPhotoURL('https://example.com/old-photo.jpg')
                .build();

            appDriver.seedUser(userId, firestoreUser);

            const updateRequest = new UserUpdateBuilder().withPhotoURL('https://example.com/new-photo.jpg').build();

            const result = await appDriver.updateUserProfile(userId, updateRequest);

            expect(result.displayName).toBe('Test User');
        });

        it('should update preferredLanguage successfully', async () => {
            const userId = 'test-user-123';

            const { uid, emailVerified, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Test User')
                .withPreferredLanguage('en')
                .build();

            appDriver.seedUser(userId, firestoreUser);

            const updateRequest = new UserUpdateBuilder().withPreferredLanguage('en').build();

            await appDriver.updateUserProfile(userId, updateRequest);
        });

        it('should update multiple fields at once', async () => {
            const userId = 'test-user-123';

            const { uid, emailVerified, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Original Name')
                .withPhotoURL('https://example.com/old-photo.jpg')
                .withPreferredLanguage('en')
                .build();

            appDriver.seedUser(userId, firestoreUser);

            const updateRequest = new UserUpdateBuilder()
                .withDisplayName('New Name')
                .withPhotoURL('https://example.com/new-photo.jpg')
                .withPreferredLanguage('en')
                .build();

            const result = await appDriver.updateUserProfile(userId, updateRequest);

            expect(result).toMatchObject({
                displayName: 'New Name',
            });
        });

        it('should set photoURL to null (clear photo)', async () => {
            const userId = 'test-user-123';

            const { uid, emailVerified, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Test User')
                .withPhotoURL('https://example.com/photo.jpg')
                .build();

            appDriver.seedUser(userId, firestoreUser);

            const updateRequest = new UserUpdateBuilder().withPhotoURL(null).build();

            await appDriver.updateUserProfile(userId, updateRequest);
        });

        it('should reject update with no fields provided', async () => {
            const userId = 'test-user-123';
            const updateRequest = {};

            await expect(appDriver.updateUserProfile(userId, updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with invalid photoURL format', async () => {
            const userId = 'test-user-123';
            const updateRequest = new UserUpdateBuilder().withPhotoURL('not-a-valid-url').build();

            await expect(appDriver.updateUserProfile(userId, updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with displayName exceeding 100 characters', async () => {
            const userId = 'test-user-123';
            const longName = 'a'.repeat(101);
            const updateRequest = new UserUpdateBuilder().withDisplayName(longName).build();

            await expect(appDriver.updateUserProfile(userId, updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with empty display name', async () => {
            const userId = 'test-user-123';
            const updateRequest = new UserUpdateBuilder().withDisplayName('').build();

            await expect(appDriver.updateUserProfile(userId, updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with invalid language code', async () => {
            const userId = 'test-user-123';
            const updateRequest = new UserUpdateBuilder().withPreferredLanguage('invalid-lang').build();

            await expect(appDriver.updateUserProfile(userId, updateRequest)).rejects.toThrow(
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

            const { uid, emailVerified, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Test User')
                .build();

            appDriver.seedUser(userId, firestoreUser);

            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('NewValidPass456!')
                .build();

            const result = await appDriver.changePassword(userId, passwordRequest);

            expect(result).toMatchObject({
                message: 'Password changed successfully',
            });
        });

        it('should reject password change with weak new password (missing uppercase)', async () => {
            const userId = 'test-user-123';
            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('validpass123!')
                .build();

            await expect(appDriver.changePassword(userId, passwordRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject password change with weak new password (missing lowercase)', async () => {
            const userId = 'test-user-123';
            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('VALIDPASS123!')
                .build();

            await expect(appDriver.changePassword(userId, passwordRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject password change with weak new password (missing number)', async () => {
            const userId = 'test-user-123';
            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('ValidPassword!')
                .build();

            await expect(appDriver.changePassword(userId, passwordRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject password change with weak new password (missing special char)', async () => {
            const userId = 'test-user-123';
            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('ValidPass123')
                .build();

            await expect(appDriver.changePassword(userId, passwordRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject password change with weak new password (too short)', async () => {
            const userId = 'test-user-123';
            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('Pass1!')
                .build();

            await expect(appDriver.changePassword(userId, passwordRequest)).rejects.toThrow(
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

            await expect(appDriver.changePassword(userId, passwordRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });
    });

    describe('Static Factory Method', () => {
        it('should create UserHandlers instance with default ApplicationBuilder', () => {
            const handlers = UserHandlers.createUserHandlers();
            expect(handlers).toBeInstanceOf(UserHandlers);
            expect(handlers.updateUserProfile).toBeDefined();
            expect(handlers.changePassword).toBeDefined();
        });
    });
});
