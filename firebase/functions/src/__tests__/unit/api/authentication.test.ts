import { calculateEqualSplits, toAmount, USD } from '@billsplit-wl/shared';
import type { UserId } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

/**
 * Tests for authentication edge cases that verify the middleware correctly
 * handles missing or invalid authentication scenarios.
 *
 * Note: These tests use the AppDriver which runs middleware before handlers,
 * allowing us to test the full auth flow.
 */
describe('authentication edge cases', () => {
    let appDriver: AppDriver;
    let user1: UserId;

    beforeEach(async () => {
        appDriver = new AppDriver();
        const { users } = await appDriver.createTestUsers({ count: 1 });
        [user1] = users;
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('unauthenticated requests', () => {
        it('should reject group creation without authentication', async () => {
            // Use an empty string as userId to simulate unauthenticated request
            // The middleware checks if req.user exists
            await expect(
                appDriver.createGroup(new CreateGroupRequestBuilder().build(), '' as UserId),
            ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
        });

        it('should reject group listing without authentication', async () => {
            await expect(
                appDriver.listGroups({}, '' as UserId),
            ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
        });

        it('should reject expense creation without authentication', async () => {
            // First create a group with a valid user
            const group = await appDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                user1,
            );

            // Then try to create expense without auth
            await expect(
                appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withAmount(100, USD)
                        .withPaidBy(user1)
                        .withParticipants([user1])
                        .withSplitType('equal')
                        .withSplits(calculateEqualSplits(toAmount(100), USD, [user1]))
                        .build(),
                    '' as UserId,
                ),
            ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
        });

        it('should reject activity feed access without authentication', async () => {
            await expect(
                appDriver.getActivityFeed({}, '' as UserId),
            ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
        });

        it('should reject user profile access without authentication', async () => {
            await expect(
                appDriver.getUserProfile('' as UserId),
            ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
        });
    });

    // Note: "deleted user" scenarios are not testable at the unit test level because
    // the test middleware doesn't verify tokens against the auth service - it just checks
    // if req.user exists. This is intentional for the test harness to simplify testing.
    // Deleted user scenarios are better tested at the integration test level where real
    // Firebase Auth is used.

    describe('admin endpoint protection', () => {
        it('should reject admin operations from non-admin users', async () => {
            // Regular user trying to access admin endpoints
            await expect(
                appDriver.listAllTenants(user1),
            ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject user role updates from non-admin users', async () => {
            await expect(
                appDriver.updateUserRole(user1, { role: 'system_admin' }, user1),
            ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });
    });

    describe('tenant admin endpoint protection', () => {
        it('should reject tenant admin operations from system users', async () => {
            // Regular system user trying to access tenant admin endpoints
            await expect(
                appDriver.getTenantSettings(user1),
            ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });
    });
});
