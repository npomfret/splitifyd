import { toUserId } from '@billsplit-wl/shared';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/middleware';
import { HTTP_STATUS } from '../constants';
import { Errors } from '../utils/errors';
import type { MergeService } from './MergeService';
import type { MergeTaskService } from './MergeTaskService';
import { validateInitiateMergeRequest, validateJobId } from './validation';

/**
 * HTTP handlers for account merge endpoints
 *
 * Provides REST API endpoints for:
 * - Initiating account merges
 * - Checking merge job status
 * - Processing merge tasks (Cloud Task handler)
 */
export class MergeHandlers {
    constructor(
        private readonly mergeService: MergeService,
        private readonly mergeTaskService: MergeTaskService,
    ) {}

    /**
     * POST /merge
     * Initiate an account merge
     *
     * The authenticated user becomes the primary account, and the specified
     * secondaryUserId will be merged into it.
     */
    initiateMerge = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const primaryUserIdString = req.user?.uid;
        if (!primaryUserIdString) {
            throw Errors.UNAUTHORIZED();
        }

        // Validate request body
        const { secondaryUserId } = validateInitiateMergeRequest(req.body);

        // Initiate the merge
        const result = await this.mergeService.initiateMerge(toUserId(primaryUserIdString), secondaryUserId);

        res.status(HTTP_STATUS.CREATED).json(result);
    };

    /**
     * GET /merge/:jobId
     * Get the status of a merge job
     */
    getMergeStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userIdString = req.user?.uid;
        if (!userIdString) {
            throw Errors.UNAUTHORIZED();
        }

        const jobId = validateJobId(req.params.jobId);

        // Get job via service (includes authorization check)
        const job = await this.mergeService.getMergeJobForUser(jobId, toUserId(userIdString));

        res.json(job);
    };

    /**
     * POST /tasks/processMerge
     * Cloud Task handler for processing merge jobs
     *
     * This endpoint is called by Cloud Tasks to perform the actual data migration.
     * It should be protected by Cloud Tasks auth in production.
     */
    processMergeTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        // Validate request body contains jobId
        const { jobId } = req.body;
        if (!jobId || typeof jobId !== 'string') {
            throw Errors.MISSING_FIELD('jobId');
        }

        // Execute the merge task
        const result = await this.mergeTaskService.executeMerge(jobId);

        res.json(result);
    };
}
