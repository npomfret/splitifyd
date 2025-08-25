import { Request, Response } from 'express';
import { logger } from '../logger';
import { firestoreDb } from '../firebase';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/errors';
import { FirestoreCollections } from '../shared/shared-types';

/**
 * GET /policies/current - List all current policy versions (public endpoint)
 */
export const getCurrentPolicies = async (req: Request, res: Response): Promise<void> => {
    try {
        const firestore = firestoreDb;
        const policiesSnapshot = await firestore.collection(FirestoreCollections.POLICIES).get();

        const currentPolicies: Record<string, { policyName: string; currentVersionHash: string }> = {};

        policiesSnapshot.forEach((doc) => {
            const data = doc.data();
            if (!data.policyName || !data.currentVersionHash) {
                return;
            }

            currentPolicies[doc.id] = {
                policyName: data.policyName,
                currentVersionHash: data.currentVersionHash,
            };
        });

        logger.info('policies-retrieved', { count: Object.keys(currentPolicies).length });

        res.json({
            policies: currentPolicies,
            count: Object.keys(currentPolicies).length,
        });
    } catch (error) {
        logger.error('Failed to get current policies', error as Error);
        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICIES_GET_FAILED', 'Failed to retrieve current policies');
    }
};

/**
 * GET /policies/:id/current - Get current version of a specific policy (public endpoint)
 */
export const getCurrentPolicy = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
        const firestore = firestoreDb;
        const policyDoc = await firestore.collection(FirestoreCollections.POLICIES).doc(id).get();

        if (!policyDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', 'Policy not found');
        }

        const data = policyDoc.data();
        if (!data) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_DATA_NULL', 'Policy document data is null');
        }

        if (!data.currentVersionHash || !data.versions || !data.policyName) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'CORRUPT_POLICY_DATA', 'Policy document is missing required fields');
        }

        const currentVersion = data.versions[data.currentVersionHash];
        if (!currentVersion) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'VERSION_NOT_FOUND', 'Current policy version not found in versions map');
        }

        logger.info('policy-retrieved', { id });

        res.json({
            id,
            policyName: data.policyName,
            currentVersionHash: data.currentVersionHash,
            text: currentVersion.text,
            createdAt: currentVersion.createdAt,
        });
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        logger.error('Failed to get current policy', error as Error, { policyId: id });
        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_GET_FAILED', 'Failed to retrieve current policy');
    }
};
