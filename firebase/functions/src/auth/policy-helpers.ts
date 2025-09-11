import { logger } from '../logger';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { IFirestoreReader } from '../services/firestore';

/**
 * todo: move this to teh PolicyService
 */
export async function getCurrentPolicyVersions(firestoreReader: IFirestoreReader): Promise<Record<string, string>> {
    try {
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
