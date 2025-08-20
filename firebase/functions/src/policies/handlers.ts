import { Response } from 'express';
import * as crypto from 'crypto';
import { db } from '../firebase';
import { AuthenticatedRequest } from '../auth/middleware';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/errors';
import { createServerTimestamp, timestampToISO } from '../utils/dateHelpers';
import { PolicyDocument, PolicyVersion, FirestoreCollections } from '../shared/shared-types';
import { validateCreatePolicy, validateUpdatePolicy, validatePublishPolicy } from './validation';

/**
 * Calculate SHA-256 hash of policy text
 */
function calculatePolicyHash(text: string): string {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * GET /admin/policies - List all policies
 */
export const listPolicies = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const firestore = db;
        const policiesSnapshot = await firestore.collection(FirestoreCollections.POLICIES).get();

        const policies: PolicyDocument[] = [];

        policiesSnapshot.forEach((doc) => {
            const data = doc.data();
            // Validate required fields - fail fast if data is corrupt
            if (!data.policyName || !data.currentVersionHash || !data.versions) {
                throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'CORRUPT_POLICY_DATA', `Policy document ${doc.id} is missing required fields`);
            }

            policies.push({
                id: doc.id,
                policyName: data.policyName,
                currentVersionHash: data.currentVersionHash,
                versions: data.versions,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
            });
        });

        logger.info('Policies listed', {
            userId: req.user?.uid,
            count: policies.length,
        });

        res.json({
            policies,
            count: policies.length,
        });
    } catch (error) {
        logger.error('Failed to list policies', error as Error, {
            userId: req.user?.uid,
        });
        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_LIST_FAILED', 'Failed to retrieve policies');
    }
};

/**
 * GET /admin/policies/:id - Get policy details and version history
 */
export const getPolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
        const firestore = db;
        const policyDoc = await firestore.collection(FirestoreCollections.POLICIES).doc(id).get();

        if (!policyDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
        }

        const data = policyDoc.data();
        if (!data) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_DATA_NULL', 'Policy document data is null');
        }

        // Validate required fields - fail fast if data is corrupt
        if (!data.policyName || !data.currentVersionHash || !data.versions) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'CORRUPT_POLICY_DATA', 'Policy document is missing required fields');
        }

        const policy: PolicyDocument = {
            id: policyDoc.id,
            policyName: data.policyName,
            currentVersionHash: data.currentVersionHash,
            versions: data.versions,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
        };

        logger.info('Policy retrieved', {
            userId: req.user?.uid,
            policyId: id,
        });

        res.json(policy);
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        logger.error('Failed to get policy', error as Error, {
            userId: req.user?.uid,
            policyId: id,
        });
        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_GET_FAILED', 'Failed to retrieve policy');
    }
};

/**
 * GET /admin/policies/:id/versions/:hash - Get specific version content
 */
export const getPolicyVersion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id, hash } = req.params;

    try {
        const firestore = db;
        const policyDoc = await firestore.collection(FirestoreCollections.POLICIES).doc(id).get();

        if (!policyDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
        }

        const data = policyDoc.data();
        if (!data) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_DATA_NULL', 'Policy document data is null');
        }

        if (!data.versions) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'CORRUPT_POLICY_DATA', 'Policy document is missing versions data');
        }

        const versions = data.versions;
        const version = versions[hash];

        if (!version) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'VERSION_NOT_FOUND', 'Policy version not found');
        }

        logger.info('Policy version retrieved', {
            userId: req.user?.uid,
            policyId: id,
            versionHash: hash,
        });

        res.json({
            versionHash: hash,
            ...version,
        });
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        logger.error('Failed to get policy version', error as Error, {
            userId: req.user?.uid,
            policyId: id,
            versionHash: hash,
        });
        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'VERSION_GET_FAILED', 'Failed to retrieve policy version');
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
        const firestore = db;
        const policyDoc = await firestore.collection(FirestoreCollections.POLICIES).doc(id).get();

        if (!policyDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
        }

        // Calculate hash for new version
        const versionHash = calculatePolicyHash(text);
        const now = timestampToISO(createServerTimestamp());

        const newVersion: PolicyVersion = {
            text,
            createdAt: now,
        };

        const data = policyDoc.data();
        if (!data) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_DATA_NULL', 'Policy document data is null');
        }

        if (!data.versions) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'CORRUPT_POLICY_DATA', 'Policy document is missing versions data');
        }

        const updatedVersions = {
            ...data.versions,
            [versionHash]: newVersion,
        };

        // Prepare update data
        const updateData: any = {
            versions: updatedVersions,
            updatedAt: now,
        };

        // If publish is true, also set as current version
        if (publish) {
            updateData.currentVersionHash = versionHash;
        }

        await policyDoc.ref.update(updateData);

        logger.info('Policy updated', {
            userId: req.user?.uid,
            policyId: id,
            versionHash,
            published: publish,
        });

        res.json({
            success: true,
            versionHash,
            published: publish,
            message: publish ? 'Policy updated and published' : 'Draft version saved',
        });
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        logger.error('Failed to update policy', error as Error, {
            userId: req.user?.uid,
            policyId: id,
        });
        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_UPDATE_FAILED', 'Failed to update policy');
    }
};

