import type { UserId } from '@billsplit-wl/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

/**
 * Account Merge API Tests
 *
 * Tests the account merge feature through the HTTP API layer.
 * These tests call AppDriver methods that simulate HTTP requests to merge endpoints.
 */
describe('Account Merge API', () => {
    let appDriver: AppDriver;
    let user1: UserId;
    let user2: UserId;

    beforeEach(async () => {
        appDriver = new AppDriver();

        const { users } = await appDriver.createTestUsers({ count: 2 });
        [user1, user2] = users;

        // Mark emails as verified for merge eligibility
        appDriver.markEmailVerified(user1);
        appDriver.markEmailVerified(user2);
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('POST /merge - initiate merge', () => {
        it('should initiate merge between two eligible users', async () => {
            const result = await appDriver.initiateMerge({
                secondaryUserId: user2,
            }, user1); // user1 is primary (authenticated user)

            expect(result.jobId).toBeDefined();
            expect(result.status).toBe('pending');
        });

        it('should reject merge when user tries to merge with themselves', async () => {
            await expect(
                appDriver.initiateMerge({
                    secondaryUserId: user1,
                }, user1),
            )
                .rejects
                .toMatchObject({ code: 'MERGE_NOT_ELIGIBLE' });
        });

        it('should reject merge when secondary user does not exist', async () => {
            const nonExistentUser = 'non-existent-user' as UserId;
            await expect(
                appDriver.initiateMerge({
                    secondaryUserId: nonExistentUser,
                }, user1),
            )
                .rejects
                .toMatchObject({ code: 'MERGE_NOT_ELIGIBLE' });
        });

        it('should require authentication', async () => {
            const result = await appDriver.initiateMerge({
                secondaryUserId: user2,
            }, '' as any); // no auth token

            // Auth middleware returns error response instead of throwing
            expect(result).toMatchObject({
                error: {
                    code: 'UNAUTHORIZED',
                },
            });
        });
    });

    describe('GET /merge/:jobId - get merge status', () => {
        it('should return merge job status', async () => {
            const mergeResult = await appDriver.initiateMerge({
                secondaryUserId: user2,
            }, user1);

            const status = await appDriver.getMergeStatus(mergeResult.jobId, user1);
            expect(status.id).toBe(mergeResult.jobId);
            expect(status.status).toBe('pending');
            expect(status.createdAt).toBeDefined();
        });

        it('should reject when job does not exist', async () => {
            await expect(
                appDriver.getMergeStatus('non-existent-job', user1),
            )
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });

        it('should reject when user is not authorized to view job', async () => {
            // Create a third user
            const { users } = await appDriver.createTestUsers({ count: 1 });
            const user3 = users[0];
            appDriver.markEmailVerified(user3);

            // Create merge between user1 and user2
            const mergeResult = await appDriver.initiateMerge({
                secondaryUserId: user2,
            }, user1);

            // Try to get status as a different user (user3)
            await expect(
                appDriver.getMergeStatus(mergeResult.jobId, user3),
            )
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should require authentication', async () => {
            const result = await appDriver.getMergeStatus('some-job-id', '' as any);

            // Auth middleware returns error response instead of throwing
            expect(result).toMatchObject({
                error: {
                    code: 'UNAUTHORIZED',
                },
            });
        });
    });

    // End-to-end workflow test will be added in a later phase once full migration is implemented
});
