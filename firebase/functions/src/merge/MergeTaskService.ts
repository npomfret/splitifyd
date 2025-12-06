import type { UserId } from '@billsplit-wl/shared';
import { Errors } from '../errors';
import { ErrorDetail } from '../errors';
import { logger } from '../logger';
import type { IAuthService } from '../services/auth';
import type { IFirestoreReader, IFirestoreWriter } from '../services/firestore';
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
     * Execute a merge job
     *
     * Steps:
     * 1. Fetch job document
     * 2. Validate job is pending
     * 3. Update job status to 'processing'
     * 4. Perform data migrations across all collections
     * 5. Mark secondary account as merged and disabled
     * 6. Update job status to 'completed' or 'failed'
     */
    async executeMerge(jobId: string): Promise<MergeExecutionSummary> {
        LoggerContext.update({ operation: 'execute-merge', jobId });

        try {
            // Step 1: Fetch job document
            const job = await this.getJobDocument(jobId);

            // Step 2: Validate job status
            if (job.status !== 'pending') {
                throw Errors.invalidRequest(`Job ${jobId} is not in pending status (current: ${job.status})`);
            }

            // Step 3: Mark job as processing
            await this.updateJobStatus(jobId, 'processing');

            // Step 4: Perform actual data migrations
            try {
                await this.performDataMigrations(job.secondaryUserId, job.primaryUserId);
            } catch (migrationError) {
                // Migration failed - mark job as failed and rethrow
                const errorMessage = migrationError instanceof Error ? migrationError.message : 'Migration failed';
                await this.updateJobStatus(jobId, 'failed', errorMessage);
                throw migrationError;
            }

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
            logger.error('Failed to execute merge', error as Error, { jobId });
            throw error;
        }
    }

    /**
     * Perform all data migrations from secondary to primary account
     * Runs all reassignment operations in sequence
     */
    private async performDataMigrations(fromUserId: UserId, toUserId: UserId): Promise<void> {
        logger.info('starting-data-migrations', { fromUserId, toUserId });

        try {
            // Migrate groups (ownership)
            const groupsCount = await this.firestoreWriter.reassignGroupOwnership(fromUserId, toUserId);
            logger.info('migration-step-complete', { step: 'groups', count: groupsCount });

            // Migrate group memberships
            const membershipsCount = await this.firestoreWriter.reassignGroupMemberships(fromUserId, toUserId);
            logger.info('migration-step-complete', { step: 'memberships', count: membershipsCount });

            // Migrate expenses (payer)
            const expensesPayerCount = await this.firestoreWriter.reassignExpensePayer(fromUserId, toUserId);
            logger.info('migration-step-complete', { step: 'expenses-payer', count: expensesPayerCount });

            // Migrate expenses (participants)
            const expensesParticipantsCount = await this.firestoreWriter.reassignExpenseParticipants(fromUserId, toUserId);
            logger.info('migration-step-complete', { step: 'expenses-participants', count: expensesParticipantsCount });

            // Migrate settlements (payer)
            const settlementsPayerCount = await this.firestoreWriter.reassignSettlementPayer(fromUserId, toUserId);
            logger.info('migration-step-complete', { step: 'settlements-payer', count: settlementsPayerCount });

            // Migrate settlements (payee)
            const settlementsPayeeCount = await this.firestoreWriter.reassignSettlementPayee(fromUserId, toUserId);
            logger.info('migration-step-complete', { step: 'settlements-payee', count: settlementsPayeeCount });

            // Migrate comments
            const commentsCount = await this.firestoreWriter.reassignCommentAuthors(fromUserId, toUserId);
            logger.info('migration-step-complete', { step: 'comments', count: commentsCount });

            // Migrate activity feed
            const activityCount = await this.firestoreWriter.reassignActivityFeedActors(fromUserId, toUserId);
            logger.info('migration-step-complete', { step: 'activity-feed', count: activityCount });

            // Migrate share link tokens
            const tokensCount = await this.firestoreWriter.reassignShareLinkTokens(fromUserId, toUserId);
            logger.info('migration-step-complete', { step: 'share-link-tokens', count: tokensCount });

            // Mark secondary user account as merged and disabled
            await this.firestoreWriter.markUserAsMerged(fromUserId, toUserId);
            logger.info('migration-step-complete', { step: 'mark-user-merged' });

            logger.info('data-migrations-complete', {
                fromUserId,
                toUserId,
                summary: {
                    groups: groupsCount,
                    memberships: membershipsCount,
                    expensesPayer: expensesPayerCount,
                    expensesParticipants: expensesParticipantsCount,
                    settlementsPayer: settlementsPayerCount,
                    settlementsPayee: settlementsPayeeCount,
                    comments: commentsCount,
                    activityFeed: activityCount,
                    shareLinkTokens: tokensCount,
                },
            });
        } catch (error) {
            logger.error('data-migrations-failed', error as Error, { fromUserId, toUserId });
            throw Errors.serviceError(ErrorDetail.MERGE_FAILED);
        }
    }

    /**
     * Get merge job document from Firestore
     */
    private async getJobDocument(jobId: string): Promise<MergeJobDocument> {
        const job = await this.firestoreReader.getMergeJob(jobId);
        if (!job) {
            throw Errors.notFound('MergeJob', 'JOB_NOT_FOUND', jobId);
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
