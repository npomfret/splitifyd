import { StubCloudTasksClient, Timestamp } from '@billsplit-wl/firebase-simulator';
import { StubFirestoreDatabase } from '@billsplit-wl/firebase-simulator';
import { SystemUserRoles, toUserId } from '@billsplit-wl/shared';
import { StubStorage } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { FirestoreCollections } from '../../../constants';
import type { MergeTaskService } from '../../../merge/MergeTaskService';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { StubAuthService } from '../mocks/StubAuthService';

import { createUnitTestServiceConfig } from '../../test-config';

/**
 * MergeTaskService Unit Tests - Phase 3 Minimal Implementation
 *
 * Tests the core job lifecycle management:
 * - Fetching job documents
 * - Validating job status
 * - Updating job status through lifecycle (pending -> processing -> completed)
 *
 * NOTE: Full migration logic will be tested once implemented in future phases
 */
describe('MergeTaskService', () => {
    let mergeTaskService: MergeTaskService;
    let db: StubFirestoreDatabase;
    let stubAuth: StubAuthService;

    beforeEach(() => {
        // Create test infrastructure using Firebase Simulator
        db = new StubFirestoreDatabase();
        stubAuth = new StubAuthService();

        // Create ComponentBuilder with test dependencies
        const componentBuilder = new ComponentBuilder(
            stubAuth,
            db,
            new StubStorage({ defaultBucketName: 'test-bucket' }),
            new StubCloudTasksClient(), // Provide stub CloudTasks client
            createUnitTestServiceConfig(),
        );

        // Get MergeTaskService from builder (properly wired with dependencies)
        mergeTaskService = componentBuilder.buildMergeTaskService();
    });

    describe('executeMerge', () => {
        it('should execute merge job lifecycle (pending -> processing -> completed)', async () => {
            // Arrange: Create users in Firestore
            const primaryUserId = toUserId('primary-user');
            const secondaryUserId = toUserId('secondary-user');
            const jobId = 'test-job-123';

            db.seed(`users/${primaryUserId}`, {
                id: primaryUserId,
                email: 'primary@example.com',
                role: SystemUserRoles.SYSTEM_USER,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });

            db.seed(`users/${secondaryUserId}`, {
                id: secondaryUserId,
                email: 'secondary@example.com',
                role: SystemUserRoles.SYSTEM_USER,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });

            // Create pending merge job
            db.seed(`account-merges/${jobId}`, {
                id: jobId,
                primaryUserId,
                secondaryUserId,
                status: 'pending',
                createdAt: new Date().toISOString(),
            });

            // Act: Execute the merge
            const result = await mergeTaskService.executeMerge(jobId);

            // Assert: Job completed successfully
            expect(result.success).toBe(true);
            expect(result.jobId).toBe(jobId);
            expect(result.primaryUserId).toBe(primaryUserId);
            expect(result.secondaryUserId).toBe(secondaryUserId);

            // Verify job document was updated to completed
            const jobDoc = await db.collection(FirestoreCollections.ACCOUNT_MERGES).doc(jobId).get();
            expect(jobDoc.exists).toBe(true);
            const jobData = jobDoc.data();
            expect(jobData?.status).toBe('completed');
            expect(jobData?.completedAt).toBeDefined();
        });

        it('should reject merge if job is not in pending status', async () => {
            // Arrange: Create job that's already processing
            const jobId = 'test-job-123';
            const primaryUserId = toUserId('primary-user');
            const secondaryUserId = toUserId('secondary-user');

            db.seed(`account-merges/${jobId}`, {
                id: jobId,
                primaryUserId,
                secondaryUserId,
                status: 'processing',
                createdAt: new Date().toISOString(),
                startedAt: new Date().toISOString(),
            });

            // Act & Assert: Should throw error for non-pending job
            await expect(mergeTaskService.executeMerge(jobId)).rejects.toThrow('not in pending status');
        });

        it('should throw error if job does not exist', async () => {
            // Act & Assert: Should throw error for missing job
            await expect(mergeTaskService.executeMerge('non-existent-job')).rejects.toThrow();
        });
    });
});