/**
 * Internal function to publish a policy version (bypasses HTTP layer)
 */
export const publishPolicyInternal = async (id: string, versionHash: string): Promise<{ currentVersionHash: string }> => {
    if (!versionHash) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_HASH', 'Version hash is required');
    }

    try {
        const firestore = db;
        const policyDoc = await firestore.collection(FirestoreCollections.POLICIES).doc(id).get();

        if (!policyDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
        }

        const data = policyDoc.data();
        if (!data) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_DATA_NULL', 'Policy document data is null');
        }

        if (!data.versions) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'CORRUPT_POLICY_DATA', 'Policy document is missing versions data');
        }

        const versions = data.versions;

        // Verify the version exists
        if (!versions[versionHash]) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'VERSION_NOT_FOUND', 'Policy version not found');
        }

        const now = timestampToISO(createServerTimestamp());

        // Update policy to make this version current
        await firestore.collection(FirestoreCollections.POLICIES).doc(id).update({
            currentVersionHash: versionHash,
            updatedAt: now,
        });

        logger.info('Policy published successfully', { policyId: id, versionHash });

        return {
            currentVersionHash: versionHash,
        };
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        logger.error('Failed to publish policy', error as Error, { policyId: id, versionHash });
        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_PUBLISH_FAILED', 'Failed to publish policy');
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
        const firestore = db;
        const policyDoc = await firestore.collection(FirestoreCollections.POLICIES).doc(id).get();

        if (!policyDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
        }

        const data = policyDoc.data();
        if (!data) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_DATA_NULL', 'Policy document data is null');
        }

        if (!data.versions) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'CORRUPT_POLICY_DATA', 'Policy document is missing versions data');
        }

        const versions = data.versions;

        // Verify the version exists
        if (!versions[versionHash]) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'VERSION_NOT_FOUND', 'Version not found');
        }

        // Update current version hash
        await policyDoc.ref.update({
            currentVersionHash: versionHash,
            publishedAt: timestampToISO(createServerTimestamp()),
            publishedBy: req.user?.uid,
        });

        logger.info('Policy published', {
            userId: req.user?.uid,
            policyId: id,
            versionHash,
        });

        res.json({
            success: true,
            message: 'Policy published successfully',
            currentVersionHash: versionHash,
        });
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        logger.error('Failed to publish policy', error as Error, {
            userId: req.user?.uid,
            policyId: id,
            versionHash,
        });
        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_PUBLISH_FAILED', 'Failed to publish policy');
    }
};

/**
 * Internal function to create a policy (bypasses HTTP layer)
 */
