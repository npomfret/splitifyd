import { firestoreDb } from '../firebase';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { createServerTimestamp } from '../utils/dateHelpers';
import { logger } from '../logger';
import { FirestoreCollections } from '@splitifyd/shared';

/**
 * Interface for policy acceptance status
 */
export interface PolicyAcceptanceStatus {
    policyId: string;
    currentVersionHash: string;
    userAcceptedHash?: string;
    needsAcceptance: boolean;
    policyName: string;
}

/**
 * Interface for user policy status response
 */
export interface UserPolicyStatusResponse {
    needsAcceptance: boolean;
    policies: PolicyAcceptanceStatus[];
    totalPending: number;
}

/**
 * Interface for policy acceptance request
 */
export interface AcceptPolicyRequest {
    policyId: string;
    versionHash: string;
}

/**
 * Service for managing user policy acceptance operations
 */
export class UserPolicyService {
    private policiesCollection = firestoreDb.collection(FirestoreCollections.POLICIES);
    private usersCollection = firestoreDb.collection(FirestoreCollections.USERS);

    /**
     * Validate that a policy exists and the version hash is valid
     */
    private async validatePolicyAndVersion(policyId: string, versionHash: string): Promise<void> {
        const policyDoc = await this.policiesCollection.doc(policyId).get();

        if (!policyDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', `Policy ${policyId} not found`);
        }

        const policyData = policyDoc.data();
        if (!policyData || !policyData.versions[versionHash]) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'INVALID_VERSION_HASH',
                `Version hash ${versionHash} not found for policy ${policyId}`
            );
        }
    }

    /**
     * Accept a single policy version for a user
     */
    async acceptPolicy(userId: string, policyId: string, versionHash: string): Promise<{ policyId: string; versionHash: string; acceptedAt: string }> {
        try {
            // Validate that the policy exists and the version hash is current
            await this.validatePolicyAndVersion(policyId, versionHash);

            // Update user's acceptedPolicies
            const userDocRef = this.usersCollection.doc(userId);
            await userDocRef.update({
                [`acceptedPolicies.${policyId}`]: versionHash,
                updatedAt: createServerTimestamp(),
            });

            const acceptedAt = new Date().toISOString();

            logger.info('policy-accepted', { id: policyId, userId });

            return {
                policyId,
                versionHash,
                acceptedAt,
            };
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to accept policy', error as Error, { userId, policyId, versionHash });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_ACCEPT_FAILED', 'Failed to accept policy');
        }
    }

    /**
     * Accept multiple policy versions for a user
     */
    async acceptMultiplePolicies(userId: string, acceptances: AcceptPolicyRequest[]): Promise<Array<{ policyId: string; versionHash: string; acceptedAt: string }>> {
        try {
            // Validate all policies and version hashes first
            for (const acceptance of acceptances) {
                const { policyId, versionHash } = acceptance;

                if (!policyId || !versionHash) {
                    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_REQUEST', 'Each acceptance must have policyId and versionHash');
                }

                await this.validatePolicyAndVersion(policyId, versionHash);
            }

            // Build the update object for user document
            const userDocRef = this.usersCollection.doc(userId);
            const updateData: any = {
                updatedAt: createServerTimestamp(),
            };

            acceptances.forEach((acceptance) => {
                updateData[`acceptedPolicies.${acceptance.policyId}`] = acceptance.versionHash;
            });

            // Use batch to ensure atomicity
            const batch = firestoreDb.batch();
            batch.update(userDocRef, updateData);
            await batch.commit();

            const acceptedAt = new Date().toISOString();

            logger.info('policies-accepted', {
                ids: acceptances.map((a) => a.policyId).join(','),
                userId,
            });

            return acceptances.map((acceptance) => ({
                policyId: acceptance.policyId,
                versionHash: acceptance.versionHash,
                acceptedAt,
            }));
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to accept multiple policies', error as Error, { userId, acceptancesCount: acceptances.length });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICIES_ACCEPT_FAILED', 'Failed to accept multiple policies');
        }
    }

    /**
     * Get user's policy acceptance status
     */
    async getUserPolicyStatus(userId: string): Promise<UserPolicyStatusResponse> {
        try {
            // Get all policies
            const policiesSnapshot = await this.policiesCollection.get();

            // Get user's acceptance data
            const userDoc = await this.usersCollection.doc(userId).get();

            if (!userDoc.exists) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
            }

            const userData = userDoc.data();
            if (!userData) {
                throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'USER_DATA_NULL', 'User document data is null');
            }

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

            logger.info('User policy status retrieved', { userId, totalPending, needsAcceptance });

            return {
                needsAcceptance,
                policies,
                totalPending,
            };
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to get user policy status', error as Error, { userId });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'USER_POLICY_STATUS_FAILED', 'Failed to get user policy status');
        }
    }

    /**
     * Check if a user has accepted all required policies
     */
    async checkPolicyCompliance(userId: string): Promise<{ compliant: boolean; pendingCount: number; pendingPolicies: string[] }> {
        try {
            const status = await this.getUserPolicyStatus(userId);
            const pendingPolicies = status.policies.filter(p => p.needsAcceptance).map(p => p.policyId);

            return {
                compliant: !status.needsAcceptance,
                pendingCount: status.totalPending,
                pendingPolicies,
            };
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to check policy compliance', error as Error, { userId });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_COMPLIANCE_CHECK_FAILED', 'Failed to check policy compliance');
        }
    }
}