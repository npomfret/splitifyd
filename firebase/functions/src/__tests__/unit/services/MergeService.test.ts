import { toUserId } from '@billsplit-wl/shared';
import { AuthUserRecordBuilder, StubStorage, UserDocumentBuilder } from '@billsplit-wl/test-support';
import { StubCloudTasksClient, StubFirestoreDatabase } from 'ts-firebase-simulator';
import { beforeEach, describe, expect, it } from 'vitest';
import { FirestoreCollections } from '../../../constants';
import { ErrorCode } from '../../../errors';
import type { MergeService } from '../../../merge/MergeService';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { StubAuthService } from '../mocks/StubAuthService';

import { createUnitTestServiceConfig } from '../../test-config';

/**
 * MergeService Unit Tests
 *
 * Phase 1: Validation - checks if two users can be merged
 * Phase 2: Job creation - creates merge job and enqueues task
 *
 * Uses StubFirestoreDatabase (Firebase Simulator) with ComponentBuilder pattern
 * for dependency injection.
 *
 * Test coverage:
 * - Basic validation rules (different users, both exist, verified email)
 * - Merge job creation
 * - Cloud Tasks integration
 * - Firestore integration
 * - Error cases
 */
describe('MergeService', () => {
    let mergeService: MergeService;
    let db: StubFirestoreDatabase;
    let stubAuth: StubAuthService;
    let stubCloudTasks: StubCloudTasksClient;

    beforeEach(() => {
        // Create test infrastructure using Firebase Simulator
        db = new StubFirestoreDatabase();
        stubAuth = new StubAuthService();
        stubCloudTasks = new StubCloudTasksClient();

        // Create ComponentBuilder with test dependencies
        const componentBuilder = new ComponentBuilder(
            stubAuth,
            db,
            new StubStorage({ defaultBucketName: 'test-bucket' }),
            stubCloudTasks, // Pass stub directly to constructor
            createUnitTestServiceConfig(),
        );

        // Get MergeService from builder (properly wired with dependencies)
        mergeService = componentBuilder.buildMergeService();
    });

    describe('validateMergeEligibility', () => {
        describe('successful validation', () => {
            it('should return eligible when all rules pass', async () => {
                // Arrange: Create two users in Firestore
                const primaryUserId = toUserId('primary-user');
                const secondaryUserId = toUserId('secondary-user');

                db.seed(
                    `users/${primaryUserId}`,
                    new UserDocumentBuilder()
                        .withId(primaryUserId)
                        .withEmail('primary@example.com')
                        .build(),
                );

                db.seed(
                    `users/${secondaryUserId}`,
                    new UserDocumentBuilder()
                        .withId(secondaryUserId)
                        .withEmail('secondary@example.com')
                        .build(),
                );

                // Setup Auth users with verified email for primary
                stubAuth.setUser(
                    primaryUserId,
                    new AuthUserRecordBuilder()
                        .withUid(primaryUserId)
                        .withEmail('primary@example.com' as any)
                        .withEmailVerified(true)
                        .build(),
                );

                stubAuth.setUser(
                    secondaryUserId,
                    new AuthUserRecordBuilder()
                        .withUid(secondaryUserId)
                        .withEmail('secondary@example.com' as any)
                        .withEmailVerified(false)
                        .build(),
                );

                // Act
                const result = await mergeService.validateMergeEligibility(primaryUserId, secondaryUserId);

                // Assert
                expect(result).toEqual({
                    eligible: true,
                });
            });
        });

        describe('validation failures', () => {
            it('should reject when users are the same', async () => {
                // Arrange
                const userId = toUserId('same-user');

                // Act
                const result = await mergeService.validateMergeEligibility(userId, userId);

                // Assert
                expect(result).toEqual({
                    eligible: false,
                    reason: 'Cannot merge user with themselves',
                });
            });

            it('should reject when primary user not found in database', async () => {
                // Arrange
                const primaryUserId = toUserId('missing-primary');
                const secondaryUserId = toUserId('secondary-user');

                db.seed(
                    `users/${secondaryUserId}`,
                    new UserDocumentBuilder()
                        .withId(secondaryUserId)
                        .withEmail('secondary@example.com')
                        .build(),
                );

                // Act
                const result = await mergeService.validateMergeEligibility(primaryUserId, secondaryUserId);

                // Assert
                expect(result).toEqual({
                    eligible: false,
                    reason: 'Primary user not found in database',
                });
            });

            it('should reject when secondary user not found in database', async () => {
                // Arrange
                const primaryUserId = toUserId('primary-user');
                const secondaryUserId = toUserId('missing-secondary');

                db.seed(
                    `users/${primaryUserId}`,
                    new UserDocumentBuilder()
                        .withId(primaryUserId)
                        .withEmail('primary@example.com')
                        .build(),
                );

                // Act
                const result = await mergeService.validateMergeEligibility(primaryUserId, secondaryUserId);

                // Assert
                expect(result).toEqual({
                    eligible: false,
                    reason: 'Secondary user not found in database',
                });
            });

            it('should reject when primary user not found in auth', async () => {
                // Arrange
                const primaryUserId = toUserId('primary-user');
                const secondaryUserId = toUserId('secondary-user');

                // Create both users in Firestore
                db.seed(
                    `users/${primaryUserId}`,
                    new UserDocumentBuilder()
                        .withId(primaryUserId)
                        .withEmail('primary@example.com')
                        .build(),
                );

                db.seed(
                    `users/${secondaryUserId}`,
                    new UserDocumentBuilder()
                        .withId(secondaryUserId)
                        .withEmail('secondary@example.com')
                        .build(),
                );

                // Only create secondary user in auth (primary missing)
                stubAuth.setUser(
                    secondaryUserId,
                    new AuthUserRecordBuilder()
                        .withUid(secondaryUserId)
                        .withEmail('secondary@example.com' as any)
                        .withEmailVerified(false)
                        .build(),
                );

                // Act
                const result = await mergeService.validateMergeEligibility(primaryUserId, secondaryUserId);

                // Assert
                expect(result).toEqual({
                    eligible: false,
                    reason: 'Primary user not found in authentication system',
                });
            });

            it('should reject when secondary user not found in auth', async () => {
                // Arrange
                const primaryUserId = toUserId('primary-user');
                const secondaryUserId = toUserId('secondary-user');

                // Create both users in Firestore
                db.seed(
                    `users/${primaryUserId}`,
                    new UserDocumentBuilder()
                        .withId(primaryUserId)
                        .withEmail('primary@example.com')
                        .build(),
                );

                db.seed(
                    `users/${secondaryUserId}`,
                    new UserDocumentBuilder()
                        .withId(secondaryUserId)
                        .withEmail('secondary@example.com')
                        .build(),
                );

                // Only create primary user in auth (secondary missing)
                stubAuth.setUser(
                    primaryUserId,
                    new AuthUserRecordBuilder()
                        .withUid(primaryUserId)
                        .withEmail('primary@example.com' as any)
                        .withEmailVerified(true)
                        .build(),
                );

                // Act
                const result = await mergeService.validateMergeEligibility(primaryUserId, secondaryUserId);

                // Assert
                expect(result).toEqual({
                    eligible: false,
                    reason: 'Secondary user not found in authentication system',
                });
            });

            it('should reject when primary user email is not verified', async () => {
                // Arrange
                const primaryUserId = toUserId('primary-user');
                const secondaryUserId = toUserId('secondary-user');

                // Create both users in Firestore
                db.seed(
                    `users/${primaryUserId}`,
                    new UserDocumentBuilder()
                        .withId(primaryUserId)
                        .withEmail('primary@example.com')
                        .build(),
                );

                db.seed(
                    `users/${secondaryUserId}`,
                    new UserDocumentBuilder()
                        .withId(secondaryUserId)
                        .withEmail('secondary@example.com')
                        .build(),
                );

                // Setup Auth users with UNVERIFIED email for primary
                stubAuth.setUser(
                    primaryUserId,
                    new AuthUserRecordBuilder()
                        .withUid(primaryUserId)
                        .withEmail('primary@example.com' as any)
                        .withEmailVerified(false)
                        .build(),
                );

                stubAuth.setUser(
                    secondaryUserId,
                    new AuthUserRecordBuilder()
                        .withUid(secondaryUserId)
                        .withEmail('secondary@example.com' as any)
                        .withEmailVerified(false)
                        .build(),
                );

                // Act
                const result = await mergeService.validateMergeEligibility(primaryUserId, secondaryUserId);

                // Assert
                expect(result).toEqual({
                    eligible: false,
                    reason: 'Primary user email must be verified',
                });
            });
        });
    });

    describe('initiateMerge', () => {
        it('should create merge job and enqueue task when eligible', async () => {
            // Arrange: Create two eligible users
            const primaryUserId = toUserId('primary-user');
            const secondaryUserId = toUserId('secondary-user');

            db.seed(
                `users/${primaryUserId}`,
                new UserDocumentBuilder()
                    .withId(primaryUserId)
                    .withEmail('primary@example.com')
                    .build(),
            );

            db.seed(
                `users/${secondaryUserId}`,
                new UserDocumentBuilder()
                    .withId(secondaryUserId)
                    .withEmail('secondary@example.com')
                    .build(),
            );

            stubAuth.setUser(
                primaryUserId,
                new AuthUserRecordBuilder()
                    .withUid(primaryUserId)
                    .withEmail('primary@example.com' as any)
                    .withEmailVerified(true)
                    .build(),
            );

            stubAuth.setUser(
                secondaryUserId,
                new AuthUserRecordBuilder()
                    .withUid(secondaryUserId)
                    .withEmail('secondary@example.com' as any)
                    .withEmailVerified(false)
                    .build(),
            );

            // Act
            const result = await mergeService.initiateMerge(primaryUserId, secondaryUserId);

            // Assert: Should return job with pending status
            expect(result.status).toBe('pending');
            expect(result.jobId).toMatch(/^merge_\d+_[a-z0-9]+$/);

            // Assert: Job document should be created in Firestore
            const jobDoc = await db.collection(FirestoreCollections.ACCOUNT_MERGES).doc(result.jobId).get();
            expect(jobDoc.exists).toBe(true);
            const jobData = jobDoc.data();
            expect(jobData).toMatchObject({
                id: result.jobId,
                primaryUserId,
                secondaryUserId,
                status: 'pending',
            });
            expect(jobData?.createdAt).toBeDefined();

            // Assert: Cloud Task should be enqueued
            expect(stubCloudTasks.getTaskCount()).toBe(1);
            const task = stubCloudTasks.getLastEnqueuedTask();
            expect(task).toBeDefined();
            expect(task?.url).toContain('/processMerge');
            expect(JSON.parse(task?.body || '{}')).toEqual({ jobId: result.jobId });
        });

        it('should reject when users are not eligible', async () => {
            // Arrange: Same user (not eligible)
            const userId = toUserId('same-user');

            // Act & Assert
            await expect(mergeService.initiateMerge(userId, userId)).rejects.toMatchObject({
                code: ErrorCode.INVALID_REQUEST,
            });

            // Assert: No job created
            const jobs = await db.collection(FirestoreCollections.ACCOUNT_MERGES).get();
            expect(jobs.docs).toHaveLength(0);

            // Assert: No task enqueued
            expect(stubCloudTasks.getTaskCount()).toBe(0);
        });

        it('should reject when primary user email not verified', async () => {
            // Arrange: Primary user without verified email
            const primaryUserId = toUserId('primary-user');
            const secondaryUserId = toUserId('secondary-user');

            db.seed(
                `users/${primaryUserId}`,
                new UserDocumentBuilder()
                    .withId(primaryUserId)
                    .withEmail('primary@example.com')
                    .build(),
            );

            db.seed(
                `users/${secondaryUserId}`,
                new UserDocumentBuilder()
                    .withId(secondaryUserId)
                    .withEmail('secondary@example.com')
                    .build(),
            );

            stubAuth.setUser(
                primaryUserId,
                new AuthUserRecordBuilder()
                    .withUid(primaryUserId)
                    .withEmail('primary@example.com' as any)
                    .withEmailVerified(false)
                    .build(),
            );

            stubAuth.setUser(
                secondaryUserId,
                new AuthUserRecordBuilder()
                    .withUid(secondaryUserId)
                    .withEmail('secondary@example.com' as any)
                    .withEmailVerified(false)
                    .build(),
            );

            // Act & Assert
            await expect(mergeService.initiateMerge(primaryUserId, secondaryUserId)).rejects.toMatchObject({
                code: ErrorCode.INVALID_REQUEST,
            });

            // Assert: No job created
            const jobs = await db.collection(FirestoreCollections.ACCOUNT_MERGES).get();
            expect(jobs.docs).toHaveLength(0);

            // Assert: No task enqueued
            expect(stubCloudTasks.getTaskCount()).toBe(0);
        });
    });
});