export const createPolicyInternal = async (policyName: string, text: string, customId?: string): Promise<{ id: string; currentVersionHash: string }> => {
    if (!policyName || !text) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_FIELDS', 'Policy name and text are required');
    }

    try {
        const firestore = db;

        // Use custom ID if provided, otherwise generate ID from policy name (kebab-case)
        const id =
            customId ||
            policyName
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');

        // Check if policy already exists
        const existingDoc = await firestore.collection(FirestoreCollections.POLICIES).doc(id).get();
        if (existingDoc.exists) {
            throw new ApiError(HTTP_STATUS.CONFLICT, 'POLICY_EXISTS', 'Policy already exists');
        }

        // Calculate hash for initial version
        const versionHash = calculatePolicyHash(text);
        const now = timestampToISO(createServerTimestamp());

        const initialVersion: PolicyVersion = {
            text,
            createdAt: now,
        };

        const newPolicy: PolicyDocument = {
            id,
            policyName,
            currentVersionHash: versionHash,
            versions: {
                [versionHash]: initialVersion,
            },
            createdAt: now,
            updatedAt: now,
        };

        await firestore.collection(FirestoreCollections.POLICIES).doc(id).set(newPolicy);

        logger.info('Policy created successfully', { policyId: id });

        return {
            id,
            currentVersionHash: versionHash,
        };
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        logger.error('Failed to create policy', error as Error, { policyName });
        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_CREATE_FAILED', 'Failed to create policy');
    }
};

/**
 * POST /admin/policies - Create new policy
 */
export const createPolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Validate request body using Joi
    const { policyName, text } = validateCreatePolicy(req.body);

    try {
        const firestore = db;

        // Generate ID from policy name (kebab-case)
        const id = policyName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        // Check if policy already exists
        const existingDoc = await firestore.collection(FirestoreCollections.POLICIES).doc(id).get();
        if (existingDoc.exists) {
            throw new ApiError(HTTP_STATUS.CONFLICT, 'POLICY_EXISTS', 'Policy already exists');
        }

        // Calculate hash for initial version
        const versionHash = calculatePolicyHash(text);
        const now = timestampToISO(createServerTimestamp());

        const initialVersion: PolicyVersion = {
            text,
            createdAt: now,
        };

        const policyData = {
            policyName,
            currentVersionHash: versionHash,
            versions: {
                [versionHash]: initialVersion,
            },
            createdAt: now,
            createdBy: req.user?.uid,
            publishedAt: now,
            publishedBy: req.user?.uid,
        };

        await firestore.collection(FirestoreCollections.POLICIES).doc(id).set(policyData);

        logger.info('Policy created', {
            userId: req.user?.uid,
            policyId: id,
            versionHash,
        });

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            id,
            versionHash,
            message: 'Policy created successfully',
        });
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        logger.error('Failed to create policy', error as Error, {
            userId: req.user?.uid,
            policyName,
        });
        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_CREATE_FAILED', 'Failed to create policy');
    }
};

/**
 * DELETE /admin/policies/:id/versions/:hash - Remove old version (with safeguards)
 */
export const deletePolicyVersion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id, hash } = req.params;

    try {
        const firestore = db;
        const policyDoc = await firestore.collection(FirestoreCollections.POLICIES).doc(id).get();

        if (!policyDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
        }

        const data = policyDoc.data();
        if (!data) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_DATA_NULL', 'Policy document data is null');
        }

        if (!data.versions) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'CORRUPT_POLICY_DATA', 'Policy document is missing versions data');
        }

        const versions = data.versions;

        // Cannot delete current version
        if (data.currentVersionHash === hash) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'CANNOT_DELETE_CURRENT', 'Cannot delete the current published version');
        }

        // Cannot delete if it's the only version
        if (Object.keys(versions).length <= 1) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'CANNOT_DELETE_ONLY', 'Cannot delete the only version of a policy');
        }

        // Version must exist
        if (!versions[hash]) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'VERSION_NOT_FOUND', 'Version not found');
        }

        // Remove the version
        const updatedVersions = { ...versions };
        delete updatedVersions[hash];

        await policyDoc.ref.update({
            versions: updatedVersions,
            updatedAt: timestampToISO(createServerTimestamp()),
        });

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
        if (error instanceof ApiError) {
            throw error;
        }
        logger.error('Failed to delete policy version', error as Error, {
            userId: req.user?.uid,
            policyId: id,
            versionHash: hash,
        });
        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'VERSION_DELETE_FAILED', 'Failed to delete policy version');
    }
};
