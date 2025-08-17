import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { db } from '../firebase';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { FirestoreCollections } from '../shared/shared-types';
import { ApiError } from '../utils/errors';
import { createServerTimestamp } from '../utils/dateHelpers';

interface AcceptPolicyRequest {
    policyId: string;
    versionHash: string;
}

interface AcceptMultiplePoliciesRequest {
    acceptances: AcceptPolicyRequest[];
}

interface PolicyAcceptanceStatus {
    policyId: string;
    currentVersionHash: string;
    userAcceptedHash?: string;
    needsAcceptance: boolean;
    policyName: string;
}

interface UserPolicyStatusResponse {
    needsAcceptance: boolean;
    policies: PolicyAcceptanceStatus[];
    totalPending: number;
}

/**
 * Accept a single policy version for the authenticated user
 */
export const acceptPolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'AUTH_REQUIRED', 'Authentication required');
        }

        const { policyId, versionHash } = req.body as AcceptPolicyRequest;

        if (!policyId || !versionHash) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_REQUEST', 'policyId and versionHash are required');
        }

        // Validate that the policy exists and the version hash is current
        const firestore = db;
        const policyDoc = await firestore.collection(FirestoreCollections.POLICIES).doc(policyId).get();

        if (!policyDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', `Policy ${policyId} not found`);
        }

        const policyData = policyDoc.data()!;

        // Verify the version hash exists in the policy versions
        if (!policyData.versions[versionHash]) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_VERSION_HASH', `Version hash ${versionHash} not found for policy ${policyId}`);
        }

        // Update user's acceptedPolicies
        const userDocRef = firestore.collection(FirestoreCollections.USERS).doc(userId);

        await userDocRef.update({
            [`acceptedPolicies.${policyId}`]: versionHash,
            updatedAt: createServerTimestamp(),
        });

        logger.info('Policy accepted by user', {
            userId,
            policyId,
            versionHash,
            policyName: policyData.policyName,
        });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Policy accepted successfully',
            acceptedPolicy: {
                policyId,
                versionHash,
                acceptedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({
                error: {
                    code: error.code,
                    message: error.message,
                },
            });
        } else {
            logger.errorWithContext('Failed to accept policy', error as Error, {
                userId: req.user?.uid,
            });
            throw error;
        }
    }
};

/**
 * Accept multiple policy versions for the authenticated user
 */
export const acceptMultiplePolicies = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'AUTH_REQUIRED', 'Authentication required');
        }

        const { acceptances } = req.body as AcceptMultiplePoliciesRequest;

        if (!acceptances || !Array.isArray(acceptances) || acceptances.length === 0) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_REQUEST', 'acceptances array is required and must not be empty');
        }

        const firestore = db;
        const batch = firestore.batch();

        // Validate all policies and version hashes first
        for (const acceptance of acceptances) {
            const { policyId, versionHash } = acceptance;

            if (!policyId || !versionHash) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_REQUEST', 'Each acceptance must have policyId and versionHash');
            }

            const policyDoc = await firestore.collection(FirestoreCollections.POLICIES).doc(policyId).get();

            if (!policyDoc.exists) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', `Policy ${policyId} not found`);
            }

            const policyData = policyDoc.data()!;
            if (!policyData.versions[versionHash]) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_VERSION_HASH', `Version hash ${versionHash} not found for policy ${policyId}`);
            }
        }

        // Build the update object for user document
        const userDocRef = firestore.collection(FirestoreCollections.USERS).doc(userId);
        const updateData: any = {
            updatedAt: createServerTimestamp(),
        };

        acceptances.forEach((acceptance) => {
            updateData[`acceptedPolicies.${acceptance.policyId}`] = acceptance.versionHash;
        });

        batch.update(userDocRef, updateData);
        await batch.commit();

        logger.info('Multiple policies accepted by user', {
            userId,
            acceptedPolicies: acceptances.map((a) => ({
                policyId: a.policyId,
                versionHash: a.versionHash,
            })),
        });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'All policies accepted successfully',
            acceptedPolicies: acceptances.map((acceptance) => ({
                policyId: acceptance.policyId,
                versionHash: acceptance.versionHash,
                acceptedAt: new Date().toISOString(),
            })),
        });
    } catch (error) {
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({
                error: {
                    code: error.code,
                    message: error.message,
                },
            });
        } else {
            logger.errorWithContext('Failed to accept multiple policies', error as Error, {
                userId: req.user?.uid,
            });
            throw error;
        }
    }
};

/**
 * Get the user's policy acceptance status
 */
export const getUserPolicyStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'AUTH_REQUIRED', 'Authentication required');
        }

        const firestore = db;

        // Get all policies
        const policiesSnapshot = await firestore.collection(FirestoreCollections.POLICIES).get();

        // Get user's acceptance data
        const userDoc = await firestore.collection(FirestoreCollections.USERS).doc(userId).get();

        if (!userDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
        }

        const userData = userDoc.data()!;
        const userAcceptedPolicies = userData.acceptedPolicies || {};

        const policies: PolicyAcceptanceStatus[] = [];
        let totalPending = 0;

        policiesSnapshot.forEach((doc) => {
            const policyData = doc.data();
            const policyId = doc.id;
            const currentVersionHash = policyData.currentVersionHash;
            const userAcceptedHash = userAcceptedPolicies[policyId];
            const needsAcceptance = !userAcceptedHash || userAcceptedHash !== currentVersionHash;

            if (needsAcceptance) {
                totalPending++;
            }

            policies.push({
                policyId,
                currentVersionHash,
                userAcceptedHash,
                needsAcceptance,
                policyName: policyData.policyName,
            });
        });

        const needsAcceptance = totalPending > 0;

        logger.info('Retrieved user policy status', {
            userId,
            totalPolicies: policies.length,
            totalPending,
        });

        const response: UserPolicyStatusResponse = {
            needsAcceptance,
            policies,
            totalPending,
        };

        res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({
                error: {
                    code: error.code,
                    message: error.message,
                },
            });
        } else {
            logger.errorWithContext('Failed to get user policy status', error as Error, {
                userId: req.user?.uid,
            });
            throw error;
        }
    }
};
