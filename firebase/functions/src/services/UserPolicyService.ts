import { PolicyAcceptanceStatusDTO, UserPolicyStatusResponse } from '@splitifyd/shared';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import { measureDb } from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import { ApiError } from '../utils/errors';
import { LoggerContext } from '../utils/logger-context';
import { IFirestoreReader } from './firestore';
import { IFirestoreWriter } from './firestore';

/**
 * Interface for policy acceptance request
 */
interface AcceptPolicyRequest {
    policyId: string;
    versionHash: string;
}

/**
 * Service for managing user policy acceptance operations
 */
export class UserPolicyService {
    constructor(
        private firestoreReader: IFirestoreReader,
        private firestoreWriter: IFirestoreWriter,
    ) {}

    /**
     * Validate that a policy exists and the version hash is valid
     */
    private async validatePolicyAndVersion(policyId: string, versionHash: string): Promise<void> {
        const policy = await this.firestoreReader.getPolicy(policyId);

        if (!policy) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'POLICY_NOT_FOUND', `Policy ${policyId} not found`);
        }

        if (!policy.versions[versionHash]) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_VERSION_HASH', `Version hash ${versionHash} not found for policy ${policyId}`);
        }
    }

    /**
     * Accept multiple policy versions for a user
     */
    async acceptMultiplePolicies(userId: string, acceptances: AcceptPolicyRequest[]): Promise<Array<{ policyId: string; versionHash: string; acceptedAt: string; }>> {
        return measureDb('UserPolicyService.acceptMultiplePolicies', async () => this._acceptMultiplePolicies(userId, acceptances));
    }

    private async _acceptMultiplePolicies(userId: string, acceptances: AcceptPolicyRequest[]): Promise<Array<{ policyId: string; versionHash: string; acceptedAt: string; }>> {
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

            // Build the update object with nested structure (not dot notation)
            const acceptedPolicies: Record<string, string> = {};
            acceptances.forEach((acceptance) => {
                acceptedPolicies[acceptance.policyId] = acceptance.versionHash;
            });

            const updateData = {
                acceptedPolicies, // Nested object structure
                // updatedAt is automatically added by FirestoreWriter
            };

            // Update user document with all acceptances
            await this.firestoreWriter.updateUser(userId, updateData);

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
            const policies: PolicyAcceptanceStatusDTO[] = [];
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
}
