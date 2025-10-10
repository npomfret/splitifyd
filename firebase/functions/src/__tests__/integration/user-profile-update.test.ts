import { beforeEach, describe, expect, test } from 'vitest';
import { ApiDriver, borrowTestUsers } from '@splitifyd/test-support';
import type { PooledTestUser } from '@splitifyd/shared';

describe('User Profile Update - Integration Tests', () => {
    let apiDriver: ApiDriver;
    let user: PooledTestUser;

    beforeEach(async () => {
        apiDriver = new ApiDriver();
        const users = await borrowTestUsers(1);
        user = users[0];
    });

    describe('PUT /api/user/profile', () => {
        test('should update user display name successfully', async () => {
            const newDisplayName = `Updated Name ${Date.now()}`;

            // Update the display name
            const updatedProfile = await apiDriver.updateUserProfile(
                { displayName: newDisplayName },
                user.token,
            );

            // Verify the response
            expect(updatedProfile).toBeDefined();
            expect(updatedProfile.displayName).toBe(newDisplayName);
            expect(updatedProfile.uid).toBe(user.uid);
        });

        test('should reject empty display name', async () => {
            // Try to update with empty display name
            await expect(
                apiDriver.updateUserProfile({ displayName: '' }, user.token),
            ).rejects.toThrow(/required|INVALID_INPUT/i);
        });

        test('should reject display name that is too long', async () => {
            // Try to update with very long display name
            const longName = 'a'.repeat(101); // Assuming max is 100
            await expect(
                apiDriver.updateUserProfile({ displayName: longName }, user.token),
            ).rejects.toThrow(/exceed.*100|INVALID_INPUT/i);
        });

        test('should require authentication', async () => {
            // Try to update profile without authentication
            await expect(
                apiDriver.updateUserProfile({ displayName: 'New Name' }, 'invalid-token'),
            ).rejects.toThrow(/auth|unauthorized|token/i);
        });
    });
});
