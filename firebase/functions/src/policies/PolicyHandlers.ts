import { CreatePolicyResponse, DeletePolicyVersionResponse, PublishPolicyResponse, toPolicyId, toPolicyText, toVersionHash, UpdatePolicyResponse } from '@billsplit-wl/shared';
import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import { PolicyService } from '../services/PolicyService';
import { validatePolicyIdParam } from '../validation/common';
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
     * GET /admin/policies/:policyId - Get policy details and version history
     */
    getPolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const policyId = validatePolicyIdParam(req.params);

        try {
            const policy = await this.policyService.getPolicy(policyId);

            res.json(policy);
        } catch (error) {
            logger.error('Failed to get policy', error as Error, {
                userId: req.user?.uid,
                policyId,
            });
            throw error;
        }
    };

    /**
     * GET /admin/policies/:policyId/versions/:hash - Get specific version content
     */
    getPolicyVersion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const policyId = validatePolicyIdParam(req.params);
        const { hash } = req.params;

        try {
            const version = await this.policyService.getPolicyVersion(policyId, toVersionHash(hash));

            res.json(version);
        } catch (error) {
            logger.error('Failed to get policy version', error as Error, {
                userId: req.user?.uid,
                policyId,
                versionHash: hash,
            });
            throw error;
        }
    };

    /**
     * PUT /admin/policies/:policyId - Create new draft version (not published)
     */
    updatePolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const policyId = validatePolicyIdParam(req.params);

        // Validate request body using Zod
        const validatedData = validateUpdatePolicy(req.body);
        const { text, publish = false } = validatedData;

        try {
            const result = await this.policyService.updatePolicy(policyId, toPolicyText(text), publish);

            const response: UpdatePolicyResponse = {
                versionHash: result.versionHash,
                currentVersionHash: result.currentVersionHash,
                published: publish,
            };
            res.json(response);
        } catch (error) {
            logger.error('Failed to update policy', error as Error, {
                userId: req.user?.uid,
                policyId,
            });
            throw error;
        }
    };

    /**
     * POST /admin/policies/:policyId/publish - Publish draft as current version
     */
    publishPolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const policyId = validatePolicyIdParam(req.params);

        // Validate request body using shared Zod schema
        const { versionHash } = validatePublishPolicy(req.body);

        try {
            const result = await this.policyService.publishPolicy(policyId, versionHash);

            const response: PublishPolicyResponse = {
                currentVersionHash: result.currentVersionHash,
            };
            res.json(response);
        } catch (error) {
            logger.error('Failed to publish policy', error as Error, {
                userId: req.user?.uid,
                policyId,
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
     * DELETE /admin/policies/:policyId/versions/:hash - Remove old version (with safeguards)
     */
    deletePolicyVersion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const policyId = validatePolicyIdParam(req.params);
        const { hash } = req.params;

        try {
            await this.policyService.deletePolicyVersion(policyId, toVersionHash(hash));

            const response: DeletePolicyVersionResponse = {};
            res.json(response);
        } catch (error) {
            logger.error('Failed to delete policy version', error as Error, {
                userId: req.user?.uid,
                policyId,
                versionHash: hash,
            });
            throw error;
        }
    };
}
