import type { ICloudTasksClient } from '@billsplit-wl/firebase-simulator';
import type { ISOString, UserId } from '@billsplit-wl/shared';
import { isoStringNow } from '@billsplit-wl/shared';
import { logger } from '../logger';
import type { IAuthService } from '../services/auth';
import type { IFirestoreReader, IFirestoreWriter } from '../services/firestore';
import { Errors } from '../errors';
import { ErrorDetail } from '../errors';
import { LoggerContext } from '../utils/logger-context';
import { ServiceConfig } from './ServiceConfig';

/**
 * Result of merge eligibility validation
 */
export interface MergeEligibilityResult {
    eligible: boolean;
    reason?: string;
}

/**
 * Status of a merge job
 */
export type MergeJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Merge job document stored in Firestore
 */
export interface MergeJobDocument {
    id: string;
    primaryUserId: UserId;
    secondaryUserId: UserId;
    status: MergeJobStatus;
    createdAt: ISOString;
    startedAt?: ISOString;
    completedAt?: ISOString;
    error?: string;
}

/**
 * Result of initiating a merge
 */
export interface InitiateMergeResult {
    jobId: string;
    status: MergeJobStatus;
}

/**
 * Service for managing account merge operations
 *
 * Phase 1: Validation - checks if two users can be merged
 * Phase 2: Job creation - creates merge job and enqueues processing task
 */
export class MergeService {
    constructor(
        private authService: IAuthService,
        private firestoreReader: IFirestoreReader,
        private firestoreWriter: IFirestoreWriter,
        private cloudTasksClient: ICloudTasksClient,
        private config: ServiceConfig,
    ) {}

    /**
     * Validate that two users can be merged
     *
     * Rules:
     * - Both users must exist in Firestore
     * - Both users must exist in Auth
     * - Users must be different (cannot merge user with themselves)
     * - Primary user must have a verified email
     */
    async validateMergeEligibility(primaryUserId: UserId, secondaryUserId: UserId): Promise<MergeEligibilityResult> {
        LoggerContext.update({ operation: 'validate-merge-eligibility', primaryUserId, secondaryUserId });

        try {
            // Rule 1: Users must be different
            if (primaryUserId === secondaryUserId) {
                return {
                    eligible: false,
                    reason: 'Cannot merge user with themselves',
                };
            }

            // Rule 2: Both users must exist in Firestore
            const [primaryUser, secondaryUser] = await Promise.all([
                this.firestoreReader.getUser(primaryUserId),
                this.firestoreReader.getUser(secondaryUserId),
            ]);

            if (!primaryUser) {
                return {
                    eligible: false,
                    reason: 'Primary user not found in database',
                };
            }

            if (!secondaryUser) {
                return {
                    eligible: false,
                    reason: 'Secondary user not found in database',
                };
            }

            // Rule 3: Both users must exist in Auth
            const primaryAuthUser = await this.authService.getUser(primaryUserId);
            if (!primaryAuthUser) {
                return {
                    eligible: false,
                    reason: 'Primary user not found in authentication system',
                };
            }

            const secondaryAuthUser = await this.authService.getUser(secondaryUserId);
            if (!secondaryAuthUser) {
                return {
                    eligible: false,
                    reason: 'Secondary user not found in authentication system',
                };
            }

            // Rule 4: Primary user must have verified email
            if (!primaryAuthUser.emailVerified) {
                return {
                    eligible: false,
                    reason: 'Primary user email must be verified',
                };
            }

            // All rules passed
            logger.info('merge-eligibility-validated', { primaryUserId, secondaryUserId });
            return {
                eligible: true,
            };
        } catch (error) {
            logger.error('Failed to validate merge eligibility', error as Error, { primaryUserId, secondaryUserId });
            throw error;
        }
    }

    /**
     * Initiate a merge between two user accounts
     *
     * Creates a merge job document and enqueues a Cloud Task for async processing
     */
    async initiateMerge(primaryUserId: UserId, secondaryUserId: UserId): Promise<InitiateMergeResult> {
        LoggerContext.update({ operation: 'initiate-merge', primaryUserId, secondaryUserId });

        try {
            // Step 1: Validate eligibility
            const eligibility = await this.validateMergeEligibility(primaryUserId, secondaryUserId);
            if (!eligibility.eligible) {
                throw Errors.invalidRequest(eligibility.reason || 'Users cannot be merged');
            }

            // Step 2: Create merge job document
            const jobId = `merge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const now = isoStringNow();

            const jobDocument: MergeJobDocument = {
                id: jobId,
                primaryUserId,
                secondaryUserId,
                status: 'pending',
                createdAt: now,
            };

            await this.firestoreWriter.createMergeJob(jobId, jobDocument);

            // Step 3: Enqueue Cloud Task for async processing
            // Note: Task handler will be implemented in Phase 3
            const queuePath = this.cloudTasksClient.queuePath(
                this.config.projectId,
                this.config.cloudTasksLocation,
                'account-merges',
            );

            await this.cloudTasksClient.createTask({
                parent: queuePath,
                task: {
                    httpRequest: {
                        httpMethod: 'POST',
                        url: `${this.config.functionsUrl}/processMerge`,
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ jobId }),
                        oidcToken: {
                            serviceAccountEmail: this.config.cloudTasksServiceAccount,
                            audience: this.config.functionsUrl,
                        },
                    },
                },
            });

            logger.info('merge-job-created', { jobId, primaryUserId, secondaryUserId });

            return {
                jobId,
                status: 'pending',
            };
        } catch (error) {
            logger.error('Failed to initiate merge', error as Error, { primaryUserId, secondaryUserId });
            throw error;
        }
    }

    /**
     * Get merge job for a specific user
     *
     * Fetches the job document and verifies the user is authorized to view it.
     * User must be either the primary or secondary user in the merge.
     *
     * @throws {ApiError} NOT_FOUND if job doesn't exist
     * @throws {ApiError} FORBIDDEN if user is not authorized
     */
    async getMergeJobForUser(jobId: string, userId: UserId): Promise<MergeJobDocument> {
        LoggerContext.update({ operation: 'get-merge-job', jobId, userId });

        try {
            // Fetch job document
            const job = await this.firestoreReader.getMergeJob(jobId);

            if (!job) {
                throw Errors.notFound('MergeJob', 'JOB_NOT_FOUND', jobId);
            }

            // Verify user is authorized (must be primary or secondary user)
            if (job.primaryUserId !== userId && job.secondaryUserId !== userId) {
                throw Errors.forbidden(ErrorDetail.INSUFFICIENT_PERMISSIONS);
            }

            logger.info('merge-job-retrieved', { jobId, userId });
            return job;
        } catch (error) {
            logger.error('Failed to get merge job', error as Error, { jobId, userId });
            throw error;
        }
    }
}
