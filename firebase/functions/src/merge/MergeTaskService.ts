import type { UserId } from '@billsplit-wl/shared';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import type { IAuthService } from '../services/auth';
import type { IFirestoreReader, IFirestoreWriter } from '../services/firestore';
import { ApiError } from '../utils/errors';
import { LoggerContext } from '../utils/logger-context';
import type { MergeJobDocument } from './MergeService';

/**
 * Summary of the entire merge operation
 */
export interface MergeExecutionSummary {
    jobId: string;
    primaryUserId: UserId;
    secondaryUserId: UserId;
    success: boolean;
    error?: string;
}

/**
 * Service for executing account merge data migrations
 *
 * Phase 3: Core task execution logic
 * - Fetches job document
 * - Updates job status (pending -> processing -> completed/failed)
 * - Coordinates the merge execution
 *
 * Note: Actual data migration logic will be implemented in future phases
 * once all required Firestore methods are available.
 */
export class MergeTaskService {
    constructor(
        private authService: IAuthService,
        private firestoreReader: IFirestoreReader,
        private firestoreWriter: IFirestoreWriter,
    ) {}

    /**
     * Execute a merge job - Phase 3 minimal implementation
     *
     * Steps:
     * 1. Fetch job document
     * 2. Validate job is pending
     * 3. Update job status to 'processing'
     * 4. [TODO: Perform actual data migrations]
     * 5. Update job status to 'completed' or 'failed'
     *
     * Note: Full migration logic will be added once Firestore methods are implemented
     */
    async executeMerge(jobId: string): Promise<MergeExecutionSummary> {
        LoggerContext.update({ operation: 'execute-merge', jobId });

        try {
            // Step 1: Fetch job document
            const job = await this.getJobDocument(jobId);

            // Step 2: Validate job status
            if (job.status !== 'pending') {
                throw new ApiError(
                    HTTP_STATUS.BAD_REQUEST,
                    'INVALID_JOB_STATUS',
                    `Job ${jobId} is not in pending status (current: ${job.status})`,
                );
            }

            // Step 3: Mark job as processing
            await this.updateJobStatus(jobId, 'processing');

            // Step 4: TODO - Perform actual data migrations
            // For Phase 3, we're just testing the job lifecycle
            // Migration logic will be added in a future phase

            // Step 5: Mark job as completed
            await this.updateJobStatus(jobId, 'completed');

            const summary: MergeExecutionSummary = {
                jobId,
                primaryUserId: job.primaryUserId,
                secondaryUserId: job.secondaryUserId,
                success: true,
            };

            logger.info('merge-completed', summary);
            return summary;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to execute merge', error as Error, { jobId });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'MERGE_EXECUTION_FAILED', 'Failed to execute account merge');
        }
    }

    // TODO: Add migration methods in future phases
    // - migrateGroups()
    // - migrateGroupMemberships()
    // - migrateExpenses()
    // - migrateSettlements()
    // - migrateComments()
    // - migrateActivityFeed()
    // - migrateShareLinkTokens()

    /**
     * Get merge job document from Firestore
     */
    private async getJobDocument(jobId: string): Promise<MergeJobDocument> {
        const job = await this.firestoreReader.getMergeJob(jobId);
        if (!job) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'JOB_NOT_FOUND', `Merge job ${jobId} not found`);
        }
        return job;
    }

    /**
     * Update merge job status
     */
    private async updateJobStatus(jobId: string, status: MergeJobDocument['status'], error?: string): Promise<void> {
        await this.firestoreWriter.updateMergeJobStatus(jobId, status, error);
        logger.info('merge-job-status-updated', { jobId, status, error });
    }
}
