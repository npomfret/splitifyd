import { isoStringNow, PolicyAcceptanceStatusDTO, PolicyId, UserPolicyStatusResponse, VersionHash } from '@billsplit-wl/shared';
import type { UserId } from '@billsplit-wl/shared';
import { FirestoreCollections } from '../constants';
import { ApiError, ErrorDetail, Errors } from '../errors';
import { logger } from '../logger';
import { measureDb } from '../monitoring/measure';
import { LoggerContext } from '../utils/logger-context';
import { IFirestoreReader } from './firestore';
import { IFirestoreWriter } from './firestore';

/**
 * Interface for policy acceptance request
 */
interface AcceptPolicyRequest {
    policyId: PolicyId;
    versionHash: VersionHash;
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
    private async validatePolicyAndVersion(policyId: PolicyId, versionHash: VersionHash): Promise<void> {
        const policy = await this.firestoreReader.getPolicy(policyId);

        if (!policy) {
            throw Errors.notFound('Policy', ErrorDetail.POLICY_NOT_FOUND);
        }

        if (!policy.versions[versionHash]) {
            throw Errors.validationError('versionHash', 'Version hash not found for policy');
        }
    }

    /**
     * Accept multiple policy versions for a user
     */
    async acceptMultiplePolicies(userId: UserId, acceptances: AcceptPolicyRequest[]): Promise<Array<{ policyId: PolicyId; versionHash: VersionHash; acceptedAt: string; }>> {
        return measureDb('UserPolicyService.acceptMultiplePolicies', async () => this._acceptMultiplePolicies(userId, acceptances));
    }

    private async _acceptMultiplePolicies(userId: UserId, acceptances: AcceptPolicyRequest[]): Promise<Array<{ policyId: PolicyId; versionHash: VersionHash; acceptedAt: string; }>> {
        LoggerContext.update({ userId, operation: 'accept-multiple-policies', count: acceptances.length });

        try {
            // Validate all policies and version hashes first
            for (const acceptance of acceptances) {
                const { policyId, versionHash } = acceptance;

                if (!policyId || !versionHash) {
                    throw Errors.invalidRequest('Each acceptance must have policyId and versionHash');
                }

                await this.validatePolicyAndVersion(policyId, versionHash);
            }

            // Use transaction for atomic read-modify-write to preserve history
            const now = isoStringNow();
            const results = await this.firestoreWriter.runTransaction(async (transaction) => {
                const userRef = this.firestoreWriter.getDocumentReferenceInTransaction(
                    transaction,
                    FirestoreCollections.USERS,
                    userId,
                );
                const userDoc = await transaction.get(userRef);

                if (!userDoc.exists) {
                    throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
                }

                const userData = userDoc.data() || {};
                const existingPolicies: Record<string, Record<string, string>> = userData.acceptedPolicies ?? {};

                // Build updated policies map (preserve history, only add new entries)
                const updatedPolicies: Record<string, Record<string, string>> = { ...existingPolicies };
                const acceptedResults: Array<{ policyId: PolicyId; versionHash: VersionHash; acceptedAt: string; }> = [];

                for (const acceptance of acceptances) {
                    const policyHistory = updatedPolicies[acceptance.policyId] ?? {};
                    const existingTimestamp = policyHistory[acceptance.versionHash];

                    // No-op if already accepted (preserve original timestamp)
                    if (!existingTimestamp) {
                        updatedPolicies[acceptance.policyId] = {
                            ...policyHistory,
                            [acceptance.versionHash]: now,
                        };
                    }

                    acceptedResults.push({
                        policyId: acceptance.policyId,
                        versionHash: acceptance.versionHash,
                        acceptedAt: existingTimestamp ?? now,
                    });
                }

                transaction.update(userRef, { acceptedPolicies: updatedPolicies });

                return acceptedResults;
            });

            logger.info('policies-accepted', {
                ids: acceptances.map((a) => a.policyId).join(','),
                userId,
            });

            return results;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('Failed to accept multiple policies', error as Error, { userId, acceptancesCount: acceptances.length });
            throw Errors.serviceError(ErrorDetail.POLICY_SERVICE_ERROR);
        }
    }

    /**
     * Get user's policy acceptance status
     */
    async getUserPolicyStatus(userId: UserId): Promise<UserPolicyStatusResponse> {
        try {
            // Get all policies
            const allPolicies = await this.firestoreReader.getAllPolicies();

            // Get user's acceptance data
            const user = await this.firestoreReader.getUser(userId);

            if (!user) {
                throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
            }

            const userAcceptedPolicies = user.acceptedPolicies || {};
            const policies: PolicyAcceptanceStatusDTO[] = [];
            let totalPending = 0;

            allPolicies.forEach((policy) => {
                const policyId = policy.id;
                const currentVersionHash = policy.currentVersionHash;
                // Check if current version exists in the policy's acceptance history
                const policyHistory = (userAcceptedPolicies[policyId] ?? {}) as Record<VersionHash, string>;
                const hasAcceptedCurrentVersion = currentVersionHash in policyHistory;
                const needsAcceptance = !hasAcceptedCurrentVersion;
                // Return currentVersionHash if accepted, undefined otherwise
                const userAcceptedHash = hasAcceptedCurrentVersion ? currentVersionHash : undefined;

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
            throw Errors.serviceError(ErrorDetail.POLICY_SERVICE_ERROR);
        }
    }
}
