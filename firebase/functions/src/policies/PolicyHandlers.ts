import { CreatePolicyResponse, DeletePolicyVersionResponse, PublishPolicyResponse, UpdatePolicyResponse } from '@splitifyd/shared';
import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { HTTP_STATUS } from '../constants';
import { getAuth, getFirestore } from '../firebase';
import { getIdentityToolkitConfig } from '../client-config';
import { logger } from '../logger';
import { ApplicationBuilder } from '../services/ApplicationBuilder';
import { PolicyService } from '../services/PolicyService';
import { validateCreatePolicy, validatePublishPolicy, validateUpdatePolicy } from './validation';

export class PolicyHandlers {
    constructor(
        private readonly policyService: PolicyService,
    ) {
    }

    static createPolicyHandlers(applicationBuilder = ApplicationBuilder.createApplicationBuilder(getFirestore(), getAuth(), getIdentityToolkitConfig())) {
        const policyService = applicationBuilder.buildPolicyService();
        return new PolicyHandlers(policyService);
    }

    /**
     * GET /admin/policies - List all policies
     */
    listPolicies = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const result = await this.policyService.listPolicies();

            logger.info('Policies listed', {
                userId: req.user?.uid,
                count: result.count,
            });

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
            const policy = await this.policyService.getPolicy(id);

            logger.info('Policy retrieved', {
                userId: req.user?.uid,
                policyId: id,
            });

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
            const version = await this.policyService.getPolicyVersion(id, hash);

            logger.info('Policy version retrieved', {
                userId: req.user?.uid,
                policyId: id,
                versionHash: hash,
            });

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
            const result = await this.policyService.updatePolicy(id, text, publish);

            logger.info('Policy updated', {
                userId: req.user?.uid,
                policyId: id,
                versionHash: result.versionHash,
                published: publish,
            });

            const response: UpdatePolicyResponse = {
                success: true,
                versionHash: result.versionHash,
                currentVersionHash: result.currentVersionHash,
                published: publish,
                message: publish ? 'Policy updated and published' : 'Draft version saved',
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

        // Validate request body using Joi
        const { versionHash } = validatePublishPolicy(req.body);

        try {
            const result = await this.policyService.publishPolicy(id, versionHash);

            logger.info('Policy published', {
                userId: req.user?.uid,
                policyId: id,
                versionHash,
            });

            const response: PublishPolicyResponse = {
                success: true,
                message: 'Policy published successfully',
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

            logger.info('Policy created', {
                userId: req.user?.uid,
                policyId: result.id,
                policyName,
                versionHash: result.currentVersionHash,
            });

            const response: CreatePolicyResponse = {
                success: true,
                id: result.id,
                versionHash: result.currentVersionHash,
                message: 'Policy created successfully',
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
            await this.policyService.deletePolicyVersion(id, hash);

            logger.info('Policy version deleted', {
                userId: req.user?.uid,
                policyId: id,
                versionHash: hash,
            });

            const response: DeletePolicyVersionResponse = {
                success: true,
                message: 'Policy version deleted successfully',
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
