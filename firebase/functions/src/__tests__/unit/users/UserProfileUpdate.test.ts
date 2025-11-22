// Integration tests for user profile update functionality
import { toEmail, toPassword, toUserId } from '@billsplit-wl/shared';
import { UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('User Profile Update - Integration Tests', () => {
    let appDriver: AppDriver;
    let userId: string;

    beforeEach(async () => {
        appDriver = new AppDriver();

        // Register user via API instead of seeding
        const user = await appDriver.registerUser(
            new UserRegistrationBuilder()
                .withEmail('user@test.local')
                .withDisplayName('Original Name')
                .withPassword('ValidPass123!')
                .build()
        );
        userId = user.user.uid;
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('PUT /api/user/profile', () => {
        test('updates the display name', async () => {
            const newDisplayName = `Updated Name ${Date.now()}`;

            const updatedProfile = await appDriver.updateUserProfile({ displayName: newDisplayName }, userId);

            expect(updatedProfile.displayName).toBe(newDisplayName);
            expect(updatedProfile.email).toBe('user@test.local');
            expect(typeof updatedProfile.emailVerified).toBe('boolean');
        });

        test('rejects empty display name', async () => {
            await expect(appDriver.updateUserProfile({ displayName: '' }, userId)).rejects.toThrow();
        });

        test('rejects overly long display name', async () => {
            const longName = 'a'.repeat(101);
            await expect(appDriver.updateUserProfile({ displayName: longName }, userId)).rejects.toThrow();
        });

        test('requires authenticated user', async () => {
            await expect(appDriver.updateUserProfile({ displayName: 'New Name' }, 'non-existent-user')).rejects.toThrow(/not.*found|user.*not.*exist/i);
        });
    });

    describe('POST /api/user/change-email', () => {
        test('updates email when password is valid', async () => {
            const newEmail = toEmail(`updated-${Date.now()}@test.local`);

            const updatedProfile = await appDriver.changeEmail({
                currentPassword: toPassword('ValidPass123!'),
                newEmail,
            }, userId);

            expect(updatedProfile.email).toBe(newEmail.toLowerCase());
            expect(updatedProfile.emailVerified).toBe(false);
        });

        test('rejects invalid password', async () => {
            await expect(
                appDriver.changeEmail({
                    currentPassword: toPassword('WrongPassword123!'),
                    newEmail: toEmail(`another-${Date.now()}@test.local`),
                }, userId),
            )
                .rejects
                .toThrow(/password/i);
        });

        test('rejects unchanged email', async () => {
            await expect(
                appDriver.changeEmail({
                    currentPassword: toPassword('ValidPass123!'),
                    newEmail: toEmail('user@test.local'),
                }, userId),
            )
                .rejects
                .toThrow(/different/i);
        });

        test('rejects duplicate email', async () => {
            const takenEmail = toEmail('taken@test.local');
            // Register another user to make the email taken
            await appDriver.registerUser(
                new UserRegistrationBuilder()
                    .withEmail(takenEmail)
                    .withDisplayName('Other User')
                    .build()
            );

            await expect(
                appDriver.changeEmail({
                    currentPassword: toPassword('ValidPass123!'),
                    newEmail: takenEmail,
                }, userId),
            )
                .rejects
                .toThrow(/already exists/i);
        });
    });
});
