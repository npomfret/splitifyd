// Unit tests for user profile update functionality
import { beforeEach, describe, expect, test } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('User Profile Update - Unit Tests', () => {
    let appDriver: AppDriver;
    const userId = 'test-user';

    beforeEach(() => {
        appDriver = new AppDriver();

        appDriver.seedUser(userId, {
            displayName: 'Original Name',
            email: 'user@test.local',
        });
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('PUT /api/user/profile', () => {
        test('updates the display name', async () => {
            const newDisplayName = `Updated Name ${Date.now()}`;

            const updatedProfile = await appDriver.updateUserProfile(userId, { displayName: newDisplayName });

            expect(updatedProfile.displayName).toBe(newDisplayName);
            expect(updatedProfile.email).toBe('user@test.local');
            expect(typeof updatedProfile.emailVerified).toBe('boolean');
        });

        test('rejects empty display name', async () => {
            await expect(appDriver.updateUserProfile(userId, { displayName: '' })).rejects.toThrow();
        });

        test('rejects overly long display name', async () => {
            const longName = 'a'.repeat(101);
            await expect(appDriver.updateUserProfile(userId, { displayName: longName })).rejects.toThrow();
        });

        test('requires authenticated user', async () => {
            await expect(appDriver.updateUserProfile('non-existent-user', { displayName: 'New Name' })).rejects.toThrow(/not.*found|user.*not.*exist/i);
        });
    });

    describe('POST /api/user/change-email', () => {
        test('updates email when password is valid', async () => {
            const newEmail = `updated-${Date.now()}@test.local`;

            const updatedProfile = await appDriver.changeEmail(userId, {
                currentPassword: 'ValidPass123!',
                newEmail,
            });

            expect(updatedProfile.email).toBe(newEmail.toLowerCase());
            expect(updatedProfile.emailVerified).toBe(false);
        });

        test('rejects invalid password', async () => {
            await expect(
                appDriver.changeEmail(userId, {
                    currentPassword: 'WrongPassword123!',
                    newEmail: `another-${Date.now()}@test.local`,
                }),
            )
                .rejects
                .toThrow(/password/i);
        });

        test('rejects unchanged email', async () => {
            await expect(
                appDriver.changeEmail(userId, {
                    currentPassword: 'ValidPass123!',
                    newEmail: 'user@test.local',
                }),
            )
                .rejects
                .toThrow(/different/i);
        });

        test('rejects duplicate email', async () => {
            const takenEmail = 'taken@test.local';
            appDriver.seedUser('other-user', { email: takenEmail, displayName: 'Other User' });

            await expect(
                appDriver.changeEmail(userId, {
                    currentPassword: 'ValidPass123!',
                    newEmail: takenEmail,
                }),
            )
                .rejects
                .toThrow(/already exists/i);
        });
    });
});
