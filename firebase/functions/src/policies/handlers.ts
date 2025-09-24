import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { validateCreatePolicy, validateUpdatePolicy, validatePublishPolicy } from './validation';
import { getAuth, getFirestore } from '../firebase';
import { ApplicationBuilder } from '../services/ApplicationBuilder';

const firestore = getFirestore();
const applicationBuilder = ApplicationBuilder.createApplicationBuilder(firestore, getAuth());
const policyService = applicationBuilder.buildPolicyService();

/**
 * GET /admin/policies - List all policies
 */
export const listPolicies = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const result = await policyService.listPolicies();

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
export const getPolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
        const policy = await policyService.getPolicy(id);

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
export const getPolicyVersion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id, hash } = req.params;

    try {
        const version = await policyService.getPolicyVersion(id, hash);

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
export const updatePolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    // Validate request body using Joi
    const { text, publish = false } = validateUpdatePolicy(req.body);

    try {
        const result = await policyService.updatePolicy(id, text, publish);

        logger.info('Policy updated', {
            userId: req.user?.uid,
            policyId: id,
            versionHash: result.versionHash,
            published: publish,
        });

        res.json({
            success: true,
            versionHash: result.versionHash,
            published: publish,
            currentVersionHash: result.currentVersionHash,
            message: publish ? 'Policy updated and published' : 'Draft version saved',
        });
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
export const publishPolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    // Validate request body using Joi
    const { versionHash } = validatePublishPolicy(req.body);

    try {
        const result = await policyService.publishPolicy(id, versionHash);

        logger.info('Policy published', {
            userId: req.user?.uid,
            policyId: id,
            versionHash,
        });

        res.json({
            success: true,
            message: 'Policy published successfully',
            currentVersionHash: result.currentVersionHash,
        });
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
export const createPolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Validate request body using Joi
    const { policyName, text } = validateCreatePolicy(req.body);

    try {
        const result = await policyService.createPolicy(policyName, text);

        logger.info('Policy created', {
            userId: req.user?.uid,
            policyId: result.id,
            policyName,
            versionHash: result.currentVersionHash,
        });

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            id: result.id,
            versionHash: result.currentVersionHash,
            message: 'Policy created successfully',
        });
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
export const deletePolicyVersion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id, hash } = req.params;

    try {
        await policyService.deletePolicyVersion(id, hash);

        logger.info('Policy version deleted', {
            userId: req.user?.uid,
            policyId: id,
            versionHash: hash,
        });

        res.json({
            success: true,
            message: 'Policy version deleted successfully',
        });
    } catch (error) {
        logger.error('Failed to delete policy version', error as Error, {
            userId: req.user?.uid,
            policyId: id,
            versionHash: hash,
        });
        throw error;
    }
};
