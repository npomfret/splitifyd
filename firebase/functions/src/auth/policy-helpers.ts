import { logger } from '../logger';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { getFirestoreReader } from '../services/serviceRegistration';

/**
 * Get current version hashes for all policies
 * Used during user registration to capture what policies they're accepting
 */
export async function getCurrentPolicyVersions(): Promise<Record<string, string>> {
    try {
        const firestoreReader = getFirestoreReader();
        const policies = await firestoreReader.getAllPolicies();

        const acceptedPolicies: Record<string, string> = {};

        policies.forEach((policy) => {
            if (policy.currentVersionHash) {
                acceptedPolicies[policy.id] = policy.currentVersionHash;
            }
        });

        return acceptedPolicies;
    } catch (error) {
        logger.error('Failed to get current policy versions', error);
        // Registration must fail if policies cannot be retrieved - compliance requirement
        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'POLICY_SERVICE_UNAVAILABLE', 'Registration temporarily unavailable - unable to retrieve policy versions');
    }
}
