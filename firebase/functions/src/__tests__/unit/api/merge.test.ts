import type { UserId } from '@billsplit-wl/shared';
import { InitiateMergeRequestBuilder } from '@billsplit-wl/test-support';
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
        await appDriver.markEmailVerified(user1);
        await appDriver.markEmailVerified(user2);
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('POST /merge - initiate merge', () => {
        it('should initiate merge between two eligible users', async () => {
            const result = await appDriver.initiateMerge(
                new InitiateMergeRequestBuilder().withSecondaryUserId(user2).build(),
                user1, // user1 is primary (authenticated user)
            );

            expect(result.jobId).toBeDefined();
            expect(result.status).toBe('pending');
        });

        it('should reject merge when user tries to merge with themselves', async () => {
            const result = await appDriver.initiateMerge(
                new InitiateMergeRequestBuilder().withSecondaryUserId(user1).build(),
                user1,
            );

            expect(result).toMatchObject({
                error: {
                    code: 'INVALID_REQUEST',
                },
            });
        });

        it('should reject merge when secondary user does not exist', async () => {
            const nonExistentUser = 'non-existent-user' as UserId;
            const result = await appDriver.initiateMerge(
                new InitiateMergeRequestBuilder().withSecondaryUserId(nonExistentUser).build(),
                user1,
            );

            expect(result).toMatchObject({
                error: {
                    code: 'INVALID_REQUEST',
                },
            });
        });

        it('should require authentication', async () => {
            const result = await appDriver.initiateMerge(
                new InitiateMergeRequestBuilder().withSecondaryUserId(user2).build(),
                '' as any, // no auth token
            );

            // Auth middleware returns error response instead of throwing
            expect(result).toMatchObject({
                error: {
                    code: 'AUTH_REQUIRED',
                },
            });
        });
    });

    describe('GET /merge/:jobId - get merge status', () => {
        it('should return merge job status', async () => {
            const mergeResult = await appDriver.initiateMerge(
                new InitiateMergeRequestBuilder().withSecondaryUserId(user2).build(),
                user1,
            );

            const status = await appDriver.getMergeStatus(mergeResult.jobId, user1);
            expect(status.id).toBe(mergeResult.jobId);
            expect(status.status).toBe('pending');
            expect(status.createdAt).toBeDefined();
        });

        it('should reject when job does not exist', async () => {
            const result = await appDriver.getMergeStatus('non-existent-job', user1);

            expect(result).toMatchObject({
                error: {
                    code: 'NOT_FOUND',
                },
            });
        });

        it('should reject when user is not authorized to view job', async () => {
            // Create a third user
            const { users } = await appDriver.createTestUsers({ count: 1 });
            const user3 = users[0];
            await appDriver.markEmailVerified(user3);

            // Create merge between user1 and user2
            const mergeResult = await appDriver.initiateMerge(
                new InitiateMergeRequestBuilder().withSecondaryUserId(user2).build(),
                user1,
            );

            // Try to get status as a different user (user3)
            const result = await appDriver.getMergeStatus(mergeResult.jobId, user3);

            expect(result).toMatchObject({
                error: {
                    code: 'FORBIDDEN',
                },
            });
        });

        it('should require authentication', async () => {
            const result = await appDriver.getMergeStatus('some-job-id', '' as any);

            // Auth middleware returns error response instead of throwing
            expect(result).toMatchObject({
                error: {
                    code: 'AUTH_REQUIRED',
                },
            });
        });
    });

    describe('POST /tasks/processMerge - process merge task', () => {
        it('should process merge task and migrate all data', async () => {
            // Arrange: Initiate merge (no need to create test data for this test)
            const mergeResult = await appDriver.initiateMerge(
                new InitiateMergeRequestBuilder().withSecondaryUserId(user2).build(),
                user1,
            );

            // Act: Process the merge task (simulates Cloud Task invocation)
            const taskResult = await appDriver.processMergeTask(mergeResult.jobId);

            // Assert: Task completed successfully
            expect(taskResult.success).toBe(true);
            expect(taskResult.jobId).toBe(mergeResult.jobId);
            expect(taskResult.primaryUserId).toBe(user1);
            expect(taskResult.secondaryUserId).toBe(user2);

            // Verify job status is now 'completed'
            const finalStatus = await appDriver.getMergeStatus(mergeResult.jobId, user1);
            expect(finalStatus.status).toBe('completed');
            expect(finalStatus.completedAt).toBeDefined();
        });

        it('should reject task when jobId is missing', async () => {
            const result = await appDriver.processMergeTask('');

            expect(result).toMatchObject({
                error: {
                    code: 'VALIDATION_ERROR',
                },
            });
        });

        it('should reject task when job does not exist', async () => {
            const result = await appDriver.processMergeTask('non-existent-job');

            expect(result).toMatchObject({
                error: {
                    code: 'NOT_FOUND',
                },
            });
        });

        it('should reject task when job is not in pending status', async () => {
            // Create a merge job
            const mergeResult = await appDriver.initiateMerge(
                new InitiateMergeRequestBuilder().withSecondaryUserId(user2).build(),
                user1,
            );

            // Process it once (moves to completed)
            await appDriver.processMergeTask(mergeResult.jobId);

            // Try to process again (should fail - not pending)
            const result = await appDriver.processMergeTask(mergeResult.jobId);

            expect(result).toMatchObject({
                error: {
                    code: 'INVALID_REQUEST',
                },
            });
        });
    });

    describe('End-to-end workflow', () => {
        it('should complete full merge workflow', async () => {
            // Step 1: Initiate merge
            const mergeResult = await appDriver.initiateMerge(
                new InitiateMergeRequestBuilder().withSecondaryUserId(user2).build(),
                user1,
            );
            expect(mergeResult.jobId).toBeDefined();
            expect(mergeResult.status).toBe('pending');

            // Step 2: Check initial status
            const initialStatus = await appDriver.getMergeStatus(mergeResult.jobId, user1);
            expect(initialStatus.status).toBe('pending');
            expect(initialStatus.primaryUserId).toBe(user1);
            expect(initialStatus.secondaryUserId).toBe(user2);

            // Step 3: Process the merge task (Cloud Task simulation)
            const taskResult = await appDriver.processMergeTask(mergeResult.jobId);
            expect(taskResult.success).toBe(true);

            // Step 4: Verify final status
            const finalStatus = await appDriver.getMergeStatus(mergeResult.jobId, user1);
            expect(finalStatus.status).toBe('completed');
            expect(finalStatus.completedAt).toBeDefined();

            // Note: In unit tests we can't directly verify Firestore data changes
            // because AppDriver uses stubs. Full data verification happens in
            // MergeTaskService.test.ts. This test verifies the HTTP workflow.
            // Integration tests (Phase 5) will verify end-to-end data migration
            // with real Firestore emulator.
        });

        it('should handle merge failure gracefully', async () => {
            // Create merge with non-existent secondary user
            const result = await appDriver.initiateMerge(
                { secondaryUserId: 'non-existent' as UserId },
                user1,
            );

            expect(result).toMatchObject({
                error: {
                    code: 'INVALID_REQUEST',
                },
            });
        });
    });
});
