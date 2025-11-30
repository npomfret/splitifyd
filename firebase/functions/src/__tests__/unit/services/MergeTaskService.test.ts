import { StubCloudTasksClient, Timestamp } from '@billsplit-wl/firebase-simulator';
import { StubFirestoreDatabase } from '@billsplit-wl/firebase-simulator';
import { SystemUserRoles, toUserId } from '@billsplit-wl/shared';
import { StubStorage } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { FirestoreCollections } from '../../../constants';
import { ErrorCode } from '../../../errors/ErrorCode';
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
            await expect(mergeTaskService.executeMerge(jobId)).rejects.toMatchObject({
                code: ErrorCode.INVALID_REQUEST,
            });
        });

        it('should throw error if job does not exist', async () => {
            // Act & Assert: Should throw error for missing job
            await expect(mergeTaskService.executeMerge('non-existent-job')).rejects.toThrow();
        });

        it('should migrate all data from secondary to primary user', async () => {
            // Arrange: Create users and test data
            const primaryUserId = toUserId('primary-user');
            const secondaryUserId = toUserId('secondary-user');
            const jobId = 'test-job-456';

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

            // Create test data owned by secondary user
            db.seed(`groups/group-1`, {
                id: 'group-1',
                ownerId: secondaryUserId,
                name: 'Test Group',
                createdAt: Timestamp.now(),
            });

            db.seed(`group-memberships/membership-1`, {
                id: 'membership-1',
                userId: secondaryUserId,
                groupId: 'group-1',
                createdAt: Timestamp.now(),
            });

            db.seed(`expenses/expense-1`, {
                id: 'expense-1',
                paidBy: secondaryUserId,
                participants: [secondaryUserId, primaryUserId],
                amount: '100',
                createdAt: Timestamp.now(),
            });

            db.seed(`settlements/settlement-1`, {
                id: 'settlement-1',
                payerId: secondaryUserId,
                payeeId: primaryUserId,
                amount: '50',
                createdAt: Timestamp.now(),
            });

            db.seed(`comments/comment-1`, {
                id: 'comment-1',
                authorId: secondaryUserId,
                text: 'Test comment',
                createdAt: Timestamp.now(),
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

            // Verify group ownership migrated
            const groupDoc = await db.collection(FirestoreCollections.GROUPS).doc('group-1').get();
            expect(groupDoc.data()?.ownerId).toBe(primaryUserId);

            // Verify membership migrated
            const membershipDoc = await db.collection(FirestoreCollections.GROUP_MEMBERSHIPS).doc('membership-1').get();
            expect(membershipDoc.data()?.userId).toBe(primaryUserId);

            // Verify expense payer migrated
            const expenseDoc = await db.collection(FirestoreCollections.EXPENSES).doc('expense-1').get();
            expect(expenseDoc.data()?.paidBy).toBe(primaryUserId);
            expect(expenseDoc.data()?.participants).toContain(primaryUserId);

            // Verify settlement payer migrated
            const settlementDoc = await db.collection(FirestoreCollections.SETTLEMENTS).doc('settlement-1').get();
            expect(settlementDoc.data()?.payerId).toBe(primaryUserId);

            // Verify comment author migrated
            const commentDoc = await db.collection(FirestoreCollections.COMMENTS).doc('comment-1').get();
            expect(commentDoc.data()?.authorId).toBe(primaryUserId);

            // Verify secondary user marked as merged
            const secondaryUserDoc = await db.collection(FirestoreCollections.USERS).doc(secondaryUserId).get();
            expect(secondaryUserDoc.data()?.mergedInto).toBe(primaryUserId);
            expect(secondaryUserDoc.data()?.disabled).toBe(true);
            expect(secondaryUserDoc.data()?.mergedAt).toBeDefined();
        });
    });
});
