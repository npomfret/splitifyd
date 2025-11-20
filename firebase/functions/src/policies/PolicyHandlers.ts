import { CreatePolicyResponse, DeletePolicyVersionResponse, PublishPolicyResponse, toPolicyId, toPolicyText, toVersionHash, UpdatePolicyResponse } from '@billsplit-wl/shared';
import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import { PolicyService } from '../services/PolicyService';
import { validateCreatePolicy, validatePublishPolicy, validateUpdatePolicy } from './validation';

export class PolicyHandlers {
    constructor(
        private readonly policyService: PolicyService,
    ) {
    }

    /**
     * GET /admin/policies - List all policies
     */
    listPolicies = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const result = await this.policyService.listPolicies();

            res.json(result);
        } catch (error) {
            logger.error('Failed to list policies', error as Error, {
                userId: req.user?.uid,
            });
            throw error;
        }
    };

    /**
     * GET /admin/policies/:id - Get policy details and version history
     */
    getPolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;

        try {
            const policy = await this.policyService.getPolicy(toPolicyId(id));

            res.json(policy);
        } catch (error) {
            logger.error('Failed to get policy', error as Error, {
                userId: req.user?.uid,
                policyId: id,
            });
            throw error;
        }
    };

    /**
     * GET /admin/policies/:id/versions/:hash - Get specific version content
     */
    getPolicyVersion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id, hash } = req.params;

        try {
            const version = await this.policyService.getPolicyVersion(toPolicyId(id), toVersionHash(hash));

            res.json(version);
        } catch (error) {
            logger.error('Failed to get policy version', error as Error, {
                userId: req.user?.uid,
                policyId: id,
                versionHash: hash,
            });
            throw error;
        }
    };

    /**
     * PUT /admin/policies/:id - Create new draft version (not published)
     */
    updatePolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;

        // Validate request body using Zod
        const validatedData = validateUpdatePolicy(req.body);
        const { text, publish = false } = validatedData;

        try {
            const result = await this.policyService.updatePolicy(toPolicyId(id), toPolicyText(text), publish);

            const response: UpdatePolicyResponse = {
                versionHash: result.versionHash,
                currentVersionHash: result.currentVersionHash,
                published: publish,
            };
            res.json(response);
        } catch (error) {
            logger.error('Failed to update policy', error as Error, {
                userId: req.user?.uid,
                policyId: id,
            });
            throw error;
        }
    };

    /**
     * POST /admin/policies/:id/publish - Publish draft as current version
     */
    publishPolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;

        // Validate request body using shared Zod schema
        const { versionHash } = validatePublishPolicy(req.body);

        try {
            const result = await this.policyService.publishPolicy(toPolicyId(id), versionHash);

            const response: PublishPolicyResponse = {
                currentVersionHash: result.currentVersionHash,
            };
            res.json(response);
        } catch (error) {
            logger.error('Failed to publish policy', error as Error, {
                userId: req.user?.uid,
                policyId: id,
                versionHash,
            });
            throw error;
        }
    };

    /**
     * POST /admin/policies - Create new policy
     */
    createPolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        // Validate request body using Zod
        const validatedData = validateCreatePolicy(req.body);
        const { policyName, text } = validatedData;

        try {
            const result = await this.policyService.createPolicy(policyName, text);

            const response: CreatePolicyResponse = {
                id: toPolicyId(result.id),
                versionHash: result.currentVersionHash,
            };
            res.status(HTTP_STATUS.CREATED).json(response);
        } catch (error) {
            logger.error('Failed to create policy', error as Error, {
                userId: req.user?.uid,
                policyName,
            });
            throw error;
        }
    };

    /**
     * DELETE /admin/policies/:id/versions/:hash - Remove old version (with safeguards)
     */
    deletePolicyVersion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id, hash } = req.params;

        try {
            await this.policyService.deletePolicyVersion(toPolicyId(id), toVersionHash(hash));

            const response: DeletePolicyVersionResponse = {
            };
            res.json(response);
        } catch (error) {
            logger.error('Failed to delete policy version', error as Error, {
                userId: req.user?.uid,
                policyId: id,
                versionHash: hash,
            });
            throw error;
        }
    };
}
