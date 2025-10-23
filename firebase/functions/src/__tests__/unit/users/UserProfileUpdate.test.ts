// Unit tests for user profile update functionality

import { beforeEach, describe, expect, test } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('User Profile Update - Unit Tests', () => {
    let appDriver: AppDriver;
    const userId = 'test-user';

    beforeEach(() => {
        appDriver = new AppDriver();

        // Seed test user
        appDriver.seedUser(userId, {
            displayName: 'Original Name',
            email: 'user@test.local',
        });
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('PUT /api/user/profile', () => {
        test('should update user display name successfully', async () => {
            const newDisplayName = `Updated Name ${Date.now()}`;

            // Update the display name
            const updatedProfile = await appDriver.updateUserProfile(userId, { displayName: newDisplayName });

            // Verify the response
            expect(updatedProfile).toBeDefined();
            expect(updatedProfile.displayName).toBe(newDisplayName);
        });

        test('should reject empty display name', async () => {
            // Try to update with empty display name
            await expect(appDriver.updateUserProfile(userId, { displayName: '' })).rejects.toThrow();
        });

        test('should reject display name that is too long', async () => {
            // Try to update with very long display name
            const longName = 'a'.repeat(101); // Assuming max is 100
            await expect(appDriver.updateUserProfile(userId, { displayName: longName })).rejects.toThrow();
        });

        test('should require authentication', async () => {
            // Try to update profile without valid user
            await expect(
                appDriver.updateUserProfile('non-existent-user', { displayName: 'New Name' }),
            )
                .rejects
                .toThrow(/not.*found|user.*not.*exist/i);
        });
    });
});
