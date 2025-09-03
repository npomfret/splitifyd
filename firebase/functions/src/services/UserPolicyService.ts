import { firestoreDb } from '../firebase';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { createServerTimestamp } from '../utils/dateHelpers';
import { logger } from '../logger';
import { LoggerContext } from '../utils/logger-context';
import { FirestoreCollections } from '@splitifyd/shared';
import { PerformanceMonitor } from '../utils/performance-monitor';
import { IFirestoreReader } from './firestore/IFirestoreReader';

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
    
    constructor(private firestoreReader: IFirestoreReader) {}

    /**
     * Validate that a policy exists and the version hash is valid
     */
    private async validatePolicyAndVersion(policyId: string, versionHash: string): Promise<void> {
        const policy = await this.firestoreReader.getPolicy(policyId);

        if (!policy) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', `Policy ${policyId} not found`);
        }

        if (!policy.versions[versionHash]) {
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
        return PerformanceMonitor.monitorServiceCall(
            'UserPolicyService',
            'acceptPolicy',
            async () => this._acceptPolicy(userId, policyId, versionHash),
            { userId, policyId, versionHash }
        );
    }

    private async _acceptPolicy(userId: string, policyId: string, versionHash: string): Promise<{ policyId: string; versionHash: string; acceptedAt: string }> {
        LoggerContext.update({ userId, policyId, operation: 'accept-policy', versionHash });
        
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
        return PerformanceMonitor.monitorServiceCall(
            'UserPolicyService',
            'acceptMultiplePolicies',
            async () => this._acceptMultiplePolicies(userId, acceptances),
            { userId, count: acceptances.length }
        );
    }

    private async _acceptMultiplePolicies(userId: string, acceptances: AcceptPolicyRequest[]): Promise<Array<{ policyId: string; versionHash: string; acceptedAt: string }>> {
        LoggerContext.update({ userId, operation: 'accept-multiple-policies', count: acceptances.length });
        
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
            const allPolicies = await this.firestoreReader.getAllPolicies();

            // Get user's acceptance data
            const user = await this.firestoreReader.getUser(userId);

            if (!user) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
            }

            const userAcceptedPolicies = user.acceptedPolicies || {};
            const policies: PolicyAcceptanceStatus[] = [];
            let totalPending = 0;

            allPolicies.forEach((policy) => {
                const policyId = policy.id;
                const currentVersionHash = policy.currentVersionHash;
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
                    policyName: policy.policyName,
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