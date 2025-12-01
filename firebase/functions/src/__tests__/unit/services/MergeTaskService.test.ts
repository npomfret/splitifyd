import { StubCloudTasksClient } from '@billsplit-wl/firebase-simulator';
import { StubFirestoreDatabase } from '@billsplit-wl/firebase-simulator';
import { toUserId } from '@billsplit-wl/shared';
import {
    AccountMergeJobDocumentBuilder,
    CommentDocumentBuilder,
    ExpenseDocumentBuilder,
    GroupDocumentBuilder,
    GroupMembershipDocumentBuilder,
    SettlementSeedDocumentBuilder,
    StubStorage,
    UserDocumentBuilder,
} from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { FirestoreCollections } from '../../../constants';
import { ErrorCode } from '../../../errors';
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

            db.seed(
                `users/${primaryUserId}`,
                new UserDocumentBuilder().withId(primaryUserId).withEmail('primary@example.com').build(),
            );

            db.seed(
                `users/${secondaryUserId}`,
                new UserDocumentBuilder().withId(secondaryUserId).withEmail('secondary@example.com').build(),
            );

            // Create pending merge job
            db.seed(
                `account-merges/${jobId}`,
                new AccountMergeJobDocumentBuilder()
                    .withId(jobId)
                    .withPrimaryUserId(primaryUserId)
                    .withSecondaryUserId(secondaryUserId)
                    .asPending()
                    .build(),
            );

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

            db.seed(
                `account-merges/${jobId}`,
                new AccountMergeJobDocumentBuilder()
                    .withId(jobId)
                    .withPrimaryUserId(primaryUserId)
                    .withSecondaryUserId(secondaryUserId)
                    .asProcessing()
                    .build(),
            );

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

            db.seed(
                `users/${primaryUserId}`,
                new UserDocumentBuilder().withId(primaryUserId).withEmail('primary@example.com').build(),
            );

            db.seed(
                `users/${secondaryUserId}`,
                new UserDocumentBuilder().withId(secondaryUserId).withEmail('secondary@example.com').build(),
            );

            // Create test data owned by secondary user
            db.seed(
                `groups/group-1`,
                new GroupDocumentBuilder().withId('group-1').withOwnerId(secondaryUserId).withName('Test Group').build(),
            );

            db.seed(
                `group-memberships/membership-1`,
                new GroupMembershipDocumentBuilder()
                    .withId('membership-1')
                    .withUserId(secondaryUserId)
                    .withGroupId('group-1')
                    .build(),
            );

            db.seed(
                `expenses/expense-1`,
                new ExpenseDocumentBuilder()
                    .withId('expense-1')
                    .withPaidBy(secondaryUserId)
                    .withParticipants([secondaryUserId, primaryUserId])
                    .withAmount('100')
                    .build(),
            );

            db.seed(
                `settlements/settlement-1`,
                new SettlementSeedDocumentBuilder()
                    .withId('settlement-1')
                    .withPayerId(secondaryUserId)
                    .withPayeeId(primaryUserId)
                    .withAmount('50')
                    .build(),
            );

            db.seed(
                `comments/comment-1`,
                new CommentDocumentBuilder().withId('comment-1').withAuthorId(secondaryUserId).withText('Test comment').build(),
            );

            // Create pending merge job
            db.seed(
                `account-merges/${jobId}`,
                new AccountMergeJobDocumentBuilder()
                    .withId(jobId)
                    .withPrimaryUserId(primaryUserId)
                    .withSecondaryUserId(secondaryUserId)
                    .asPending()
                    .build(),
            );

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
